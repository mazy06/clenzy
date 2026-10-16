import { isInstagramVideoUrl, reelPlayerHtml } from './reelPlayer';

it('only plays HTTPS Meta CDN media, excluding local hosts and deceptive domains', () => {
  expect(isInstagramVideoUrl('https://scontent.cdninstagram.com/video.mp4')).toBe(true);
  expect(isInstagramVideoUrl('https://video.fbcdn.net/video.mp4')).toBe(true);
  for (const url of ['http://video.fbcdn.net/a', 'https://127.0.0.1/video.mp4', 'https://video.fbcdn.net.evil.test/a', 'javascript:alert(1)', 'https://user:secret@video.fbcdn.net/a']) {
    expect(isInstagramVideoUrl(url)).toBe(false);
    expect(reelPlayerHtml(url, true)).toBe('');
  }
});
it('escapes media URL markup and keeps playback inline and muted', () => {
  const html = reelPlayerHtml('https://video.fbcdn.net/video.mp4?x="<script>&y=1', true);
  expect(html).toContain('&quot;');
  expect(html).toContain('&lt;script&gt;');
  expect(html).toContain('playsinline loop autoplay muted');
  expect(html).not.toContain('x="<script>');
});
