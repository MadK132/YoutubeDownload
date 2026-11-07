import ExpoModulesCore
import Foundation
import AVFoundation
import JavaScriptCore

public final class PocketMediaModule: Module {
  private let stateQueue = DispatchQueue(label: "pocket-media.state")
  private var exports: [String: AVAssetExportSession] = [:]
  private var cancelled: Set<String> = []

  public func definition() -> ModuleDefinition {
    Name("PocketMedia")

    AsyncFunction("evaluate") { (script: String) throws -> [String: String] in
      guard script.utf8.count < 4_000_000, let context = JSContext() else {
        throw MediaError("Не удалось подготовить проигрыватель YouTube.")
      }
      // An isolated JSContext has no bridge to files, network, cookies or native objects.
      context.evaluateScript("var globalThis = this; var self = this;")
      let result = context.evaluateScript(script)
      guard context.exception == nil, let values = result?.toDictionary() else {
        throw MediaError("Не удалось обработать параметры проигрывателя YouTube.")
      }
      var output: [String: String] = [:]
      for key in ["sig", "n"] { if let value = values[key] as? String { output[key] = value } }
      return output
    }

    Function("cancel") { (operation: String) -> Void in
      self.stateQueue.sync {
        self.cancelled.insert(operation)
        self.exports[operation]?.cancelExport()
      }
    }

    AsyncFunction("merge") { (video: String, audio: String, output: String, operation: String) async throws -> String in
      let videoURL = try self.localVideoURL(video)
      let audioURL = try self.localVideoURL(audio)
      let outputURL = try self.localVideoURL(output)
      guard outputURL != videoURL, outputURL != audioURL else { throw MediaError("Неверный путь результата.") }
      defer { self.stateQueue.sync { self.exports.removeValue(forKey: operation); self.cancelled.remove(operation) } }
      do {
        try self.checkCancellation(operation)
        let videoAsset = AVURLAsset(url: videoURL)
        let audioAsset = AVURLAsset(url: audioURL)
        let videoProtected = try await videoAsset.load(.hasProtectedContent)
        let audioProtected = try await audioAsset.load(.hasProtectedContent)
        guard !videoProtected, !audioProtected else {
          throw MediaError("Защищённые DRM-дорожки не поддерживаются.")
        }
        guard let videoTrack = try await videoAsset.loadTracks(withMediaType: .video).first,
              let audioTrack = try await audioAsset.loadTracks(withMediaType: .audio).first else {
          throw MediaError("Не найдена видео- или аудиодорожка.")
        }
        let videoDuration = try await videoAsset.load(.duration)
        let audioDuration = try await audioAsset.load(.duration)
        guard videoDuration.isNumeric, audioDuration.isNumeric,
              CMTimeCompare(videoDuration, .zero) > 0, CMTimeCompare(audioDuration, .zero) > 0 else {
          throw MediaError("Некорректная длительность дорожек.")
        }
        let composition = AVMutableComposition()
        guard let picture = composition.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid),
              let sound = composition.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid) else {
          throw MediaError("Не удалось создать MP4.")
        }
        try picture.insertTimeRange(CMTimeRange(start: .zero, duration: videoDuration), of: videoTrack, at: .zero)
        picture.preferredTransform = try await videoTrack.load(.preferredTransform)
        try sound.insertTimeRange(CMTimeRange(start: .zero, duration: CMTimeMinimum(videoDuration, audioDuration)), of: audioTrack, at: .zero)
        try self.checkCancellation(operation)
        guard let session = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetPassthrough), session.supportedFileTypes.contains(.mp4) else {
          throw MediaError("Эти дорожки нельзя собрать в MP4 без перекодирования.")
        }
        session.outputURL = outputURL
        session.outputFileType = .mp4
        session.shouldOptimizeForNetworkUse = true
        self.stateQueue.sync { self.exports[operation] = session }
        try self.checkCancellation(operation)
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
          session.exportAsynchronously {
            if session.status == .completed { continuation.resume() }
            else { continuation.resume(throwing: MediaError(session.status == .cancelled ? "Сборка отменена." : "Не удалось собрать видео со звуком.")) }
          }
        }
        try self.checkCancellation(operation)
        return outputURL.absoluteString
      } catch {
        try? FileManager.default.removeItem(at: outputURL)
        throw error
      }
    }
  }

  private func checkCancellation(_ operation: String) throws {
    if stateQueue.sync(execute: { cancelled.contains(operation) }) { throw MediaError("Сборка отменена.") }
  }

  private func localVideoURL(_ value: String) throws -> URL {
    let root = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
      .appendingPathComponent("videos", isDirectory: true).standardizedFileURL.resolvingSymlinksInPath()
    guard let url = URL(string: value), url.isFileURL else { throw MediaError("Допускаются только локальные дорожки.") }
    let path = url.standardizedFileURL.resolvingSymlinksInPath()
    guard path.deletingLastPathComponent() == root else { throw MediaError("Недопустимый путь к дорожке.") }
    return path
  }
}

private struct MediaError: LocalizedError {
  let message: String
  init(_ message: String) { self.message = message }
  var errorDescription: String? { message }
}
