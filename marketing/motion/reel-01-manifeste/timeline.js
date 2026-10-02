// Timeline du Reel 01 « Manifeste ». Source unique partagée par l'animation
// (index.html) et le rendu (render.mjs lit window.TIMELINE pour placer la voix).
// Les départs sont les mêmes dans les trois langues : chaque réplique doit tenir
// dans sa fenêtre (voir VOIX-OFF.md). Les fichiers sont cherchés dans
// vo/<langue>/<id>.(wav|mp3|m4a|aiff).
window.TIMELINE = {
  duration: 33,
  fps: 30,
  voiceover: [
    { id: 'b1', start: 0.4 },
    { id: 'b2', start: 3.3 },
    { id: 'b3', start: 6.2 },
    { id: 'b4', start: 12.2 },
    { id: 'b5', start: 16.6 },
    { id: 'b6', start: 23.0 },
    { id: 'b7', start: 26.8 },
  ],
  // Recalage par langue, mesuré sur les voix réelles (prises ElevenLabs du 2026-09-27,
  // découpées aux pauses) : départs des répliques, instant du clic « Approuver » (sur la
  // fin de b5) et apparition de la 2e phrase de la promesse (b6).
  lang: {"ar": {"starts": {"b1": 0.35, "b2": 3.25, "b3": 5.85, "b4": 11.9, "b5": 16.45, "b6": 22.95, "b7": 26.7}, "click": 21.6, "promise2": 24.15}, "fr": {"starts": {"b1": 0.4, "b2": 3.3, "b3": 6.2, "b4": 12.21, "b5": 16.6, "b6": 23.0, "b7": 26.83}, "click": 21.66, "promise2": 24.9}, "en": {"starts": {"b1": 0.4, "b2": 3.3, "b3": 6.2, "b4": 12.2, "b5": 16.6, "b6": 23.0, "b7": 26.8}, "click": 21.83, "promise2": 24.32}},
};
