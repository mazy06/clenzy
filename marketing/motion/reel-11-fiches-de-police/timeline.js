// Timeline du Reel 11 « Les fiches de police ». Les plans SUIVENT la voix : align-vo.py (FOLLOW)
// recale `slots` (un plan par réplique b1…b5), les moments synchronisés et la durée par langue.
// Valeurs ci-dessous = aperçu avant les voix (débit estimé de Noé).
window.TIMELINE = {
  duration: 38,
  fps: 30,
  voiceover: [
    { id: 'b1', start: 0.4 },
    { id: 'b2', start: 5.0 },
    { id: 'b3', start: 11.0 },
    { id: 'b4', start: 18.8 },
    { id: 'b5', start: 26.8 },
    { id: 'b6', start: 29.8 },
  ],
  // send : le voyageur envoie sa fiche · ma / fr / sa : onglet Maroc / France / Arabie saoudite
  // (clic « Télédéclarer » sur ma) · tax / zatca / ntmp / gdpr : tuiles qui s'allument
  // filed : clic « Marquer déclarée » · end : écran de fin.
  sync: {
    slots: [[0.2, 4.8], [4.8, 10.8], [10.8, 18.6], [18.6, 26.6], [26.6, 29.8]],
    send: 9.6, ma: 11.6, fr: 13.6, sa: 15.6, tax: 19.8, zatca: 21.6, ntmp: 23.0, gdpr: 24.2, filed: 25.0, end: 29.8,
  },
  lang: {"fr": {"starts": {"b1": 0.4, "b2": 5.0, "b3": 10.97, "b4": 19.97, "b5": 28.63, "b6": 31.18}, "send": 8.72, "ma": 11.97, "fr": 13.17, "sa": 15.31, "tax": 21.15, "zatca": 24.69, "ntmp": 25.61, "gdpr": 26.74, "filed": 23.14, "end": 31.18, "slots": [[0.2, 4.8], [4.8, 10.77], [10.77, 19.77], [19.77, 28.43], [28.43, 31.18]], "duration": 36.3}, "en": {"starts": {"b1": 0.4, "b2": 6.67, "b3": 13.57, "b4": 26.34, "b5": 35.09, "b6": 39.42}, "send": 10.59, "ma": 14.57, "fr": 16.68, "sa": 19.88, "tax": 28.38, "zatca": 30.19, "ntmp": 31.99, "gdpr": 33.08, "filed": 29.95, "end": 39.42, "slots": [[0.2, 6.47], [6.47, 13.37], [13.37, 26.14], [26.14, 34.89], [34.89, 39.42]], "duration": 44.0}},
};
