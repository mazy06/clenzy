// Timeline du Reel 14 « Le propriétaire inquiet ». Les plans SUIVENT la voix : align-vo.py
// (FOLLOW) recale `slots` (un plan par réplique b1…b5), les moments synchronisés et la durée.
// Valeurs ci-dessous = aperçu avant les voix (débit estimé de Lucie).
window.TIMELINE = {
  duration: 37,
  fps: 30,
  voiceover: [
    { id: 'b1', start: 0.4 },
    { id: 'b2', start: 6.4 },
    { id: 'b3', start: 14.2 },
    { id: 'b4', start: 19.8 },
    { id: 'b5', start: 25.5 },
    { id: 'b6', start: 28.5 },
  ],
  // ring : le téléphone du propriétaire sonne · send : clic « Envoyer la note » · dl : relevé
  // téléchargé · reply : réponse du propriétaire · approve : clic « Approuver » · end : fin.
  sync: {
    slots: [[0.2, 6.2], [6.2, 14.0], [14.0, 19.6], [19.6, 25.3], [25.3, 28.5]],
    ring: 3.4, send: 12.2, dl: 16.0, reply: 17.6, approve: 23.2, end: 28.5,
  },
  lang: {"fr": {"starts": {"b1": 0.4, "b2": 5.95, "b3": 13.98, "b4": 19.26, "b5": 23.69, "b6": 28.09}, "ring": 2.11, "send": 12.49, "dl": 15.6, "reply": 18.13, "approve": 21.9, "end": 28.09, "slots": [[0.2, 5.75], [5.75, 13.78], [13.78, 19.06], [19.06, 23.49], [23.49, 28.09]], "duration": 34.0}, "en": {"starts": {"b1": 0.4, "b2": 6.4, "b3": 14.42, "b4": 19.2, "b5": 25.09, "b6": 28.49}, "ring": 2.76, "send": 13.21, "dl": 15.71, "reply": 18.33, "approve": 22.8, "end": 28.49, "slots": [[0.2, 6.2], [6.2, 14.22], [14.22, 19.0], [19.0, 24.89], [24.89, 28.49]], "duration": 32.9}},
};
