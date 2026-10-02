// Baitly Académie · Épisode 19 « Les extras qui rapportent » (≈ 2 min). Un seul dossier, deux formats : le format vient
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
  ],
  // Nappe musicale de la série, discrète sous la voix, éteinte en fondu sur l'écran de fin.
  audio: [{ path: '../academie-shared/audio/academie-nappe.wav', start: 0, gain: 0.16, fadeOut: 2.5 }],
  // Chapitres (slots) : 0 accroche · 1 vos services · 2 activités partenaires · 3 sur mesure · 4 le bon moment · 5 à retenir.
  // Voix : Noé. Moments : SYNC dans align-vo.py.
  sync: { slots: [[0, 1]] },
  lang: {"fr": {"starts": {"b1": 0.4, "b2": 13.98, "b3": 25.08, "b4": 34.82, "b5": 49.42, "b6": 58.63, "b7": 71.61, "b8": 86.92, "b9": 98.7, "b10": 110.43, "b11": 125.88, "b12": 140.55}, "q2": 3.04, "x1": 4.99, "x2": 6.25, "x3": 7.45, "x4": 8.26, "own": 13.98, "s1": 17.93, "s2": 19.13, "s3": 20.06, "s4": 21.62, "s5": 22.97, "calc": 25.08, "p35": 26.73, "one5": 28.03, "v20": 29.16, "v4": 30.25, "v140": 30.9, "nonight": 33.11, "trap1": 34.82, "clash": 38.7, "cond": 43.09, "c1": 44.4, "c2": 45.6, "c3": 47.03, "act": 49.42, "gyg": 53.65, "via": 54.43, "klk": 54.93, "k1000": 55.7, "connect": 59.18, "livret": 63.91, "a1": 64.73, "a2": 66.43, "a3": 67.49, "comm": 70.61, "ex": 71.61, "e130": 76.03, "e8": 78.44, "e1040": 79.36, "pays": 82.29, "custom": 86.92, "m1": 90.68, "m2": 92.52, "m3": 93.5, "m4": 94.49, "create": 95.81, "pack": 98.86, "arr": 99.87, "pdj": 100.94, "sum": 102.16, "p55": 103.38, "p50": 104.5, "win": 106.38, "t1": 112.45, "t2": 115.5, "t3": 119.26, "simple": 123.07, "k1": 126.49, "k2": 127.19, "k3": 129.04, "app": 131.39, "pay": 137.65, "end": 140.55, "slots": [[0.2, 13.78], [13.78, 49.22], [49.22, 86.72], [86.72, 110.23], [110.23, 125.68], [125.68, 140.55]], "duration": 145.1}},
};
