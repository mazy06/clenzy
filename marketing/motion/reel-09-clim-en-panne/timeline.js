// Timeline du Reel 09 « La clim en panne ». Les plans SUIVENT la voix : align-vo.py (FOLLOW)
// recale `slots` (un plan par réplique b1…b5), les moments synchronisés et la durée par langue.
// Valeurs ci-dessous = aperçu avant les voix (débit estimé de Noé).
window.TIMELINE = {
  duration: 33,
  fps: 30,
  voiceover: [
    { id: 'b1', start: 0.4 },
    { id: 'b2', start: 5.6 },
    { id: 'b3', start: 10.8 },
    { id: 'b4', start: 17.6 },
    { id: 'b5', start: 25.4 },
    { id: 'b6', start: 28.0 },
  ],
  // broken : la clim passe « hors service » · fixed : mission terminée, la température redescend
  // refund : clic « Rembourser » · draft : brouillon de l'agent · insert : clic « Insérer »
  // edit : un mot corrigé · publish : clic « Publier » · end : écran de fin.
  sync: {
    slots: [[0.2, 5.4], [5.4, 10.6], [10.6, 17.4], [17.4, 25.2], [25.2, 27.8]],
    broken: 3.6, fixed: 8.6, refund: 15.0, draft: 20.0, insert: 21.6, edit: 22.6, publish: 23.8, end: 28.0,
  },
  lang: {"en": {"starts": {"b1": 0.4, "b2": 7.5, "b3": 13.44, "b4": 21.41, "b5": 31.53, "b6": 33.67}, "broken": 6.75, "fixed": 11.08, "refund": 19.32, "draft": 25.86, "insert": 27.24, "edit": 28.14, "publish": 29.14, "end": 33.67, "slots": [[0.2, 7.3], [7.3, 13.24], [13.24, 21.21], [21.21, 31.33], [31.33, 33.67]], "duration": 38.7}, "fr": {"starts": {"b1": 0.4, "b2": 5.6, "b3": 10.27, "b4": 16.18, "b5": 24.22, "b6": 26.36}, "broken": 4.93, "fixed": 8.22, "refund": 14.45, "draft": 19.21, "insert": 20.54, "edit": 21.44, "publish": 22.44, "end": 26.36, "slots": [[0.2, 5.4], [5.4, 10.07], [10.07, 15.98], [15.98, 24.02], [24.02, 26.36]], "duration": 31.3}},
};
