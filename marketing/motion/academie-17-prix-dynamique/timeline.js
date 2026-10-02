// Baitly Académie · Épisode 17 « Le prix dynamique en 3 règles » (≈ 2 min). Un seul dossier, deux formats : le format vient
// de render.mjs (--format=9x16 | 16x9 → window.__FORMAT__) ou de l'URL (?format=16x9) en aperçu.
// Les plans SUIVENT la voix : align-vo.py (FOLLOW) recale `slots` (un plan par chapitre), les moments
// synchronisés et la durée dans `lang`. Départs par défaut lointains : chaque réplique enchaîne sur la
// précédente après une respiration (0,5 s dans un chapitre, 0,85 s entre deux chapitres).
var ACADEMIE_WIDE = (window.__FORMAT__ || new URLSearchParams(location.search).get('format') || '9x16') === '16x9';
if (ACADEMIE_WIDE) document.documentElement.classList.add('f169');
window.TIMELINE = {
  width: ACADEMIE_WIDE ? 1920 : 1080, height: ACADEMIE_WIDE ? 1080 : 1920,
  duration: 170, fps: 30,
  voiceover: [
    { id: 'b1', start: 0.4 }, { id: 'b2', start: 900 }, { id: 'b3', start: 900 }, { id: 'b4', start: 900 },
    { id: 'b5', start: 900 }, { id: 'b6', start: 900 }, { id: 'b7', start: 900 }, { id: 'b8', start: 900 },
    { id: 'b9', start: 900 }, { id: 'b10', start: 900 }, { id: 'b11', start: 900 }, { id: 'b12', start: 900 },
    { id: 'b13', start: 900 },
  ],
  // Nappe musicale de la série, discrète sous la voix, éteinte en fondu sur l'écran de fin.
  audio: [{ path: '../academie-shared/audio/academie-nappe.wav', start: 0, gain: 0.16, fadeOut: 2.5 }],
  // Chapitres (slots) : 0 accroche · 1 plancher · 2 week-ends · 3 dernière minute · 4 en pratique · 5 à retenir.
  // Voix : Lucie. Moments : SYNC dans align-vo.py.
  sync: { slots: [[0, 1]] },
  lang: {"fr": {"starts": {"b1": 0.4, "b2": 14.46, "b3": 22.84, "b4": 36.43, "b5": 49.58, "b6": 57.91, "b7": 71.6, "b8": 84.46, "b9": 91.03, "b10": 101.68, "b11": 110.1, "b12": 122.95, "b13": 138.45}, "q2": 1.81, "sat": 4.35, "tue": 6.68, "rules": 11.61, "r1": 14.46, "calc": 20.34, "ch": 22.84, "c25": 26.72, "men": 27.65, "c20": 32.51, "c45": 34.91, "trap1": 36.43, "com": 39.02, "show53": 41.81, "floor": 43.31, "loss": 47.84, "r2": 49.58, "up": 55.24, "wk": 57.91, "w120": 59.32, "p20": 62.02, "cond": 63.37, "w160": 67.6, "how": 71.6, "cheap": 78.24, "ev": 79.07, "e1": 80.14, "e2": 82.04, "e3": 82.53, "e4": 83.17, "r3": 84.46, "zero": 87.87, "j7": 92.18, "p90": 93.82, "j3": 95.79, "p80": 97.57, "fl": 98.73, "trap2": 101.68, "wait": 105.65, "g1": 113.04, "a1": 114.48, "g2": 115.1, "a2": 116.85, "g3": 117.47, "a3": 119.01, "k1": 123.56, "k2": 125.28, "k3": 127.3, "app": 128.86, "app2": 134.06, "end": 138.45, "slots": [[0.2, 14.26], [14.26, 49.38], [49.38, 84.26], [84.26, 109.9], [109.9, 122.75], [122.75, 138.45]], "duration": 143.1}},
};
