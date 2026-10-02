// Timeline du Reel 02 « Une seule vérité ». Départs par défaut identiques dans les trois
// langues (fenêtres : VOIX-OFF.md) ; recalage par langue dans `lang` une fois les voix reçues.
window.TIMELINE = {
  duration: 32,
  fps: 30,
  voiceover: [
    { id: 'b1', start: 0.4 },
    { id: 'b2', start: 3.3 },
    { id: 'b3', start: 6.5 },
    { id: 'b4', start: 10.5 },
    { id: 'b5', start: 13.7 },
    { id: 'b6', start: 20.6 },
    { id: 'b7', start: 25.7 },
  ],
  // drop : la réservation Airbnb se pose · close : les autres canaux se ferment
  // (« se ferment partout ailleurs ») · offline : un canal tombe · end : écran de fin.
  sync: { drop: 14.2, close: 16.6, offline: 21.4, end: 27.4 },
  lang: {"fr": {"starts": {"b1": 0.4, "b2": 3.87, "b3": 7.09, "b4": 10.93, "b5": 13.7, "b6": 20.6, "b7": 25.7}, "drop": 14.46, "close": 17.97, "offline": 21.41, "end": 28.2}, "en": {"starts": {"b1": 0.4, "b2": 3.7, "b3": 7.26, "b4": 10.85, "b5": 13.7, "b6": 20.6, "b7": 25.7}, "drop": 14.28, "close": 17.99, "offline": 21.34, "end": 28.8, "duration": 33.5}},
};
