// Textes à l'écran du Reel 16 « Votre savoir-faire », par langue. Formulations reprises de la page
// Prestataires de la landing (client/site/lib/messages/providers.ts) : réseau « en préparation »,
// « Préparer mon profil », conditions précisées avant tout engagement. Profils et mission fictifs.
// Sous-titres réécrits par align-vo.py.
window.STRINGS = {
  fr: {
    dir: 'ltr', illustrative: 'Scène illustrative', url: 'baitly.fr/prestataires',
    trades: [['broom', 'Ménage'], ['wrench', 'Dépannage'], ['shirt', 'Linge'], ['sun', 'Jardin'], ['key', 'Accueil']],
    stay: 'À chaque séjour.',
    heads: [['Vos services,', 'proposés aux hôtes.'], ['Présentez', 'votre activité.'], ['Chaque mission,', 'lue avant de s’engager.']],
    network: {
      title: 'Réseau prestataires', tabs: ['Pour les hôtes', 'Pour les voyageurs'], badge: 'En préparation',
      hosts: [['provider-1.jpg', 'Inès Martin', 'Ménage & entretien', 'Lyon 2e'], ['provider-2.jpg', 'Karim Haddad', 'Maintenance', 'Villeurbanne'], ['provider-3.jpg', 'Nora Petit', 'Blanchisserie & linge', 'Lyon 7e']],
      guests: [['provider-5.jpg', 'Claire Lemoine', 'Chef à domicile', 'Lyon'], ['host.jpg', 'Julien Roux', 'Chauffeur · transferts', 'Lyon · aéroport']],
      note: 'Profils fictifs',
    },
    profile: {
      title: 'Mon profil prestataire', step: 'Étape',
      trade: 'Votre métier', trades: ['Ménage & entretien', 'Maintenance', 'Blanchisserie', 'Jardin & piscine', 'Accueil', 'Chef & expériences'],
      zone: 'Votre zone d’intervention', zoneValue: 'Lyon · 15 km autour',
      info: 'Vos informations', siret: 'SIRET', siretValue: '912 345 678 00012', doc: 'Attestation d’assurance', docValue: 'attestation.pdf · déposée',
    },
    mission: {
      label: 'Aperçu · Mission fictive', title: 'Ménage après départ',
      rows: [['Lieu', 'Appartement Bellecour · Lyon 2e'], ['Consignes', 'Linge fourni · 2 lits · photos de fin'], ['Tarif proposé', '65 €']],
      slot: 'Jeu. 2 oct. · 11 h → 14 h', accept: 'Accepter la mission', detail: 'Voir le détail',
    },
    eyebrow: 'Réseau prestataires · En préparation',
    promise: ['Votre savoir-faire.', 'Sa place dans Baitly.'],
    cta: 'Préparer mon profil',
    facts: [['Réseau', 'en préparation'], ['Conditions', 'précisées avant tout engagement']],
    subtitles: [
      { from: 0.35, to: 3.25, text: "Ménage, dépannage, linge, jardin, ", em: "accueil…" },
      { from: 3.27, to: 8.36, text: "les hôtes en location courte durée ont besoin de vous. ", em: "À chaque séjour." },
      { from: 8.55, to: 11.93, text: "Baitly prépare son réseau de prestataires : ", em: "vos services," },
      { from: 11.95, to: 14.55, text: "proposés aux hôtes… ", em: "et à leurs voyageurs." },
      { from: 14.75, to: 17.57, text: "Présentez votre activité : votre métier, ", em: "votre zone," },
      { from: 17.59, to: 20.03, text: "et les informations utiles à votre profil.", em: "" },
      { from: 20.23, to: 23.76, text: "Au lancement, ", em: "chaque mission se lit avant de vous engager :" },
      { from: 23.78, to: 25.91, text: "le lieu, les consignes, ", em: "le tarif." },
    ],
  },
};
