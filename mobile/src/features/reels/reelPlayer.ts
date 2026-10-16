/** Only Meta CDN streams returned by the authenticated Instagram API. */
export function isInstagramVideoUrl(value: string) {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && !url.port
    && (url.hostname.endsWith('.cdninstagram.com') || url.hostname.endsWith('.fbcdn.net')); } catch { return false; }
}
export function reelPlayerHtml(url: string, muted: boolean) {
  if (!isInstagramVideoUrl(url)) return '';
  const escaped = url.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; media-src https://*.cdninstagram.com https://*.fbcdn.net; style-src 'unsafe-inline'; script-src 'unsafe-inline'"><style>html,body{margin:0;width:100%;height:100%;background:#101820;overflow:hidden}video{width:100%;height:100%;object-fit:cover}</style></head><body><video id="video" src="${escaped}" playsinline loop autoplay ${muted ? 'muted' : ''}></video><script>const v=document.getElementById('video');v.onerror=()=>window.ReactNativeWebView?.postMessage('error');v.play().catch(()=>window.ReactNativeWebView?.postMessage('paused'));</script></body></html>`;
}
