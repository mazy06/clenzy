// Timeline du Reel 06 « Arabie saoudite » (arabe uniquement). Départs par défaut des
// répliques (fenêtres : VOIX-OFF.md) ; recalage dans `lang.ar` une fois la voix reçue.
window.TIMELINE = {
  duration: 47,
  fps: 30,
  voiceover: [
    { id: 'b1', start: 0.4 },
    { id: 'b2', start: 3.6 },
    { id: 'b3', start: 9.3 },
    { id: 'b4', start: 17.0 },
    { id: 'b5', start: 25.3 },
    { id: 'b6', start: 32.4 },   // 1 s de musique seule après l'arrivée du planning (31,4 s)
    { id: 'b7', start: 39.5 },
  ],
  // parisOut : la photo de Paris sort du cadre · submit : tap « إرسال إلى شموس »
  // lines : lignes de la facture · qr : QR ZATCA · pay : tap « ادفع » · flip : bascule RTL
  // hijri : dates hégiriennes · end : écran de fin.
  sync: { parisOut: 6.6, submit: 12.4, lines: [18.4, 19.5, 21.0, 22.6], qr: 23.4, pay: 28.0, flip: 34.1, hijri: 36.0, end: 42.8 },
  lang: {},
};
