// Timeline du Reel 08 « 23 h 40 » (tapage nocturne). Les plans SUIVENT la voix : align-vo.py
// (FOLLOW) recale `slots` (un plan par réplique b1…b5), les moments synchronisés et la durée par
// langue dans `lang`. Valeurs ci-dessous = aperçu avant les voix (débit estimé de Lucie).
window.TIMELINE = {
  duration: 36.5,
  fps: 30,
  voiceover: [
    { id: 'b1', start: 0.4 },
    { id: 'b2', start: 6.6 },
    { id: 'b3', start: 13.9 },
    { id: 'b4', start: 20.2 },
    { id: 'b5', start: 27.6 },
    { id: 'b6', start: 30.8 },
  ],
  // slots : [début, fin] des plans 0-4 · loud : la jauge dépasse le seuil · neigh : appel manqué
  // send : clic « Envoyer » · reply : réponse de la voyageuse · calm : la jauge redescend
  // block : clic « Bloquer » · end : écran de fin.
  sync: {
    slots: [[0.2, 6.4], [6.4, 13.7], [13.7, 20.0], [20.0, 27.4], [27.4, 30.6]],
    loud: 2.6, neigh: 5.0, send: 12.2, reply: 17.0, calm: 18.0, block: 26.4, end: 30.8,
  },
  lang: {"fr": {"starts": {"b1": 0.4, "b2": 6.41, "b3": 13.74, "b4": 20.2, "b5": 26.94, "b6": 29.73}, "loud": 4.02, "neigh": 5.27, "send": 11.06, "reply": 15.73, "calm": 17.85, "block": 23.4, "end": 29.73, "slots": [[0.2, 6.21], [6.21, 13.54], [13.54, 20.0], [20.0, 26.74], [26.74, 29.73]], "duration": 35.7}, "en": {"starts": {"b1": 0.4, "b2": 7.13, "b3": 13.24, "b4": 19.07, "b5": 25.77, "b6": 28.25}, "loud": 3.69, "neigh": 6.27, "send": 10.91, "reply": 15.25, "calm": 16.93, "block": 22.25, "end": 28.25, "slots": [[0.2, 6.93], [6.93, 13.04], [13.04, 18.87], [18.87, 25.57], [25.57, 28.25]], "duration": 33.5}},
};
