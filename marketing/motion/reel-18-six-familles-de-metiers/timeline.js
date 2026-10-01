// Timeline du Reel 18 « Six familles de métiers ». Les plans SUIVENT la voix : align-vo.py
// (FOLLOW) recale `slots` (un plan par réplique b1…b5), les moments synchronisés et la durée.
// Valeurs ci-dessous = aperçu avant les voix (débit estimé de Paul K, direction keynote).
window.TIMELINE = {
  duration: 34,
  fps: 30,
  voiceover: [
    { id: 'b1', start: 0.4 },
    { id: 'b2', start: 4.6 },
    { id: 'b3', start: 11.0 },
    { id: 'b4', start: 17.2 },
    { id: 'b5', start: 23.6 },
    { id: 'b6', start: 27.4 },
  ],
  // c1-c6 : chaque famille, dite une à une · hosts / guests : pour les hôtes, pour leurs
  // voyageurs · end : écran de fin.
  sync: {
    slots: [[0.2, 4.4], [4.4, 10.8], [10.8, 17.0], [17.0, 23.4], [23.4, 27.4]],
    c1: 4.7, c2: 6.6, c3: 8.8, c4: 11.1, c5: 12.9, c6: 14.9, hosts: 20.0, guests: 21.6, end: 27.4,
  },
  lang: {"fr": {"starts": {"b1": 0.4, "b2": 3.94, "b3": 8.5, "b4": 13.37, "b5": 18.31, "b6": 21.15}, "c1": 3.94, "c2": 5.12, "c3": 6.86, "c4": 8.5, "c5": 9.84, "c6": 11.61, "hosts": 16.27, "guests": 17.41, "end": 21.15, "slots": [[0.2, 3.74], [3.74, 8.3], [8.3, 13.17], [13.17, 18.11], [18.11, 21.15]], "duration": 26.1}},
};
