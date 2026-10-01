// Baitly · Teaser 15 s · grille de tempo PARTAGÉE entre l'animation (teaser.js) et la musique
// (musique.py, qui lit ce fichier). Tout est exprimé en TEMPS (beats) : 128 BPM, 4 temps par mesure,
// 8 mesures = exactement 15 s. Une scène = une mesure. Modifier ici, puis régénérer la musique.
window.GRILLE = {
  "bpm": 128,
  "mesures": 8,
  "scenes": ["accroche", "logo", "planning", "canaux", "menage", "agents", "paiement", "fin"],
  "sons": {
    "whoosh": [7.35, 15.35, 23.45],
    "clic": [23.0, 27.0],
    "tic": [16.0, 17.0, 18.0, 19.0],
    "scintillement": [7.0, 29.0]
  }
};
