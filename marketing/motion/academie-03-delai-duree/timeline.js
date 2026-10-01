// Baitly Académie · Épisode 03 « Délai de réservation et durée de séjour » (≈ 2 min). Un seul dossier, deux formats : le format vient
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
  // Chapitres (slots) : 0 accroche · 1 délai de réservation · 2 durée de séjour · 3 nuits orphelines ·
  // 4 que faire · 5 à retenir. Voix : Lucie (alternance avec Paul K). Moments : SYNC dans align-vo.py.
  sync: { slots: [[0, 1]] },
  lang: {"fr": {"starts": {"b1": 0.4, "b2": 12.11, "b3": 19.05, "b4": 28.89, "b5": 39.61, "b6": 48.05, "b7": 53.82, "b8": 63.07, "b9": 75.86, "b10": 83.47, "b11": 94.52, "b12": 104.13, "b13": 117.88}, "q2": 3.78, "two": 7.77, "lt": 13.22, "def": 14.85, "ex": 19.64, "arr": 21.21, "d45": 21.91, "list": 23.05, "avg": 27.04, "use": 28.89, "j10": 35.93, "act": 38.28, "trap": 39.61, "stly": 45.63, "dms": 49.21, "f": 50.74, "n24": 55.32, "sA": 57.0, "sB": 60.17, "work": 63.96, "clean": 66.21, "c560": 69.3, "c280": 70.66, "diff": 74.01, "orph": 77.03, "min3": 78.42, "gap": 79.87, "sol": 83.47, "fill": 88.73, "gain": 90.75, "a1": 95.88, "a2": 98.56, "a3": 100.99, "k1": 104.71, "k2": 106.18, "app": 108.97, "end": 117.88, "slots": [[0.2, 11.91], [11.91, 47.85], [47.85, 75.66], [75.66, 94.32], [94.32, 103.93], [103.93, 117.88]], "duration": 122.6}},
};
