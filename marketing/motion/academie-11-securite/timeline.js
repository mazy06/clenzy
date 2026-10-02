// Baitly Académie · Épisode 11 « La checklist sécurité du logement » (≈ 2 min). Un seul dossier, deux formats : le format vient
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
    { id: 'b1', start: 0.4 }, { id: 'b2', start: 900 }, { id: 'b3', start: 900 }, { id: 'b4', start: 900 }, { id: 'b5', start: 900 }, { id: 'b6', start: 900 }, { id: 'b7', start: 900 }, { id: 'b8', start: 900 }, { id: 'b9', start: 900 }, { id: 'b10', start: 900 },
  ],
  // Nappe musicale de la série, discrète sous la voix, éteinte en fondu sur l'écran de fin.
  audio: [{ path: '../academie-shared/audio/academie-nappe.wav', start: 0, gain: 0.16, fadeOut: 2.5 }],
  // Chapitres (slots) : 0 accroche · 1 l’obligatoire · 2 le recommandé · 3 les consignes · 4 mise en pratique · 5 à retenir.
  // Voix : Noé. Moments : SYNC dans align-vo.py.
  sync: { slots: [[0, 1]] },
  lang: {"fr": {"starts": {"b1": 0.4, "b2": 16.09, "b3": 30.46, "b4": 43.98, "b5": 55.03, "b6": 67.34, "b7": 79.91, "b8": 92.36, "b9": 101.28, "b10": 120.9}, "det": 0.4, "fire": 3.24, "q2": 6.19, "o": 11.52, "r": 12.29, "v": 13.07, "oblig": 16.09, "smoke": 19.75, "ce": 21.4, "owner": 24.91, "pool": 30.46, "d1": 35.83, "d2": 36.54, "d3": 37.14, "d4": 37.9, "before": 38.51, "fine": 40.44, "trap1": 43.98, "ma": 46.75, "city": 50.15, "check": 51.22, "reco": 55.03, "co": 56.63, "ext": 61.1, "kit": 63.91, "torch": 65.66, "cons": 67.34, "w1": 71.17, "w2": 72.25, "w3": 74.81, "e112": 75.88, "mine": 77.21, "prat": 79.91, "t1": 83.34, "t2": 85.51, "t3": 88.1, "s30": 90.11, "note": 92.36, "n1": 93.09, "n2": 94.84, "n3": 96.17, "proof": 97.4, "k1": 101.92, "k2": 105.93, "k3": 107.2, "k4": 109.36, "app": 111.48, "notes": 115.86, "end": 120.9, "slots": [[0.2, 15.89], [15.89, 54.83], [54.83, 67.14], [67.14, 79.71], [79.71, 101.08], [101.08, 120.9]], "duration": 125.7}},
};
