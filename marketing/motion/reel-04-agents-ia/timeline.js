// Timeline du Reel 04 « Agents IA ». Départs par défaut identiques dans les trois langues
// (fenêtres : VOIX-OFF.md) ; recalage par langue dans `lang` une fois les voix reçues.
window.TIMELINE = {
  duration: 46,
  fps: 30,
  voiceover: [
    { id: 'b1', start: 0.4 },
    { id: 'b2', start: 4.4 },
    { id: 'b3', start: 10.4 },
    { id: 'b4', start: 18.4 },
    { id: 'b5', start: 24.4 },
    { id: 'b6', start: 31.4 },
    { id: 'b7', start: 38.4 },
  ],
  // hl : mise en avant des agents cités (prix, messages, ménage, paiements, conformité)
  // propose : passage « Surveille » → « Propose » · adjust / approve : clics sur la carte
  // toggles : bascule des automatisations · end : écran de fin.
  sync: { hl: [6.0, 6.8, 7.5, 8.3, 9.1], propose: 13.6, adjust: 19.6, approve: 22.4, toggles: 25.8, end: 41.8 },
  lang: {"fr": {"starts": {"b1": 0.4, "b2": 3.79, "b3": 9.72, "b4": 17.82, "b5": 24.31, "b6": 30.14, "b7": 37.73}, "hl": [5.69, 6.12, 6.69, 7.2, 7.81], "propose": 15.19, "adjust": 19.1, "approve": 22.0, "toggles": 27.76, "end": 41.05, "warp": [[0.0, 0.0], [0.4, 0.4], [3.79, 4.4], [9.72, 10.4], [17.82, 18.4], [24.31, 24.4], [30.14, 31.4], [37.73, 38.4], [46.1, 46.0]], "duration": 46.1}, "en": {"starts": {"b1": 0.4, "b2": 3.91, "b3": 10.24, "b4": 18.75, "b5": 24.94, "b6": 30.96, "b7": 38.45}, "hl": [6.24, 6.73, 7.43, 8.42, 9.12], "propose": 16.07, "adjust": 20.47, "approve": 23.37, "toggles": 27.63, "end": 42.3, "warp": [[0.0, 0.0], [0.4, 0.4], [3.91, 4.4], [10.24, 10.4], [18.75, 18.4], [24.94, 24.4], [30.96, 31.4], [38.45, 38.4], [46.9, 46.0]], "duration": 46.9}},
};
