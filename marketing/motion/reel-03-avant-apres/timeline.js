// Timeline du Reel 03 « Avant / après » (écran scindé : haut = Sans, bas = Avec Baitly).
// Départs par défaut identiques dans les trois langues (fenêtres : VOIX-OFF.md) ;
// recalage par langue dans `lang` une fois les voix reçues.
window.TIMELINE = {
  duration: 46,
  fps: 30,
  voiceover: [
    { id: 'b1', start: 0.4 },
    { id: 'b2', start: 4.2 },
    { id: 'b3', start: 12.2 },
    { id: 'b4', start: 20.2 },
    { id: 'b5', start: 28.2 },
    { id: 'b6', start: 36.2 },
    { id: 'b7', start: 40.8 },
  ],
  // Quatre moments de la journée (8 h, 11 h, 16 h, 19 h) : [début, fin] de chaque plan.
  // nt : arrivée des trois demandes de code wifi (8 h).
  // send : envoi de la réponse wifi · extend : la brique s'allonge (départ tardif)
  // approve : clic sur « Approuver » · welcome : la photo d'accueil passe au net
  // merge : le panneau « Sans » se replie · end : écran de fin.
  sync: {
    slots: [[4, 12], [12, 20], [20, 28], [28, 36]],
    nt: [4.6, 6.6, 8.2], send: 9.8, extend: 15.4, approve: 25.6, welcome: 32.4, merge: 36.2, end: 41.2,
  },
  lang: {"fr": {"starts": {"b1": 0.4, "b2": 4.2, "b3": 12.2, "b4": 19.8, "b5": 27.04, "b6": 34.88, "b7": 38.53}, "nt": [5.47, 8.23, 10.36], "send": 10.82, "extend": 15.89, "approve": 25.57, "welcome": 32.14, "merge": 34.68, "end": 38.53, "slots": [[4.0, 12.0], [12.0, 19.6], [19.6, 26.84], [26.84, 34.68]], "duration": 44.8}, "en": {"starts": {"b1": 0.4, "b2": 3.82, "b3": 12.2, "b4": 18.17, "b5": 25.74, "b6": 33.16, "b7": 36.94}, "nt": [4.97, 7.66, 10.35], "send": 10.82, "extend": 14.83, "approve": 24.22, "welcome": 30.64, "merge": 32.96, "end": 36.94, "slots": [[3.62, 12.0], [12.0, 17.97], [17.97, 25.54], [25.54, 32.96]], "duration": 41.9}},
};
