// Baitly Académie · Épisode 04 « Annulations, avis, temps de réponse » (≈ 1 min 40). Un seul dossier, deux formats : le format vient
// de render.mjs (--format=9x16 | 16x9 → window.__FORMAT__) ou de l'URL (?format=16x9) en aperçu.
// Les plans SUIVENT la voix : align-vo.py (FOLLOW) recale `slots` (un plan par chapitre), les moments
// synchronisés et la durée dans `lang`. Départs par défaut lointains : chaque réplique enchaîne sur la
// précédente après une respiration (0,5 s dans un chapitre, 0,85 s entre deux chapitres).
var ACADEMIE_WIDE = (window.__FORMAT__ || new URLSearchParams(location.search).get('format') || '9x16') === '16x9';
if (ACADEMIE_WIDE) document.documentElement.classList.add('f169');
window.TIMELINE = {
  width: ACADEMIE_WIDE ? 1920 : 1080, height: ACADEMIE_WIDE ? 1080 : 1920,
  duration: 150, fps: 30,
  voiceover: [
    { id: 'b1', start: 0.4 }, { id: 'b2', start: 900 }, { id: 'b3', start: 900 }, { id: 'b4', start: 900 },
    { id: 'b5', start: 900 }, { id: 'b6', start: 900 }, { id: 'b7', start: 900 }, { id: 'b8', start: 900 },
    { id: 'b9', start: 900 }, { id: 'b10', start: 900 }, { id: 'b11', start: 900 }, { id: 'b12', start: 900 },
  ],
  // Nappe musicale de la série, discrète sous la voix, éteinte en fondu sur l'écran de fin.
  audio: [{ path: '../academie-shared/audio/academie-nappe.wav', start: 0, gain: 0.16, fadeOut: 2.5 }],
  // Chapitres (slots) : 0 accroche · 1 annulations · 2 avis · 3 réactivité · 4 que faire · 5 à retenir.
  // Voix : Noé. Moments : SYNC dans align-vo.py.
  sync: { slots: [[0, 1]] },
  lang: {"fr": {"starts": {"b1": 0.4, "b2": 11.68, "b3": 20.68, "b4": 30.35, "b5": 36.81, "b6": 42.07, "b7": 52.77, "b8": 60.33, "b9": 70.75, "b10": 76.44, "b11": 84.22, "b12": 95.77}, "q2": 3.02, "i1": 7.87, "i2": 8.82, "i3": 9.88, "can": 12.9, "f": 13.87, "ex": 17.18, "r8": 19.42, "guest": 22.79, "policy": 24.99, "host": 26.55, "pen": 29.34, "cal": 31.97, "rev": 38.19, "note": 38.82, "count": 40.32, "a12": 42.31, "drop": 46.23, "a80": 47.78, "stable": 50.82, "ask": 53.06, "reply": 55.41, "react": 61.64, "f24": 65.29, "r95": 67.68, "speed": 71.09, "wait": 74.98, "a1": 77.67, "a2": 80.52, "a3": 82.78, "k1": 84.75, "k2": 86.22, "k3": 87.68, "app": 88.66, "app2": 93.58, "end": 95.77, "slots": [[0.2, 11.48], [11.48, 36.61], [36.61, 60.13], [60.13, 76.24], [76.24, 84.02], [84.02, 95.77]], "duration": 100.4}},
};
