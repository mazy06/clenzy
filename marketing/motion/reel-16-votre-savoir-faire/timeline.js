// Timeline du Reel 16 « Votre savoir-faire » (réseau prestataires). Les plans SUIVENT la voix :
// align-vo.py (FOLLOW) recale `slots` (un plan par réplique b1…b5), les moments synchronisés et la
// durée. Valeurs ci-dessous = aperçu avant les voix (débit estimé de Paul K, direction keynote).
window.TIMELINE = {
  duration: 36,
  fps: 30,
  voiceover: [
    { id: 'b1', start: 0.4 },
    { id: 'b2', start: 8.6 },
    { id: 'b3', start: 15.4 },
    { id: 'b4', start: 21.6 },
    { id: 'b5', start: 28.2 },
    { id: 'b6', start: 31.4 },
  ],
  // m : les cinq métiers, dits un à un · stay : « à chaque séjour » · guests : bascule vers les
  // voyageurs · f1-f3 : champs du profil (métier, zone, informations) · r1-r3 : lieu, consignes,
  // tarif de la mission · end : écran de fin.
  sync: {
    slots: [[0.2, 8.4], [8.4, 15.2], [15.2, 21.4], [21.4, 28.0], [28.0, 31.4]],
    m: [0.5, 1.4, 2.4, 3.2, 4.0], stay: 7.2, guests: 13.6,
    f1: 17.6, f2: 18.8, f3: 19.8, r1: 24.6, r2: 25.6, r3: 26.8, end: 31.4,
  },
  lang: {"fr": {"starts": {"b1": 0.4, "b2": 8.6, "b3": 14.8, "b4": 20.28, "b5": 26.16, "b6": 29.54}, "m": [0.4, 0.95, 1.71, 2.19, 2.74], "stay": 7.29, "guests": 13.85, "f1": 16.58, "f2": 17.38, "f3": 18.68, "r1": 24.03, "r2": 24.73, "r3": 25.45, "end": 29.54, "slots": [[0.2, 8.4], [8.4, 14.6], [14.6, 20.08], [20.08, 25.96], [25.96, 29.54]], "duration": 34.6}},
};
