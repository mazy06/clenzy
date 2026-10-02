// Timeline du Reel 17 « La mission, côté prestataire ». Les plans SUIVENT la voix : align-vo.py
// (FOLLOW) recale `slots` (un plan par réplique b1…b5), les moments synchronisés et la durée.
// Valeurs ci-dessous = aperçu avant les voix (débit estimé de Paul K, direction keynote).
window.TIMELINE = {
  duration: 37,
  fps: 30,
  voiceover: [
    { id: 'b1', start: 0.4 },
    { id: 'b2', start: 7.0 },
    { id: 'b3', start: 14.2 },
    { id: 'b4', start: 21.4 },
    { id: 'b5', start: 28.0 },
    { id: 'b6', start: 32.0 },
  ],
  // notif : la mission arrive sur le téléphone · arrive : « quinze heures » · d1-d4 : adresse,
  // accès, consignes, checklist · tick : premières cases cochées · photo : photos de fin ·
  // host : l'hôte suit l'avancement · valid : validation · pay : règlement tracé · end : fin.
  sync: {
    slots: [[0.2, 6.8], [6.8, 14.0], [14.0, 21.2], [21.2, 27.8], [27.8, 32.0]],
    notif: 2.0, arrive: 5.0, d1: 10.0, d2: 11.0, d3: 12.0, d4: 13.0,
    tick: 14.8, photo: 16.6, host: 18.4, valid: 21.8, pay: 23.6, end: 32.0,
  },
  lang: {"fr": {"starts": {"b1": 0.4, "b2": 5.47, "b3": 11.2, "b4": 16.24, "b5": 21.42, "b6": 24.96}, "notif": 1.3, "arrive": 4.33, "d1": 8.16, "d2": 8.76, "d3": 9.44, "d4": 10.26, "tick": 11.8, "photo": 13.4, "host": 14.0, "valid": 16.54, "pay": 17.89, "end": 24.96, "slots": [[0.2, 5.27], [5.27, 11.0], [11.0, 16.04], [16.04, 21.22], [21.22, 24.96]], "duration": 30.0}},
};
