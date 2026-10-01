// Timeline du Reel 13 « Le direct, sans les risques ». Les plans SUIVENT la voix : align-vo.py
// (FOLLOW) recale `slots` (un plan par réplique b1…b5), les moments synchronisés et la durée.
// Valeurs ci-dessous = aperçu avant les voix (débit estimé de Noé).
window.TIMELINE = {
  duration: 34,
  fps: 30,
  voiceover: [
    { id: 'b1', start: 0.4 },
    { id: 'b2', start: 5.8 },
    { id: 'b3', start: 11.5 },
    { id: 'b4', start: 17.2 },
    { id: 'b5', start: 24.6 },
    { id: 'b6', start: 27.3 },
  ],
  // leave : le visiteur quitte le paiement · send : clic « Envoyer la relance » · back : la
  // réservation revient · block : clic « Bloquer » · submit : clic « Déposer le dossier » · end : fin.
  sync: {
    slots: [[0.2, 5.6], [5.6, 11.3], [11.3, 17.0], [17.0, 24.4], [24.4, 27.3]],
    leave: 3.6, send: 8.0, back: 10.0, block: 15.4, submit: 22.8, end: 27.3,
  },
  lang: {"fr": {"starts": {"b1": 0.4, "b2": 5.99, "b3": 11.5, "b4": 16.31, "b5": 23.52, "b6": 25.74}, "leave": 4.54, "send": 7.79, "back": 10.16, "block": 14.54, "submit": 21.99, "end": 25.74, "slots": [[0.2, 5.79], [5.79, 11.3], [11.3, 16.11], [16.11, 23.32], [23.32, 25.74]], "duration": 30.8}, "en": {"starts": {"b1": 0.4, "b2": 7.34, "b3": 14.57, "b4": 19.74, "b5": 28.71, "b6": 31.13}, "leave": 5.47, "send": 9.14, "back": 12.59, "block": 17.97, "submit": 26.6, "end": 31.13, "slots": [[0.2, 7.14], [7.14, 14.37], [14.37, 19.54], [19.54, 28.51], [28.51, 31.13]], "duration": 36.3}},
};
