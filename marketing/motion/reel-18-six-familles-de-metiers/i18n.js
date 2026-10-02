// Textes à l'écran du Reel 18 « Six familles de métiers », par langue. Les six familles et leurs
// exemples sont ceux de la page Prestataires de la landing (client/site/lib/messages/providers.ts).
// Les photos illustrent les métiers, sans représenter des prestataires inscrits. Sous-titres
// réécrits par align-vo.py.
window.STRINGS = {
  fr: {
    dir: 'ltr', illustrative: 'Photos d’illustration', url: 'baitly.fr/prestataires',
    open: ['Derrière chaque séjour réussi,', 'des savoir-faire.'],
    families: [
      { photo: 'menage.jpg', icon: 'broom', name: 'Ménage & entretien', ex: ['Ménage entre deux séjours', 'Remise en état', 'Réassort'], who: 'h' },
      { photo: 'maintenance.jpg', icon: 'wrench', name: 'Maintenance & petits travaux', ex: ['Plomberie', 'Électricité', 'Dépannage urgent'], who: 'h' },
      { photo: 'blanchisserie.jpg', icon: 'shirt', name: 'Blanchisserie & linge', ex: ['Collecte', 'Lavage', 'Livraison du linge'], who: 'h' },
      { photo: 'pool.jpg', icon: 'drops', name: 'Jardin & piscine', ex: ['Espaces verts', 'Piscine', 'Traitement de l’eau'], who: 'h' },
      { photo: 'guesthouse.jpg', icon: 'key', name: 'Accueil & conciergerie', ex: ['Check-in en personne', 'Remise des clés', 'Assistance'], who: 'h' },
      { photo: 'chef.jpg', icon: 'sparkles', name: 'Chef & expériences', ex: ['Chef à domicile', 'Transferts', 'Activités'], who: 'g' },
    ],
    tags: ['Pour les hôtes', 'Pour leurs voyageurs'],
    eyebrow: 'Réseau prestataires · En préparation',
    promise: ['Construisons la suite', 'avec votre métier.'],
    cta: 'Préparer mon profil',
    facts: [['6', 'familles de métiers'], ['Réseau', 'en préparation']],
    subtitles: [
      { from: 0.35, to: 3.69, text: "Derrière chaque séjour réussi, ", em: "il y a des savoir-faire." },
      { from: 3.89, to: 6.77, text: "Ménage et entretien. ", em: "Maintenance et petits travaux." },
      { from: 6.79, to: 8.25, text: "Blanchisserie et linge.", em: "" },
      { from: 8.45, to: 13.12, text: "Jardin et piscine. Accueil et conciergerie. ", em: "Chef et expériences." },
      { from: 13.32, to: 16.58, text: "Six familles de services, ", em: "que Baitly prépare pour les hôtes…" },
      { from: 16.6, to: 18.06, text: "et pour leurs voyageurs.", em: "" },
    ],
  },
};
