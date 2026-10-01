// Timeline du Reel 10 « Après le départ ». Les plans SUIVENT la voix : align-vo.py (FOLLOW)
// recale `slots` (un plan par réplique b1…b5), les moments synchronisés et la durée par langue.
// Valeurs ci-dessous = aperçu avant les voix (débit estimé de Lucie).
window.TIMELINE = {
  duration: 38,
  fps: 30,
  voiceover: [
    { id: 'b1', start: 0.4 },
    { id: 'b2', start: 6.6 },
    { id: 'b3', start: 14.2 },
    { id: 'b4', start: 21.5 },
    { id: 'b5', start: 28.8 },
    { id: 'b6', start: 31.7 },
  ],
  // approve : clic « Valider » · flag : dégât signalé sur une photo · withhold : clic « Retenir »
  // pay : clic « Verser » · order : clic « Commander » · end : écran de fin.
  sync: {
    slots: [[0.2, 6.4], [6.4, 14.0], [14.0, 21.3], [21.3, 28.6], [28.6, 31.7]],
    approve: 10.2, flag: 11.8, withhold: 17.6, pay: 23.4, order: 26.4, end: 31.7,
  },
  lang: {"fr": {"starts": {"b1": 0.4, "b2": 6.56, "b3": 14.26, "b4": 22.3, "b5": 29.65, "b6": 32.42}, "approve": 10.22, "flag": 11.97, "withhold": 16.26, "pay": 24.1, "order": 27.82, "end": 32.42, "slots": [[0.2, 6.36], [6.36, 14.06], [14.06, 22.1], [22.1, 29.45], [29.45, 32.42]], "duration": 38.4}, "en": {"starts": {"b1": 0.4, "b2": 6.76, "b3": 13.23, "b4": 20.42, "b5": 26.08, "b6": 29.63}, "approve": 9.44, "flag": 11.08, "withhold": 15.23, "pay": 22.22, "order": 24.42, "end": 29.63, "slots": [[0.2, 6.56], [6.56, 13.03], [13.03, 20.22], [20.22, 25.88], [25.88, 29.63]], "duration": 34.0}},
};
