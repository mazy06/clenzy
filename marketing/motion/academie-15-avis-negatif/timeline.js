// Baitly Académie · Épisode 15 « Répondre à un avis négatif » (≈ 2 min 20). Un seul dossier, deux formats : le format vient
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
  // Chapitres (slots) : 0 accroche · 1 à qui vous répondez · 2 les quatre étapes · 3 ce que coûte un avis · 4 mise en pratique · 5 à retenir.
  // Voix : Lucie. Moments : SYNC dans align-vo.py.
  sync: { slots: [[0, 1]] },
  lang: {"fr": {"starts": {"b1": 0.4, "b2": 17.38, "b3": 29.39, "b4": 41.31, "b5": 48.8, "b6": 56.24, "b7": 68.43, "b8": 79.17, "b9": 92.77, "b10": 103.54, "b11": 116.64, "b12": 135.27}, "stars": 0.4, "quote": 1.34, "reflex": 4.34, "bad": 6.64, "readers": 11.05, "q2": 14.05, "pub": 19.65, "fut": 22.05, "judge": 26.9, "trap1": 29.39, "hot": 31.01, "fight": 34.66, "wait": 36.49, "calm": 38.42, "four": 41.31, "s1": 43.9, "s2": 48.8, "s3": 56.24, "s4": 63.11, "trap2": 68.43, "copy": 70.33, "gift": 73.59, "priv": 75.6, "cost": 79.17, "r20": 81.49, "r2": 84.22, "r467": 86.37, "back": 88.53, "r14": 90.63, "note": 92.77, "hesit": 95.09, "fix": 98.3, "prat": 103.54, "w40": 106.11, "m1": 108.41, "m2": 108.86, "m3": 109.75, "m4": 110.31, "reread": 111.37, "k1": 117.27, "k2": 119.42, "k3": 120.99, "app": 122.45, "draft": 128.11, "valid": 131.05, "end": 135.27, "slots": [[0.2, 17.18], [17.18, 41.11], [41.11, 78.97], [78.97, 103.34], [103.34, 116.44], [116.44, 135.27]], "duration": 139.8}},
};
