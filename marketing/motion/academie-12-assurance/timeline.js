// Baitly Académie · Épisode 12 « Votre assurance couvre-t-elle la location courte durée ? » (≈ 2 min). Un seul dossier, deux formats : le format vient
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
    { id: 'b1', start: 0.4 }, { id: 'b2', start: 900 }, { id: 'b3', start: 900 }, { id: 'b4', start: 900 }, { id: 'b5', start: 900 }, { id: 'b6', start: 900 }, { id: 'b7', start: 900 }, { id: 'b8', start: 900 }, { id: 'b9', start: 900 }, { id: 'b10', start: 900 }, { id: 'b11', start: 900 },
  ],
  // Nappe musicale de la série, discrète sous la voix, éteinte en fondu sur l'écran de fin.
  audio: [{ path: '../academie-shared/audio/academie-nappe.wav', start: 0, gain: 0.16, fadeOut: 2.5 }],
  // Chapitres (slots) : 0 accroche · 1 votre contrat · 2 les six questions · 3 les chiffres · 4 les preuves et la mise en pratique · 5 à retenir.
  // Voix : Noé. Moments : SYNC dans align-vo.py.
  sync: { slots: [[0, 1]] },
  lang: {"fr": {"starts": {"b1": 0.4, "b2": 15.09, "b3": 27.56, "b4": 35.43, "b5": 44.98, "b6": 54.94, "b7": 66.85, "b8": 83.91, "b9": 93.47, "b10": 105.81, "b11": 119.61}, "water": 0.4, "leave": 3.11, "cancel": 4.76, "who": 7.32, "q2": 11.47, "home": 17.93, "live": 20.02, "guests": 20.68, "ask": 22.63, "write": 25.38, "n1": 27.56, "each": 32.18, "n2": 36.65, "n3": 39.88, "n4": 40.94, "n5": 44.98, "n6": 51.22, "trap1": 54.94, "some": 56.65, "only": 61.28, "direct": 63.89, "nums": 66.85, "rep": 68.55, "lost": 72.11, "fr": 73.07, "rest": 76.95, "without": 79.13, "total": 81.84, "proofs": 83.91, "p1": 87.25, "p2": 88.7, "p3": 89.75, "word": 91.0, "prat": 93.47, "each2": 97.3, "file": 98.67, "hour": 100.82, "k1": 106.4, "k2": 107.28, "k3": 108.99, "k4": 110.89, "app": 111.87, "inc": 115.05, "end": 119.61, "slots": [[0.2, 14.89], [14.89, 27.36], [27.36, 66.65], [66.65, 83.71], [83.71, 105.61], [105.61, 119.61]], "duration": 124.2}},
};
