// Baitly Académie · Épisode 13 « Le ménage de rotation en 5 étapes » (≈ 2 min 35). Un seul dossier, deux formats : le format vient
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
    { id: 'b1', start: 0.4 }, { id: 'b2', start: 900 }, { id: 'b3', start: 900 }, { id: 'b4', start: 900 }, { id: 'b5', start: 900 }, { id: 'b6', start: 900 }, { id: 'b7', start: 900 }, { id: 'b8', start: 900 }, { id: 'b9', start: 900 }, { id: 'b10', start: 900 }, { id: 'b11', start: 900 }, { id: 'b12', start: 900 }, { id: 'b13', start: 900 },
  ],
  // Nappe musicale de la série, discrète sous la voix, éteinte en fondu sur l'écran de fin.
  audio: [{ path: '../academie-shared/audio/academie-nappe.wav', start: 0, gain: 0.16, fadeOut: 2.5 }],
  // Chapitres (slots) : 0 accroche · 1 le créneau · 2 les cinq étapes · 3 les photos · 4 mettons des chiffres · 5 à retenir.
  // Voix : Lucie. Moments : SYNC dans align-vo.py.
  sync: { slots: [[0, 1]] },
  lang: {"fr": {"starts": {"b1": 0.4, "b2": 13.77, "b3": 22.64, "b4": 36.27, "b5": 52.07, "b6": 61.33, "b7": 71.86, "b8": 79.45, "b9": 93.67, "b10": 101.48, "b11": 116.16, "b12": 131.16, "b13": 148.8}, "dep": 0.4, "arr": 2.96, "gap": 5.87, "q2": 8.67, "win": 18.42, "win5": 20.81, "calc": 22.64, "tr": 24.95, "men": 26.57, "lin": 28.02, "tot": 30.45, "marge": 31.72, "trap1": 36.27, "late": 39.76, "left": 41.76, "m30": 43.98, "fix": 46.2, "tard": 48.21, "steps": 52.07, "hb": 55.68, "fs": 57.04, "clean": 58.45, "st1": 61.33, "st2": 64.41, "st3": 69.21, "st4": 71.86, "st5": 75.61, "trap2": 79.45, "towel": 82.46, "fridge": 84.75, "check": 85.8, "same": 88.26, "photos": 93.67, "ph1": 95.23, "proof": 97.63, "ex": 101.48, "sofa": 105.33, "other": 107.99, "glass": 110.75, "dep2": 114.33, "num": 116.16, "c50": 117.32, "redo": 121.02, "g30": 123.13, "l80": 125.45, "avis": 126.93, "ctrl": 128.04, "k1": 131.8, "k2": 133.34, "k3": 135.03, "k4": 136.36, "app": 137.74, "pay": 146.39, "end": 148.8, "slots": [[0.2, 13.57], [13.57, 51.87], [51.87, 93.47], [93.47, 115.96], [115.96, 130.96], [130.96, 148.8]], "duration": 153.4}},
};
