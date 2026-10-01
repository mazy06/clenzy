// Timeline du Reel 15 « Les cartes de la journée ». Les plans SUIVENT la voix : align-vo.py
// (FOLLOW) recale `slots` (un plan par réplique b1…b6), les moments synchronisés et la durée.
// La pile de cartes traverse les plans 1 à 4 : chaque carte entre après le clic de la précédente.
// Valeurs ci-dessous = aperçu avant les voix (débit estimé de Noé).
window.TIMELINE = {
  duration: 42.5,
  fps: 30,
  voiceover: [
    { id: 'b1', start: 0.4 },
    { id: 'b2', start: 4.4 },
    { id: 'b3', start: 9.4 },
    { id: 'b4', start: 14.6 },
    { id: 'b5', start: 20.7 },
    { id: 'b6', start: 25.9 },
    { id: 'b7', start: 35.6 },
    { id: 'b8', start: 38.2 },
  ],
  // k1…k6 : clic sur la carte 1…6 · thermo : le thermostat passe de 17 à 21 °C · rest : la pile
  // est vide · trust : clic « Activer » (règle de confiance) · auto1 / auto2 : ménage → Auto,
  // caution → Agir puis notifier · lock : remboursements verrouillés · end : écran de fin.
  sync: {
    slots: [[0.2, 4.2], [4.2, 9.2], [9.2, 14.4], [14.4, 20.5], [20.5, 25.7], [25.7, 35.4], [35.4, 38.2]],
    k1: 6.2, k2: 8.4, k3: 11.2, k4: 13.4, thermo: 16.4, k5: 19.4, k6: 23.0, rest: 24.6,
    trust: 28.6, auto1: 30.2, auto2: 31.4, lock: 33.2, end: 38.2,
  },
  lang: {"fr": {"starts": {"b1": 0.4, "b2": 4.4, "b3": 8.94, "b4": 14.6, "b5": 20.7, "b6": 25.5, "b7": 35.65, "b8": 38.19}, "k1": 6.33, "k2": 8.34, "k3": 10.24, "k4": 13.34, "thermo": 16.92, "k5": 19.32, "k6": 22.77, "rest": 24.07, "trust": 28.43, "auto1": 29.63, "auto2": 30.63, "lock": 32.27, "end": 38.19, "slots": [[0.2, 4.2], [4.2, 8.74], [8.74, 14.4], [14.4, 20.5], [20.5, 25.3], [25.3, 35.45], [35.45, 38.19]], "duration": 43.1}, "en": {"starts": {"b1": 0.4, "b2": 5.51, "b3": 11.18, "b4": 17.5, "b5": 24.42, "b6": 29.86, "b7": 40.41, "b8": 44.47}, "k1": 7.8, "k2": 10.6, "k3": 12.59, "k4": 16.0, "thermo": 20.16, "k5": 22.8, "k6": 26.77, "rest": 28.07, "trust": 33.01, "auto1": 34.21, "auto2": 35.21, "lock": 37.25, "end": 44.47, "slots": [[0.2, 5.31], [5.31, 10.98], [10.98, 17.3], [17.3, 24.22], [24.22, 29.66], [29.66, 40.21], [40.21, 44.47]], "duration": 49.8}},
};
