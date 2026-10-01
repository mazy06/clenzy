// Timeline du Reel 05 « Départ tardif vendu ». Source unique pour l'animation
// (index.html) et le rendu (render.mjs). Départs par défaut identiques dans les trois
// langues ; chaque réplique doit tenir dans sa fenêtre (VOIX-OFF.md). Une fois les voix
// reçues, les recalages se font par langue dans `lang` (départs + points de synchro).
window.TIMELINE = {
  duration: 34,
  fps: 30,
  voiceover: [
    { id: 'b1', start: 0.4 },
    { id: 'b2', start: 4.2 },
    { id: 'b3', start: 6.8 },
    { id: 'b4', start: 13.6 },
    { id: 'b5', start: 20.0 },
    { id: 'b6', start: 25.8 },
    { id: 'b7', start: 29.6 },
  ],
  // Points de synchro voix → image (secondes), surchargeables par langue :
  //  tapBook : tap sur « Réserver » (« il réserve ») · tapPay : tap sur « Payer »
  //  (« il paie ») · extend : la brique s'allonge (« s'est déjà replanifié »).
  sync: { tapBook: 15.9, tapPay: 17.1, extend: 22.2 },
  lang: {"fr": {"starts": {"b1": 0.4, "b2": 4.2, "b3": 6.8, "b4": 13.6, "b5": 20.0, "b6": 25.8, "b7": 29.6}, "tapBook": 17.45, "tapPay": 18.45, "extend": 21.49, "duration": 34.3}, "en": {"starts": {"b1": 0.4, "b2": 4.2, "b3": 6.8, "b4": 13.6, "b5": 20.0, "b6": 25.8, "b7": 29.6}, "tapBook": 17.15, "tapPay": 18.15, "extend": 21.4, "duration": 34.6}},
};
