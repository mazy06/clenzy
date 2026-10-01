// Baitly · Teaser 15 s · format 16:9 (site, YouTube, LinkedIn). Tempo et scènes : ../teaser-15s-shared/grille.js.
// 60 images/s pour des mouvements parfaitement fluides ; musique masterisée (−14 LUFS) gardée telle quelle.
window.TIMELINE = {
  width: 1920, height: 1080, duration: 15, fps: 60,
  audio: [{ path: '../teaser-15s-shared/audio/teaser-musique.wav', start: 0 }],
  loudnorm: false,
  audioBitrate: '256k',
};
