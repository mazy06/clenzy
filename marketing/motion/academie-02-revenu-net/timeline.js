// Baitly Académie · Épisode 02 « Votre revenu net, vraiment » (≈ 2 min 20). Un seul dossier, deux formats : le format vient
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
    { id: 'b13', start: 900 },
  ],
  // Nappe musicale de la série, discrète sous la voix, éteinte en fondu sur l'écran de fin.
  audio: [{ path: '../academie-shared/audio/academie-nappe.wav', start: 0, gain: 0.16, fadeOut: 2.5 }],
  // Chapitres (slots) : 0 accroche · 1 ce que paie le voyageur · 2 la commission · 3 les coûts du séjour ·
  // 4 le mois · 5 que faire de ce chiffre · 6 à retenir. Moments : voir SYNC dans align-vo.py.
  sync: { slots: [[0, 1]] },
  lang: {"fr": {"starts": {"b1": 0.4, "b2": 11.95, "b3": 22.37, "b4": 31.41, "b5": 41.55, "b6": 50.43, "b7": 59.86, "b8": 68.58, "b9": 78.93, "b10": 91.01, "b11": 99.2, "b12": 116.54, "b13": 129.71}, "q2": 5.33, "follow": 7.71, "p1": 14.08, "p2": 17.85, "p3": 20.17, "tax": 24.39, "r660": 29.18, "com": 34.45, "com2": 36.31, "pay": 38.71, "trap1": 41.55, "clean0": 49.13, "c1": 52.96, "c2": 55.01, "c3": 56.58, "net": 60.73, "aff": 63.1, "keep": 65.84, "trap2": 68.58, "f60": 72.31, "f70": 73.62, "f10": 76.98, "m4": 80.45, "m1872": 82.31, "fixed": 85.22, "f450": 88.88, "mnet": 92.48, "half": 96.18, "a1": 101.4, "a2": 105.35, "a3": 109.55, "k0": 117.18, "k1": 118.25, "k2": 119.58, "k3": 120.75, "k4": 122.19, "app": 123.09, "end": 129.71, "slots": [[0.2, 11.75], [11.75, 31.21], [31.21, 50.23], [50.23, 78.73], [78.73, 99.0], [99.0, 116.34], [116.34, 129.71]], "duration": 134.6}},
};
