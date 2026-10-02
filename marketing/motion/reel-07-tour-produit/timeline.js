// Timeline du Reel 07 « Baitly en 75 secondes » (tour du produit, 16:9). Départs par défaut
// identiques dans les trois langues (fenêtres : VOIX-OFF.md) ; recalage par langue dans `lang`.
window.TIMELINE = {
  duration: 75,
  fps: 30,
  width: 1920,
  height: 1080,
  voiceover: [
    { id: 'b1', start: 0.3 },   // intro
    { id: 'b2', start: 5.4 },   // 01 Piloter
    { id: 'b3', start: 15.4 },  // 02 Développer
    { id: 'b4', start: 24.4 },  // 03 Automatiser
    { id: 'b5', start: 34.4 },  // 04 Accueillir
    { id: 'b6', start: 43.4 },  // 05 Opérer
    { id: 'b7', start: 52.4 },  // 06 Encaisser
    { id: 'b8', start: 61.4 },  // 07 Langues
    { id: 'b9', start: 68.4 },  // fin
  ],
  // chapters : instant de chaque transition (le balayage couvre l'écran à cet instant).
  // drop : la réservation se pose · approve : clic « Approuver » · add : ajout d'un extra
  // proof : photo de contrôle validée · paid : relevé propriétaire · flips : AR puis EN.
  sync: {
    chapters: [5, 15, 24, 34, 43, 52, 61, 68],
    drop: 9.6, approve: 30.6, add: 39.8, proof: 48.2, statement: 56.4, flips: [63.2, 65.6],
  },
  lang: {"fr": {"starts": {"b1": 0.3, "b2": 6.15, "b3": 15.18, "b4": 23.79, "b5": 33.29, "b6": 42.9, "b7": 50.75, "b8": 58.55, "b9": 66.62}, "drop": 11.32, "approve": 28.99, "add": 41.07, "proof": 48.67, "statement": 56.78, "flips": [59.45, 61.05], "warp": [[0.0, 0.0], [0.3, 0.3], [6.15, 5.4], [15.18, 15.4], [23.79, 24.4], [33.29, 34.4], [42.9, 43.4], [50.75, 52.4], [58.55, 61.4], [66.62, 68.4], [74.6, 75.0]], "duration": 74.6}, "en": {"starts": {"b1": 0.3, "b2": 5.61, "b3": 15.19, "b4": 23.42, "b5": 33.7, "b6": 41.2, "b7": 51.29, "b8": 59.1, "b9": 65.33}, "drop": 10.62, "approve": 29.13, "add": 39.96, "proof": 48.98, "statement": 57.1, "flips": [59.78, 61.38], "warp": [[0.0, 0.0], [0.3, 0.3], [5.61, 5.4], [15.19, 15.4], [23.42, 24.4], [33.7, 34.4], [41.2, 43.4], [51.29, 52.4], [59.1, 61.4], [65.33, 68.4], [72.1, 75.0]], "duration": 72.1}},
};
