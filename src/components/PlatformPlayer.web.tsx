import { useEffect, useRef } from 'react';
import type { PlatformVideo } from '../services/providers/platform';

type PlaybackState = 'unknown' | 'playing' | 'paused' | 'ad';
export default function PlatformPlayer({ video, onStateChange }: { video: PlatformVideo; onStateChange: (state: PlaybackState) => void }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const embed = new URL(video.embedUrl);
  if (video.provider === 'youtube') { embed.searchParams.set('enablejsapi', '1'); embed.searchParams.set('origin', window.location.origin); }
  useEffect(() => {
    onStateChange('unknown');
    function message(event: MessageEvent) {
      if (event.source !== frame.current?.contentWindow || event.origin !== 'https://www.youtube.com') return;
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data.event === 'onStateChange') onStateChange(data.info === 1 ? 'playing' : data.info === 2 ? 'paused' : 'unknown');
      } catch { /* Ignore unrelated player events. */ }
    }
    window.addEventListener('message', message);
    return () => window.removeEventListener('message', message);
  }, [video.url, onStateChange]);
  return <iframe ref={frame} key={video.url} title={video.provider === 'youtube' ? 'Плеер YouTube' : 'Плеер VK Видео'} src={embed.href} allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" style={{ height: 350, width: '100%', border: 0, borderRadius: 16, backgroundColor: '#000' }} onLoad={() => {
    if (video.provider === 'youtube') frame.current?.contentWindow?.postMessage(JSON.stringify({ event: 'listening' }), 'https://www.youtube.com');
  }} />;
}
