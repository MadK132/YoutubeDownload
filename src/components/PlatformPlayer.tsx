import WebView from 'react-native-webview';
import { View } from 'react-native';
import { useEffect, useState } from 'react';
import type { PlatformVideo } from '../services/providers/platform';
import { platformVideo } from '../services/providers/platform';
import { Notice } from './ui';

export type PlaybackState = 'unknown' | 'playing' | 'paused' | 'ad';
export interface PlatformPlayerProps { video: PlatformVideo; onStateChange: (state: PlaybackState) => void }

const observePlayback = `
(function () {
  if (window.__pocketObserver) return true;
  window.__pocketObserver = true;
  var previous = '';
  function visible(element) { return element && element.getBoundingClientRect().height > 0 && getComputedStyle(element).display !== 'none' && getComputedStyle(element).visibility !== 'hidden' && getComputedStyle(element).opacity !== '0'; }
  function report() {
    var ad = document.querySelector('.html5-video-player.ad-showing, .html5-video-player.ad-interrupting');
    var vkAd = document.querySelector('.videoplayer_ads, .videoplayer_ad');
    var videos = Array.from(document.querySelectorAll('video')).sort(function(a,b) { return b.clientWidth*b.clientHeight-a.clientWidth*a.clientHeight; });
    var video = videos[0];
    var state = visible(ad) || visible(vkAd) ? 'ad' : video && !video.paused && !video.ended ? 'playing' : video ? 'paused' : 'unknown';
    if (previous !== state) { previous = state; window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'playback', state: state })); }
  }
  document.addEventListener('play', report, true);
  document.addEventListener('pause', report, true);
  setInterval(report, 1000);
  report();
  return true;
})(); true;`;

export default function PlatformPlayer({ video, onStateChange }: PlatformPlayerProps) {
  const [error, setError] = useState('');
  useEffect(() => { setError(''); onStateChange('unknown'); }, [video.url, onStateChange]);
  return <View style={{ gap: 12 }}>
    <View style={{ height: 350, borderRadius: 16, overflow: 'hidden', backgroundColor: '#000' }}>
      <WebView source={{ uri: video.provider === 'youtube' ? video.url.replace('www.youtube.com', 'm.youtube.com') : video.url }} incognito allowsInlineMediaPlayback allowsFullscreenVideo mediaPlaybackRequiresUserAction javaScriptEnabled injectedJavaScript={observePlayback} onError={() => setError('Плеер не загрузился. Проверьте доступность сайта. Получение дорожек можно попробовать отдельно.')} onMessage={event => {
        try { const message = JSON.parse(event.nativeEvent.data); if (message.type === 'playback' && ['unknown', 'playing', 'paused', 'ad'].includes(message.state)) onStateChange(message.state); } catch { /* Ignore page messages unrelated to playback. */ }
      }} onShouldStartLoadWithRequest={request => {
        if (request.isTopFrame === false) return true;
        if (request.url === 'about:blank') return true;
        try { const target = platformVideo(request.url); return target?.provider === video.provider && target.id === video.id; } catch { return false; }
      }} />
    </View>
    {!!error && <Notice error>{error}</Notice>}
  </View>;
}
