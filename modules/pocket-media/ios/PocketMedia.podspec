Pod::Spec.new do |s|
  s.name = 'PocketMedia'
  s.version = '1.0.0'
  s.summary = 'On-device JavaScript evaluation and MP4 track composition'
  s.description = 'Uses JavaScriptCore and AVFoundation shipped with iOS; no server or FFmpeg.'
  s.license = { :type => 'MIT' }
  s.author = 'Pocket Video'
  s.homepage = 'https://docs.expo.dev/modules/'
  s.platform = :ios, '16.4'
  # Local-only pod, linked by path from this repository rather than fetched remotely.
  s.source = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'AVFoundation', 'JavaScriptCore'
  s.source_files = '**/*.{h,m,mm,swift}'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.swift_version = '5.9'
end
