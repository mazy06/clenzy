// Timeline du Reel 12 « Deux nuits de plus ». Les plans SUIVENT la voix : align-vo.py (FOLLOW)
// recale `slots` (un plan par réplique b1…b5), les moments synchronisés et la durée par langue.
// Valeurs ci-dessous = aperçu avant les voix (débit estimé de Lucie).
window.TIMELINE = {
  duration: 34,
  fps: 30,
  voiceover: [
    { id: 'b1', start: 0.4 },
    { id: 'b2', start: 6.7 },
    { id: 'b3', start: 13.3 },
    { id: 'b4', start: 18.1 },
    { id: 'b5', start: 23.8 },
    { id: 'b6', start: 26.5 },
  ],
  // msg : le message arrive · send : clic « Envoyer l'avenant » · accept : la voyageuse accepte
  // extend : la brique s'allonge · clean : le ménage se décale · code : nouveau code · end : fin.
  sync: {
    slots: [[0.2, 6.5], [6.5, 13.1], [13.1, 17.9], [17.9, 23.6], [23.6, 26.5]],
    msg: 2.2, send: 11.2, accept: 16.4, extend: 19.6, clean: 20.8, code: 22.2, end: 26.5,
  },
  lang: {"fr": {"starts": {"b1": 0.4, "b2": 7.67, "b3": 13.52, "b4": 18.94, "b5": 24.66, "b6": 27.91}, "msg": 2.57, "send": 10.83, "accept": 17.42, "extend": 20.49, "clean": 21.39, "code": 23.15, "end": 27.91, "slots": [[0.2, 7.47], [7.47, 13.32], [13.32, 18.74], [18.74, 24.46], [24.46, 27.91]], "duration": 33.7}, "en": {"starts": {"b1": 0.4, "b2": 6.2, "b3": 12.21, "b4": 17.12, "b5": 22.75, "b6": 25.86}, "msg": 2.26, "send": 9.66, "accept": 15.57, "extend": 19.0, "clean": 19.9, "code": 21.1, "end": 25.86, "slots": [[0.2, 6.0], [6.0, 12.01], [12.01, 16.92], [16.92, 22.55], [22.55, 25.86]], "duration": 31.0}},
};
