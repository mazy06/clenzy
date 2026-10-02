// Baitly Académie · Épisode 20 « Gérer pour le compte d’un propriétaire » (≈ 2 min 25). Un seul dossier, deux formats : le format vient
// de render.mjs (--format=9x16 | 16x9 → window.__FORMAT__) ou de l'URL (?format=16x9) en aperçu.
// Les plans SUIVENT la voix : align-vo.py (FOLLOW) recale `slots` (un plan par chapitre), les moments
// synchronisés et la durée dans `lang`. Départs par défaut lointains : chaque réplique enchaîne sur la
// précédente après une respiration (0,5 s dans un chapitre, 0,85 s entre deux chapitres).
var ACADEMIE_WIDE = (window.__FORMAT__ || new URLSearchParams(location.search).get('format') || '9x16') === '16x9';
if (ACADEMIE_WIDE) document.documentElement.classList.add('f169');
window.TIMELINE = {
  width: ACADEMIE_WIDE ? 1920 : 1080, height: ACADEMIE_WIDE ? 1080 : 1920,
  duration: 175, fps: 30,
  voiceover: [
    { id: 'b1', start: 0.4 }, { id: 'b2', start: 900 }, { id: 'b3', start: 900 }, { id: 'b4', start: 900 }, { id: 'b5', start: 900 }, { id: 'b6', start: 900 }, { id: 'b7', start: 900 }, { id: 'b8', start: 900 }, { id: 'b9', start: 900 }, { id: 'b10', start: 900 }, { id: 'b11', start: 900 }, { id: 'b12', start: 900 },
  ],
  // Nappe musicale de la série, discrète sous la voix, éteinte en fondu sur l'écran de fin.
  audio: [{ path: '../academie-shared/audio/academie-nappe.wav', start: 0, gain: 0.16, fadeOut: 2.5 }],
  // Chapitres (slots) : 0 accroche · 1 le mandat · 2 le reversement · 3 le relevé · 4 mise en pratique · 5 à retenir.
  // Voix : Lucie. Moments : SYNC dans align-vo.py.
  sync: { slots: [[0, 1]] },
  lang: {"fr": {"starts": {"b1": 0.4, "b2": 16.61, "b3": 26.4, "b4": 42.83, "b5": 51.74, "b6": 62.32, "b7": 74.81, "b8": 84.78, "b9": 97.73, "b10": 104.4, "b11": 123.07, "b12": 142.01}, "owner": 0.4, "how": 5.61, "why": 6.63, "clear": 7.38, "p1": 13.61, "p2": 14.2, "p3": 15.06, "mand": 16.61, "m1": 21.5, "m2": 22.57, "m3": 23.7, "m4": 24.78, "base": 26.4, "v2000": 28.25, "v300": 30.28, "gross": 34.04, "net": 37.02, "gap": 40.19, "trap1": 42.83, "vague": 44.16, "who": 46.59, "write": 48.55, "rev": 51.74, "minus1": 57.44, "minus2": 59.1, "minus3": 60.38, "again": 62.32, "r2000": 62.97, "r300": 64.55, "r340": 66.08, "r160": 68.31, "r1200": 71.42, "trap2": 74.81, "apart": 78.86, "fixed": 81.01, "stmt": 84.78, "detail": 89.22, "same": 95.12, "calm": 97.73, "trust": 100.39, "prat": 104.4, "c1": 107.53, "c2": 108.93, "c3": 110.77, "c4": 112.07, "c5": 113.09, "card": 117.52, "k1": 123.68, "k2": 124.59, "k3": 127.42, "app": 128.58, "sign": 129.19, "base2": 130.7, "valid": 135.0, "auto": 137.27, "end": 142.01, "slots": [[0.2, 16.41], [16.41, 51.54], [51.54, 84.58], [84.58, 104.2], [104.2, 122.87], [122.87, 142.01]], "duration": 147.0}},
};
