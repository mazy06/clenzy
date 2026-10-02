// Textes à l'écran du Reel 17 « La mission, côté prestataire », par langue. Parcours repris de la
// page Prestataires de la landing (« Examiner une mission », « Partager le travail réalisé »,
// « Suivre la validation » ; aperçu « Consignes · Photos · Validation »). Mission fictive.
// Sous-titres réécrits par align-vo.py.
window.STRINGS = {
  fr: {
    dir: 'ltr', illustrative: 'Scène illustrative · mission fictive', url: 'baitly.fr/prestataires',
    lock: { date: 'Jeudi 2 octobre', time: '11:00', app: 'baitly', when: 'maintenant', title: 'Nouvelle mission · Ménage après départ', body: 'Appartement Bellecour · 11 h → 14 h' },
    clock: [['Départ du voyageur', '11 h 00'], ['Prochaine arrivée', '15 h 00']],
    mission: {
      title: 'Ménage après départ', prop: 'Appartement Bellecour',
      rows: [['pin', 'Adresse', '12 rue Mercière, Lyon 2e'], ['key', 'Accès', 'Boîte à clés · code 4821'], ['list', 'Consignes', 'Linge fourni · 2 lits · photos de fin'], ['clipcheck', 'Checklist', '5 étapes']],
    },
    check: { title: 'Checklist', items: ['Chambre', 'Salle d’eau', 'Cuisine', 'Linge changé', 'Photos de fin'], photos: 'Photos de fin', valid: 'Validée' },
    host: { head: 'Côté hôte', name: 'Camille · hôte', progress: 'Avancement', done: 'Mission validée · 13 h 52', rows: [['Photos jointes', '3'], ['Règlement', 'tracé']], note: 'selon les modalités convenues' },
    eyebrow: 'Réseau prestataires · En préparation',
    promise: ['Un logement prêt pour l’arrivée.', 'Un travail reconnu.'],
    cta: 'Préparer mon profil',
    facts: [['Consignes', ''], ['Photos', ''], ['Validation', '']],
    subtitles: [
      { from: 0.35, to: 2.73, text: "11 h. ", em: "Le voyageur vient de partir…" },
      { from: 2.75, to: 5.22, text: "et l'arrivée suivante est à 15 h.", em: "" },
      { from: 5.42, to: 9.12, text: "Sur votre téléphone, la mission est prête : l'adresse, ", em: "l'accès," },
      { from: 9.14, to: 10.95, text: "les consignes, ", em: "la checklist." },
      { from: 11.15, to: 12.99, text: "Vous cochez, ", em: "vous prenez les photos…" },
      { from: 13.01, to: 15.99, text: "et l'hôte suit l'avancement, ", em: "sans avoir à vous appeler." },
      { from: 16.19, to: 19.28, text: "Il valide. ", em: "La mission et son règlement restent tracés," },
      { from: 19.3, to: 21.17, text: "selon les modalités convenues.", em: "" },
    ],
  },
};
