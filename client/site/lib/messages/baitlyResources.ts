import type { SiteLanguage } from '../siteLanguage';
import type { ResourceKind } from '../../data/baitlyResources';

interface Reading {
  title: string;
  category: string;
  intro: string;
  sections: { title: string; copy: string }[];
  takeaway: string;
}
interface Lesson extends Reading {
  question: string;
  answers: string[];
  correct: number;
  explanation: string;
}
export interface ResourceMessages {
  hero: {
    eyebrow: string;
    title: string;
    accent: string;
    intro: string;
    action: string;
    secondary: string;
    caption: string;
    note: string;
  };
  library: string;
  libraryCopy: string;
  open: string;
  all: string;
  back: string;
  source: string;
  reset: string;
  search: string;
  empty: string;
  results: string;
  related: string;
  cta: { title: string; copy: string; action: string };
  modules: Record<
    ResourceKind,
    { name: string; copy: string; tag: string; title: string; intro: string }
  >;
  calc: {
    inputs: string;
    output: string;
    currency: string;
    period: string;
    fields: string[];
    labels: string[];
    note: string;
    example: string;
    method: string;
    formulas: string[];
    breakEven: string;
    unreachable: string;
    download: string;
    invalid: string;
    nights: string;
    costHint: string;
    netHint: string;
  };
  market: {
    period: string;
    published: string;
    scope: string;
    city: string;
    growth: string;
    national: string;
    comparison: string;
    methodology: string;
    methodCopy: string;
    use: string;
    useCopy: string;
    sourceName: string;
    points: string;
    unavailable: string;
  };
  guide: {
    countries: string[];
    intro: string;
    progress: string;
    checked: string;
    session: string;
    download: string;
    verified: string;
    steps: { title: string; copy: string; action: string }[][];
  };
  academy: {
    select: string;
    lesson: string;
    quiz: string;
    check: string;
    success: string;
    retry: string;
    completed: string;
    session: string;
    next: string;
    lessons: Lesson[];
  };
  blog: {
    read: string;
    close: string;
    takeaway: string;
    byline: string;
    articles: Reading[];
  };
  glossary: {
    search: string;
    categories: string[];
    translations: string;
    definition: string;
  };
}

const fr: ResourceMessages = {
  hero: {
    eyebrow: 'LA BIBLIOTHÈQUE BAITLY',
    title: 'Moins d’hésitations.',
    accent: 'Plus de bonnes décisions.',
    intro:
      'Des outils à essayer. Des repères à garder. Tout pour faire grandir votre activité, une décision à la fois.',
    action: 'Explorer les ressources',
    secondary: 'Calculer mes revenus',
    caption: 'L’hospitalité s’apprend aussi sur le terrain.',
    note: 'En accès libre · Sans inscription · FR / EN / AR',
  },
  library: 'Votre prochaine étape commence ici.',
  libraryCopy:
    'Comprendre un chiffre, préparer une arrivée ou construire votre stratégie : choisissez votre point de départ.',
  open: 'Explorer',
  all: 'Tout voir',
  back: 'Toutes les ressources',
  source: 'Consulter la source',
  reset: 'Réinitialiser',
  search: 'Rechercher une ressource',
  empty: 'Aucun résultat. Essayez un autre mot ou effacez les filtres.',
  results: 'résultats',
  related: 'Pour aller plus loin',
  cta: {
    title: 'Du savoir-faire au faire.',
    copy: 'Réunissez vos réservations, vos équipes et vos revenus dans Baitly.',
    action: 'Découvrir Baitly',
  },
  modules: {
    calculateur: {
      name: 'Calculateur de revenus',
      copy: 'Vos prix, vos charges, votre scénario. Voyez ce qu’il reste vraiment.',
      tag: 'Outil interactif',
      title: 'Mettez vos hypothèses à l’épreuve.',
      intro:
        'Ajustez le prix par nuit, l’occupation et vos charges. Le résultat évolue avec vous.',
    },
    barometre: {
      name: 'Baromètre du tourisme',
      copy: 'Les tendances de six destinations marocaines, avec leurs sources.',
      tag: 'Données publiques',
      title: 'Un peu de recul sur votre marché.',
      intro:
        'Explorez l’évolution des nuitées dans les hébergements classés au Maroc.',
    },
    obligations: {
      name: 'Guide des obligations',
      copy: 'Les premières vérifications, pays par pays, et les bons interlocuteurs.',
      tag: 'Guide pratique',
      title: 'Préparez votre activité, étape par étape.',
      intro:
        'Maroc, France, Arabie saoudite : une liste de vérifications pour démarrer vos démarches.',
    },
    academie: {
      name: 'Académie Baitly',
      copy: 'Des formations vidéo de 2 à 3 minutes, avec des exemples chiffrés.',
      tag: 'Formations vidéo',
      title: 'Le métier, expliqué simplement.',
      intro:
        'Des formations vidéo de 2 à 3 minutes : des exemples chiffrés, les pièges à éviter et ce qu’il faut en faire. En accès libre, sans inscription.',
    },
    blog: {
      name: 'Le carnet Baitly',
      copy: 'Des méthodes de terrain pour mieux accueillir et mieux piloter.',
      tag: 'Articles',
      title: 'Les bonnes idées méritent de circuler.',
      intro:
        'Des lectures courtes et des actions concrètes à tester dans votre activité.',
    },
    glossaire: {
      name: 'Glossaire FR / EN / AR',
      copy: 'ADR, RevPAR, pacing… les mots du métier, enfin clairs.',
      tag: 'Lexique',
      title: 'Le métier, dans votre langue.',
      intro:
        'Cherchez un terme, comprenez sa définition et retrouvez sa traduction.',
    },
  },
  calc: {
    inputs: 'Votre scénario mensuel',
    output: 'Votre estimation',
    currency: 'Devise',
    period: 'par mois · ensemble des logements',
    fields: [
      'Nombre de logements',
      'Nuits disponibles / logement',
      'Occupation estimée (%)',
      'Prix moyen / nuit',
      'Commission sur l’hébergement (%)',
      'Charges / nuit occupée',
      'Charges fixes / mois',
      'Marge extras / nuit occupée',
    ],
    labels: [
      'Revenus hébergement',
      'Marge des extras',
      'Commissions',
      'Charges d’exploitation',
      'Solde avant impôts et financement',
    ],
    note: 'Simulation à partir de vos hypothèses, sans données de marché ni garantie de revenus. Taxe de séjour, TVA, impôts, financement et investissement ne sont pas calculés. Les extras sont saisis en marge après leurs coûts.',
    example:
      'Valeurs de départ et conversions illustratives, à remplacer par vos propres hypothèses. La rotation des devises se met en pause pendant la saisie.',
    method: 'Comment est calculé le résultat ?',
    formulas: [
      'Nuits occupées = nuits disponibles × taux d’occupation.',
      'Hébergement = nuits occupées × prix moyen × nombre de logements.',
      'Solde = hébergement + marge extras − commissions − charges variables − charges fixes.',
    ],
    breakEven: 'Occupation au point d’équilibre',
    unreachable: 'Non atteignable avec ces hypothèses',
    download: 'Exporter mon scénario (.csv)',
    invalid:
      'Saisissez des nombres dans les limites indiquées pour afficher le résultat.',
    nights: 'nuits occupées / logement',
    costHint:
      'Charges et marge extras par logement. Incluez notamment ménage, énergie, entretien et gestion dans vos coûts.',
    netHint: 'Ce solde n’est pas un bénéfice net fiscal.',
  },
  market: {
    period: 'Janvier à juin 2026 · vs la même période de 2025',
    published: 'Publication : 1 septembre 2026',
    scope: 'Maroc · Hébergements classés',
    city: 'Destination à explorer',
    growth: 'Évolution des nuitées',
    national: 'Maroc, ensemble du pays',
    comparison: 'Repères par destination',
    methodology: 'Ce que disent ces chiffres',
    methodCopy:
      'Variation des nuitées dans les établissements d’hébergement classés, rapportée par la DEPF et publiée sur Maroc.ma. Sélection de six villes issue de la même publication ; mise à jour éditoriale, sans flux en temps réel.',
    use: 'Et pour votre logement ?',
    useCopy:
      'Ce contexte touristique ne mesure ni le prix moyen ni l’occupation des locations de courte durée. Construisez votre scénario à partir de vos propres réservations et de biens réellement comparables.',
    sourceName: 'Maroc.ma · DEPF / MAP',
    points: 'points par rapport au niveau national',
    unavailable:
      'ADR et occupation des locations courte durée : non disponibles dans cette publication.',
  },
  guide: {
    countries: ['Maroc', 'France', 'Arabie saoudite'],
    intro:
      'Repères généraux à vérifier selon votre commune, votre statut et votre type d’hébergement. Cette liste n’est ni exhaustive ni un avis juridique personnalisé.',
    progress: 'Votre préparation',
    checked: 'vérifications effectuées',
    session:
      'Vos coches restent dans cette page. Exportez votre liste avant de la quitter.',
    download: 'Exporter ma liste (.txt)',
    verified: 'Sources consultées le 24 septembre 2026',
    steps: [
      [
        {
          title: 'Qualifier votre hébergement',
          copy: 'Identifiez la catégorie de votre établissement et les autorisations à demander auprès des services locaux du tourisme.',
          action: 'Noter la catégorie et le contact territorial compétent.',
        },
        {
          title: 'Préparer le dossier d’exploitation',
          copy: 'La loi 80-14 encadre les établissements et autres formes d’hébergement touristique. Vérifiez les textes d’application correspondant à votre activité.',
          action:
            'Faire confirmer les pièces et conditions applicables à votre dossier.',
        },
        {
          title: 'Organiser l’accueil et le suivi',
          copy: 'Vérifiez auprès de l’autorité compétente les formalités voyageurs et les règles propres à votre établissement.',
          action:
            'Documenter les formalités, les responsables et leur fréquence ; valider la fiscalité avec votre conseil.',
        },
      ],
      [
        {
          title: 'Vérifier les règles locales',
          copy: 'Les démarches varient selon la résidence et la commune. Vérifiez déclaration, enregistrement et éventuel changement d’usage auprès de la mairie.',
          action: 'Demander la procédure correspondant à votre adresse.',
        },
        {
          title: 'Formaliser chaque réservation',
          copy: 'Préparez un contrat écrit précisant le logement, les dates, le prix et les conditions de paiement et d’annulation.',
          action:
            'Relire votre modèle de contrat et vos informations d’annonce.',
        },
        {
          title: 'Préparer le suivi fiscal',
          copy: 'Les revenus de location meublée doivent être déclarés. Le régime dépend de votre situation.',
          action:
            'Faire valider votre régime et la collecte éventuelle de taxe de séjour.',
        },
      ],
      [
        {
          title: 'Vérifier votre licence',
          copy: 'Le ministère du Tourisme exige une licence valide pour les hébergements proposés sur les plateformes de réservation.',
          action:
            'Vérifier la catégorie de licence et sa validité auprès du ministère.',
        },
        {
          title: 'Qualifier vos obligations de facturation',
          copy: 'Consultez ZATCA pour déterminer si votre activité relève de la facturation électronique et de quelle phase.',
          action:
            'Confirmer votre situation fiscale et les échéances qui vous concernent.',
        },
        {
          title: 'Préparer votre système de facturation',
          copy: 'Les guides ZATCA détaillent les exigences de génération et d’intégration des factures électroniques.',
          action:
            'Tester votre solution avec votre conseil ; confirmer aussi les obligations locales de déclaration des voyageurs.',
        },
      ],
    ],
  },
  academy: {
    select: 'Votre parcours',
    lesson: 'Leçon',
    quiz: 'À vous de jouer',
    check: 'Vérifier ma réponse',
    success: 'Bien vu. Leçon validée !',
    retry: 'Pas tout à fait. Réessayez.',
    completed: 'leçons validées',
    session: 'Progression conservée tant que cette page reste ouverte.',
    next: 'Leçon suivante',
    lessons: [
      {
        title: 'Choisir un prix qui tient la route',
        category: 'Revenus',
        intro:
          'Un calendrier plein ne suffit pas : chaque nuit doit contribuer à vos charges.',
        sections: [
          {
            title: 'Séparez vos coûts',
            copy: 'Listez les coûts fixes mensuels (loyer, logiciel, assurance) puis les coûts liés aux nuits ou aux séjours (linge, ménage, consommables). Ramenez les coûts par séjour à votre durée moyenne de séjour.',
          },
          {
            title: 'Calculez la contribution',
            copy: 'Pour une nuit à 100, avec 15 % de commission et 20 de coûts variables, il reste 65 pour couvrir les coûts fixes. Avec 650 de coûts fixes, il faut vendre 10 nuits pour les couvrir, hors impôts et financement.',
          },
          {
            title: 'Comparez les scénarios',
            copy: 'Simulez un mois calme et un mois chargé. Un prix plus bas peut remplir le calendrier sans améliorer le solde. Gardez votre plancher et comparez des logements de capacité et de qualité similaires.',
          },
        ],
        takeaway:
          'Cette semaine : calculez votre contribution par nuit et votre seuil d’équilibre.',
        question:
          '100 de prix, 15 % de commission, 20 de coûts variables : quelle contribution par nuit ?',
        answers: ['85', '65', '100'],
        correct: 1,
        explanation:
          '100 − 15 − 20 = 65. Les coûts fixes, impôts et financement restent à couvrir.',
      },
      {
        title: 'Vendre un service vraiment utile',
        category: 'Ventes additionnelles',
        intro:
          'Un bon extra résout un besoin du voyageur au moment où il se présente.',
        sections: [
          {
            title: 'Partez du séjour',
            copy: 'Une arrivée tardive peut justifier un transfert. Un séjour en famille peut appeler un petit-déjeuner livré. Commencez par les demandes que vous recevez déjà, puis choisissez un seul service facile à opérer.',
          },
          {
            title: 'Rendez l’offre lisible',
            copy: 'Affichez un prix complet, ce qui est inclus, le délai de réservation et les conditions d’annulation. Laissez un choix explicite : le voyageur doit pouvoir continuer sa réservation sans prendre l’extra.',
          },
          {
            title: 'Mesurez la marge',
            copy: 'Un transfert vendu 40 et facturé 28 par le prestataire laisse 12 avant vos autres coûts. Suivez séparément chiffre d’affaires, coûts, achats et incidents pour savoir si le service mérite d’être développé.',
          },
        ],
        takeaway:
          'Cette semaine : décrivez un extra, son coût, sa disponibilité et son responsable.',
        question:
          'Un extra vendu 40 avec un coût prestataire de 28 laisse combien avant les autres coûts ?',
        answers: ['40', '28', '12'],
        correct: 2,
        explanation:
          'La marge de 12, et non la vente de 40, contribue à votre résultat.',
      },
      {
        title: 'Fiabiliser chaque rotation',
        category: 'Opérations',
        intro:
          'Une arrivée sereine se prépare avant le départ du voyageur précédent.',
        sections: [
          {
            title: 'Définissez le passage de relais',
            copy: 'Une mission précise indique le logement, la fenêtre disponible, les accès et la personne responsable. Vérifiez la compatibilité avec la prochaine arrivée avant de confirmer une arrivée anticipée.',
          },
          {
            title: 'Contrôlez les points essentiels',
            copy: 'Linge, sanitaires, consommables et accès doivent être vérifiés. Demandez des photos utiles et cadrées sur le résultat attendu, sans documents ni effets personnels identifiables.',
          },
          {
            title: 'Traitez les exceptions',
            copy: 'Un dégât, un manque de linge ou un retard doit avoir un responsable et une décision. Distinguez mission terminée et logement prêt : une anomalie bloquante empêche de confirmer l’arrivée.',
          },
        ],
        takeaway:
          'Cette semaine : écrivez cinq contrôles et le circuit d’escalade en cas d’anomalie.',
        question:
          'Le ménage est fini, mais la serrure ne fonctionne pas. Le logement est-il prêt ?',
        answers: [
          'Oui, le ménage est fini',
          'Non, il faut résoudre l’accès',
          'Oui, avec une photo',
        ],
        correct: 1,
        explanation:
          'L’accès est une condition d’accueil. L’anomalie doit être résolue avant de confirmer que le logement est prêt.',
      },
    ],
  },
  blog: {
    read: 'Lire l’article',
    close: 'Refermer l’article',
    takeaway: 'À mettre en pratique',
    byline: 'La rédaction Baitly · Guide pratique',
    articles: [
      {
        title: 'Réservations directes : mesurez ce que vous gardez.',
        category: 'Revenus',
        intro:
          'Le bon indicateur n’est pas seulement le nombre de réservations. C’est leur contribution à votre activité.',
        sections: [
          {
            title: 'Comparez à périmètre égal',
            copy: 'Pour comparer une réservation directe à une réservation de plateforme, gardez la même durée, le même logement et les mêmes services. Intégrez commission, paiement, acquisition et temps de gestion. Une vente directe a elle aussi des coûts.',
          },
          {
            title: 'Simplifiez le parcours',
            copy: 'Dates, logement, services, paiement : chaque étape doit répondre à une question. Montrez les conditions avant la validation et conservez les choix en revenant en arrière. Un extra utile trouve sa place après le choix du logement.',
          },
          {
            title: 'Suivez une cohorte',
            copy: 'Sur un mois, relevez les visites, réservations confirmées, annulations et coûts par canal. Comparez la contribution des séjours réellement consommés. Une hausse du panier sans hausse de la marge ne suffit pas à valider une stratégie.',
          },
        ],
        takeaway:
          'Créez un suivi avec quatre colonnes : canal, revenu consommé, coûts, contribution.',
      },
      {
        title: 'Trois extras à tester, sans compliquer votre quotidien.',
        category: 'Expérience voyageur',
        intro:
          'Commencez petit : un besoin précis, un partenaire fiable et un prix clair.',
        sections: [
          {
            title: 'Le transfert à l’arrivée',
            copy: 'Précisez capacité, bagages et point de rendez-vous. Fixez avec le prestataire la procédure en cas de retard du vol. Proposez ce service quand les informations d’arrivée sont connues.',
          },
          {
            title: 'Le petit-déjeuner',
            copy: 'Décrivez le contenu et le créneau de livraison. Prévoyez la prise en compte des allergènes avec le prestataire. Réservez un délai de préparation réaliste et suivez le nombre de portions, pas seulement le nombre de séjours.',
          },
          {
            title: 'Le départ tardif',
            copy: 'Ne le confirmez que si le planning et le ménage le permettent. Définissez une heure limite et un responsable de validation. Mesurez la marge du service en tenant compte du coût opérationnel supplémentaire.',
          },
        ],
        takeaway:
          'Testez un seul extra sur vos prochains séjours, puis relisez les achats et les retours voyageurs.',
      },
      {
        title: 'Une rotation réussie commence par une consigne claire.',
        category: 'Opérations',
        intro:
          'La qualité se répète plus facilement lorsque tout le monde sait ce que signifie « prêt ».',
        sections: [
          {
            title: 'Avant la mission',
            copy: 'Partagez les horaires, les accès, le nombre de voyageurs attendus et les besoins particuliers. Une modification de réservation doit déclencher une mise à jour de la consigne, pas seulement du calendrier.',
          },
          {
            title: 'À la fin du ménage',
            copy: 'Utilisez une courte checklist de contrôle et quelques photos comparables d’une mission à l’autre. La preuve sert à résoudre un problème : évitez les photos inutiles et les éléments personnels des voyageurs.',
          },
          {
            title: 'En cas d’écart',
            copy: 'Indiquez qui décide et dans quel délai. Un problème d’accès ou d’équipement essentiel doit être traité avant l’arrivée. Relisez les incidents récurrents pour améliorer la consigne et le stock disponible.',
          },
        ],
        takeaway:
          'Remplacez une consigne vague par un résultat observable : « deux serviettes propres par voyageur ».',
      },
    ],
  },
  glossary: {
    search: 'Chercher un terme en français, anglais ou arabe',
    categories: ['Tous les termes', 'Revenus', 'Distribution', 'Opérations'],
    translations: 'Traductions',
    definition: 'Définition',
  },
};

const en: ResourceMessages = {
  hero: {
    eyebrow: 'THE BAITLY LIBRARY',
    title: 'Less second-guessing.',
    accent: 'More informed decisions.',
    intro:
      'Tools to try. Ideas to keep. Grow your hospitality business, one decision at a time.',
    action: 'Explore the library',
    secondary: 'Calculate my revenue',
    caption: 'Hospitality is also learned in the field.',
    note: 'Free access · No sign-up · FR / EN / AR',
  },
  library: 'Your next step starts here.',
  libraryCopy:
    'Understand a number, prepare an arrival or build your strategy. Choose where to begin.',
  open: 'Explore',
  all: 'View all',
  back: 'All resources',
  source: 'View source',
  reset: 'Reset',
  search: 'Search resources',
  empty: 'No results. Try another word or clear the filters.',
  results: 'results',
  related: 'Keep exploring',
  cta: {
    title: 'From knowing to doing.',
    copy: 'Bring bookings, teams and revenue together in Baitly.',
    action: 'Discover Baitly',
  },
  modules: {
    calculateur: {
      name: 'Revenue calculator',
      copy: 'Your prices, your costs, your scenario. See what is left.',
      tag: 'Interactive tool',
      title: 'Put your assumptions to the test.',
      intro:
        'Adjust your nightly rate, occupancy and costs. See your estimate change.',
    },
    barometre: {
      name: 'Tourism barometer',
      copy: 'Trends across six Moroccan destinations, with their sources.',
      tag: 'Public data',
      title: 'A wider view of your market.',
      intro:
        'Explore changes in guest nights in classified accommodation in Morocco.',
    },
    obligations: {
      name: 'Obligations guide',
      copy: 'Initial checks by country, with links to the relevant authorities.',
      tag: 'Practical guide',
      title: 'Prepare your business, step by step.',
      intro:
        'Morocco, France and Saudi Arabia: a checklist to start your enquiries.',
    },
    academie: {
      name: 'Baitly Academy',
      copy: 'Video training in 2 to 3 minutes, with worked examples.',
      tag: 'Video training',
      title: 'The trade, explained simply.',
      intro:
        'Video training in 2 to 3 minutes: worked examples, the traps to avoid and what to do next. Free access, no sign-up.',
    },
    blog: {
      name: 'The Baitly journal',
      copy: 'Practical methods for better hosting and business management.',
      tag: 'Articles',
      title: 'Good ideas are worth sharing.',
      intro: 'Short reads and practical actions to try in your business.',
    },
    glossaire: {
      name: 'FR / EN / AR glossary',
      copy: 'ADR, RevPAR, pacing… industry terms made clear.',
      tag: 'Glossary',
      title: 'Hospitality, in your language.',
      intro:
        'Find a term, understand its definition and discover its translation.',
    },
  },
  calc: {
    inputs: 'Your monthly scenario',
    output: 'Your estimate',
    currency: 'Currency',
    period: 'per month · all properties',
    fields: [
      'Number of properties',
      'Available nights / property',
      'Estimated occupancy (%)',
      'Average nightly rate',
      'Accommodation commission (%)',
      'Cost / occupied night',
      'Fixed monthly costs',
      'Extras margin / occupied night',
    ],
    labels: [
      'Accommodation revenue',
      'Extras margin',
      'Commissions',
      'Operating costs',
      'Balance before tax and financing',
    ],
    note: 'A simulation based on your assumptions, without market data or guaranteed returns. Tourist tax, VAT, income tax, financing and investment are not calculated. Enter extras as margin after their costs.',
    example:
      'Illustrative starting values and conversions: replace with your own assumptions. Currency rotation pauses while you enter values.',
    method: 'How is the result calculated?',
    formulas: [
      'Occupied nights = available nights × occupancy.',
      'Accommodation = occupied nights × nightly rate × properties.',
      'Balance = accommodation + extras margin − commissions − variable costs − fixed costs.',
    ],
    breakEven: 'Break-even occupancy',
    unreachable: 'Not achievable with these assumptions',
    download: 'Export my scenario (.csv)',
    invalid: 'Enter numbers within the stated limits to see a result.',
    nights: 'occupied nights / property',
    costHint:
      'Costs and extras margin are per property. Include cleaning, energy, maintenance and management in your costs.',
    netHint: 'This balance is not net taxable profit.',
  },
  market: {
    period: 'January–June 2026 · vs the same period in 2025',
    published: 'Published: 1 September 2026',
    scope: 'Morocco · Classified accommodation',
    city: 'Choose a destination',
    growth: 'Change in guest nights',
    national: 'Morocco, nationwide',
    comparison: 'Destination benchmarks',
    methodology: 'What these figures tell you',
    methodCopy:
      'Changes in guest nights in classified accommodation, reported by DEPF and published on Maroc.ma. Six cities selected from the same publication; editorial updates, not a live feed.',
    use: 'What about your property?',
    useCopy:
      'This tourism context does not measure short-term rental rates or occupancy. Build your scenario from your own bookings and genuinely comparable properties.',
    sourceName: 'Maroc.ma · DEPF / MAP',
    points: 'percentage points relative to the national figure',
    unavailable:
      'Short-term rental ADR and occupancy are not available in this publication.',
  },
  guide: {
    countries: ['Morocco', 'France', 'Saudi Arabia'],
    intro:
      'General pointers to check against your municipality, status and accommodation type. This is neither an exhaustive list nor individual legal advice.',
    progress: 'Your preparation',
    checked: 'checks completed',
    session: 'Checks remain on this page. Export your list before leaving.',
    download: 'Export my checklist (.txt)',
    verified: 'Sources checked on 24 September 2026',
    steps: [
      [
        {
          title: 'Identify your accommodation category',
          copy: 'Establish your category and ask local tourism services which authorisations you need.',
          action: 'Record your category and the relevant local contact.',
        },
        {
          title: 'Prepare your operating application',
          copy: 'Law 80-14 governs tourist establishments and other accommodation types. Check the implementing rules applicable to your activity.',
          action: 'Confirm the documents and conditions for your application.',
        },
        {
          title: 'Organise guest procedures',
          copy: 'Confirm guest formalities and establishment-specific rules with the competent authority.',
          action:
            'Document responsibilities and frequency; confirm taxation with your adviser.',
        },
      ],
      [
        {
          title: 'Check local rules',
          copy: 'Procedures depend on the residence and municipality. Ask the town hall about declaration, registration and any change-of-use requirement.',
          action: 'Request the procedure applicable to your address.',
        },
        {
          title: 'Document each booking',
          copy: 'Prepare a written contract covering the property, dates, price, payment and cancellation terms.',
          action: 'Review your contract template and listing information.',
        },
        {
          title: 'Prepare your tax records',
          copy: 'Furnished rental income must be declared. The applicable regime depends on your circumstances.',
          action:
            'Confirm your tax regime and any tourist tax collection obligation.',
        },
      ],
      [
        {
          title: 'Check your licence',
          copy: 'The Ministry of Tourism requires a valid licence for accommodation offered on booking platforms.',
          action:
            'Confirm the licence category and validity with the ministry.',
        },
        {
          title: 'Identify invoicing requirements',
          copy: 'Consult ZATCA to establish whether your activity is subject to e-invoicing and which phase applies.',
          action: 'Confirm your tax status and applicable deadlines.',
        },
        {
          title: 'Prepare your invoicing system',
          copy: 'ZATCA guides describe the requirements for generating and integrating electronic invoices.',
          action:
            'Test your solution with your adviser; also confirm local guest reporting requirements.',
        },
      ],
    ],
  },
  academy: {
    select: 'Your learning path',
    lesson: 'Lesson',
    quiz: 'Your turn',
    check: 'Check my answer',
    success: 'That’s right. Lesson completed!',
    retry: 'Not quite. Try again.',
    completed: 'lessons completed',
    session: 'Progress is kept while this page remains open.',
    next: 'Next lesson',
    lessons: [
      {
        title: 'Choose a sustainable price',
        category: 'Revenue',
        intro:
          'A full calendar is not enough: each night must contribute to your costs.',
        sections: [
          {
            title: 'Separate your costs',
            copy: 'List fixed monthly costs such as rent, software and insurance, then costs tied to nights or stays, such as linen and cleaning. Divide per-stay costs by your average length of stay.',
          },
          {
            title: 'Calculate contribution',
            copy: 'A night sold at 100, with 15% commission and 20 in variable costs, contributes 65 to fixed costs. With 650 in fixed costs, ten sold nights cover them, before tax and financing.',
          },
          {
            title: 'Compare scenarios',
            copy: 'Model a quiet month and a busy month. A lower price can fill the calendar without improving your balance. Keep a price floor and compare properties with similar capacity and quality.',
          },
        ],
        takeaway:
          'This week: calculate your nightly contribution and break-even point.',
        question:
          'A price of 100, 15% commission and variable costs of 20: what is the contribution?',
        answers: ['85', '65', '100'],
        correct: 1,
        explanation:
          '100 − 15 − 20 = 65. Fixed costs, tax and financing still need to be covered.',
      },
      {
        title: 'Sell a service guests actually need',
        category: 'Extra services',
        intro: 'A good extra meets a guest need at the right moment.',
        sections: [
          {
            title: 'Start with the stay',
            copy: 'A late arrival may call for a transfer. A family stay may benefit from breakfast delivery. Start with requests you already receive and pick one service you can reliably deliver.',
          },
          {
            title: 'Make the offer clear',
            copy: 'Show the complete price, inclusions, booking deadline and cancellation terms. Make the choice explicit and let guests continue without buying the extra.',
          },
          {
            title: 'Measure the margin',
            copy: 'A transfer sold at 40 with a supplier cost of 28 leaves 12 before other costs. Track revenue, costs, purchases and incidents separately to decide whether to expand the service.',
          },
        ],
        takeaway:
          'This week: define one extra, its cost, availability and owner.',
        question:
          'An extra sold for 40 with a supplier cost of 28 leaves how much before other costs?',
        answers: ['40', '28', '12'],
        correct: 2,
        explanation:
          'The margin of 12, rather than revenue of 40, contributes to your result.',
      },
      {
        title: 'Make every turnover reliable',
        category: 'Operations',
        intro: 'A smooth arrival starts before the previous guest leaves.',
        sections: [
          {
            title: 'Define the handover',
            copy: 'A clear task specifies the property, time window, access and responsible person. Check compatibility with the next arrival before confirming an early check-in.',
          },
          {
            title: 'Check the essentials',
            copy: 'Check linen, bathrooms, supplies and access. Request useful photos focused on the expected result, without identifiable guest belongings or documents.',
          },
          {
            title: 'Handle exceptions',
            copy: 'Damage, missing linen and delays need an owner and a decision. Cleaning finished and property ready are different states: a blocking issue prevents an arrival confirmation.',
          },
        ],
        takeaway: 'This week: write five checks and an escalation procedure.',
        question:
          'Cleaning is finished but the lock does not work. Is the property ready?',
        answers: [
          'Yes, cleaning is finished',
          'No, access must be fixed',
          'Yes, with a photo',
        ],
        correct: 1,
        explanation:
          'Access is essential. Resolve the issue before confirming that the property is ready.',
      },
    ],
  },
  blog: {
    read: 'Read article',
    close: 'Close article',
    takeaway: 'Put it into practice',
    byline: 'The Baitly team · Practical guide',
    articles: [
      {
        title: 'Direct bookings: measure what you keep.',
        category: 'Revenue',
        intro:
          'Booking volume is only part of the story. What matters is the contribution to your business.',
        sections: [
          {
            title: 'Compare like with like',
            copy: 'Compare the same property, stay length and services. Include commission, payment, acquisition and management time. Direct bookings also have costs.',
          },
          {
            title: 'Simplify the journey',
            copy: 'Dates, property, services, payment: each step should answer a question. Show terms before confirmation and preserve choices when guests go back. Offer relevant extras after property selection.',
          },
          {
            title: 'Track a cohort',
            copy: 'For one month, track visits, confirmed bookings, cancellations and costs by channel. Compare the contribution from completed stays. A larger basket without a better margin is not enough.',
          },
        ],
        takeaway:
          'Create four columns: channel, completed-stay revenue, costs and contribution.',
      },
      {
        title: 'Three extras to test without complicating your day.',
        category: 'Guest experience',
        intro:
          'Start small: a specific need, a reliable partner and a clear price.',
        sections: [
          {
            title: 'Arrival transfer',
            copy: 'State capacity, luggage allowance and meeting point. Agree on a delayed-flight procedure with the provider. Offer the service once arrival details are known.',
          },
          {
            title: 'Breakfast',
            copy: 'Describe the contents and delivery window. Plan allergen information with the provider. Allow realistic preparation time and track portions, not just bookings.',
          },
          {
            title: 'Late checkout',
            copy: 'Confirm it only when the calendar and cleaning schedule allow. Set a deadline and an approval owner. Include extra operational costs when measuring margin.',
          },
        ],
        takeaway:
          'Test one extra over your next stays, then review purchases and guest feedback.',
      },
      {
        title: 'A good turnover begins with clear instructions.',
        category: 'Operations',
        intro:
          'Consistent quality is easier when everyone agrees on what “ready” means.',
        sections: [
          {
            title: 'Before the task',
            copy: 'Share times, access details, expected guest count and specific needs. A booking change should update the task instructions as well as the calendar.',
          },
          {
            title: 'After cleaning',
            copy: 'Use a short checklist and a few comparable photos. Evidence should help resolve issues: avoid unnecessary images and guests’ personal belongings.',
          },
          {
            title: 'When something is wrong',
            copy: 'Define who decides and by when. Resolve access or essential equipment problems before arrival. Review recurring issues to improve instructions and supplies.',
          },
        ],
        takeaway:
          'Replace vague instructions with observable outcomes: “two clean towels per guest”.',
      },
    ],
  },
  glossary: {
    search: 'Search in French, English or Arabic',
    categories: ['All terms', 'Revenue', 'Distribution', 'Operations'],
    translations: 'Translations',
    definition: 'Definition',
  },
};

const ar: ResourceMessages = {
  hero: {
    eyebrow: 'مكتبة بيتلي',
    title: 'تردد أقل.',
    accent: 'قرارات أوضح.',
    intro: 'أدوات للتجربة وأفكار للتطبيق. طوّر نشاط الضيافة، قراراً بعد قرار.',
    action: 'استكشف الموارد',
    secondary: 'احسب إيراداتك',
    caption: 'الضيافة خبرة نتعلمها أيضاً في الميدان.',
    note: 'وصول مجاني · دون تسجيل · FR / EN / AR',
  },
  library: 'خطوتك التالية تبدأ هنا.',
  libraryCopy:
    'افهم مؤشراً، حضّر وصولاً أو ابنِ استراتيجيتك. اختر نقطة البداية.',
  open: 'استكشف',
  all: 'عرض الكل',
  back: 'كل الموارد',
  source: 'اطّلع على المصدر',
  reset: 'إعادة الضبط',
  search: 'ابحث عن مورد',
  empty: 'لا توجد نتائج. جرّب كلمة أخرى أو امسح عوامل التصفية.',
  results: 'نتائج',
  related: 'اكتشف المزيد',
  cta: {
    title: 'من المعرفة إلى التطبيق.',
    copy: 'اجمع حجوزاتك وفرقك وإيراداتك في بيتلي.',
    action: 'اكتشف بيتلي',
  },
  modules: {
    calculateur: {
      name: 'حاسبة الإيرادات',
      copy: 'أسعارك وتكاليفك وافتراضاتك. اعرف المبلغ المتبقي.',
      tag: 'أداة تفاعلية',
      title: 'اختبر افتراضاتك بالأرقام.',
      intro: 'عدّل سعر الليلة والإشغال والتكاليف، وشاهد التقدير يتغير.',
    },
    barometre: {
      name: 'مؤشر السياحة',
      copy: 'اتجاهات ست وجهات مغربية مع مصادرها.',
      tag: 'بيانات عامة',
      title: 'نظرة أوسع على سوقك.',
      intro: 'استكشف تطور ليالي المبيت في مؤسسات الإيواء المصنفة بالمغرب.',
    },
    obligations: {
      name: 'دليل الالتزامات',
      copy: 'خطوات التحقق الأولى حسب البلد وروابط الجهات المختصة.',
      tag: 'دليل عملي',
      title: 'حضّر نشاطك خطوة بخطوة.',
      intro: 'المغرب وفرنسا والسعودية: قائمة تساعدك على بدء إجراءاتك.',
    },
    academie: {
      name: 'أكاديمية بيتلي',
      copy: 'دورات بالفيديو من دقيقتين إلى ثلاث، مع أمثلة بالأرقام.',
      tag: 'دورات بالفيديو',
      title: 'المهنة، بشرح بسيط.',
      intro:
        'دورات بالفيديو من دقيقتين إلى ثلاث: أمثلة بالأرقام، والأخطاء التي يجب تجنّبها، وما عليك فعله بعدها. وصول مجاني دون تسجيل.',
    },
    blog: {
      name: 'دفتر بيتلي',
      copy: 'طرق عملية لتحسين الاستقبال وإدارة النشاط.',
      tag: 'مقالات',
      title: 'الأفكار المفيدة تستحق المشاركة.',
      intro: 'قراءات قصيرة وخطوات عملية لتجربتها في نشاطك.',
    },
    glossaire: {
      name: 'مسرد فرنسي / إنجليزي / عربي',
      copy: 'مصطلحات الضيافة والإيرادات بعبارات واضحة.',
      tag: 'مسرد',
      title: 'مصطلحات المهنة بلغتك.',
      intro: 'ابحث عن مصطلح وافهم معناه وتعرّف على ترجمته.',
    },
  },
  calc: {
    inputs: 'سيناريو الشهر',
    output: 'تقديرك',
    currency: 'العملة',
    period: 'شهرياً · جميع العقارات',
    fields: [
      'عدد العقارات',
      'الليالي المتاحة لكل عقار',
      'الإشغال المتوقع (%)',
      'متوسط سعر الليلة',
      'عمولة الإيواء (%)',
      'التكلفة لكل ليلة مشغولة',
      'التكاليف الثابتة الشهرية',
      'هامش الإضافات لكل ليلة مشغولة',
    ],
    labels: [
      'إيرادات الإيواء',
      'هامش الخدمات الإضافية',
      'العمولات',
      'تكاليف التشغيل',
      'الرصيد قبل الضرائب والتمويل',
    ],
    note: 'محاكاة مبنية على افتراضاتك، دون بيانات سوق أو ضمان للعائد. لا تُحتسب رسوم الإقامة أو ضريبة القيمة المضافة أو الضرائب أو التمويل أو الاستثمار. أدخل الإضافات كهامش بعد تكاليفها.',
    example:
      'قيم أولية وتحويلات توضيحية، استبدلها بافتراضاتك. يتوقف تبديل العملات أثناء إدخال القيم.',
    method: 'كيف يُحتسب الناتج؟',
    formulas: [
      'الليالي المشغولة = الليالي المتاحة × الإشغال.',
      'الإيواء = الليالي المشغولة × سعر الليلة × عدد العقارات.',
      'الرصيد = الإيواء + هامش الإضافات − العمولات − التكاليف المتغيرة − التكاليف الثابتة.',
    ],
    breakEven: 'الإشغال عند نقطة التعادل',
    unreachable: 'غير قابل للتحقيق بهذه الافتراضات',
    download: 'تصدير السيناريو (.csv)',
    invalid: 'أدخل أرقاماً ضمن الحدود المحددة لعرض النتيجة.',
    nights: 'ليالٍ مشغولة لكل عقار',
    costHint:
      'التكاليف وهامش الإضافات لكل عقار. أدرج التنظيف والطاقة والصيانة والإدارة ضمن تكاليفك.',
    netHint: 'هذا الرصيد ليس صافي ربح ضريبي.',
  },
  market: {
    period: 'يناير إلى يونيو 2026 · مقارنة بالفترة نفسها من 2025',
    published: 'تاريخ النشر: 1 سبتمبر 2026',
    scope: 'المغرب · الإيواء المصنف',
    city: 'اختر وجهة',
    growth: 'تطور ليالي المبيت',
    national: 'المغرب، إجمالي البلاد',
    comparison: 'مؤشرات الوجهات',
    methodology: 'ماذا تعني هذه الأرقام؟',
    methodCopy:
      'تطور ليالي المبيت في مؤسسات الإيواء المصنفة، وفق مديرية الدراسات والتوقعات المالية عبر Maroc.ma. ست مدن من المنشور نفسه؛ تحديث تحريري وليس بثاً مباشراً.',
    use: 'وماذا عن عقارك؟',
    useCopy:
      'هذا السياق السياحي لا يقيس أسعار أو إشغال الإيجارات القصيرة. ابنِ سيناريوك من حجوزاتك ومن عقارات مماثلة فعلاً.',
    sourceName: 'Maroc.ma · DEPF / MAP',
    points: 'نقاط مئوية مقارنة بالمعدل الوطني',
    unavailable:
      'متوسط سعر وإشغال الإيجارات القصيرة غير متاحين في هذا المنشور.',
  },
  guide: {
    countries: ['المغرب', 'فرنسا', 'السعودية'],
    intro:
      'نقاط عامة تُراجع وفق البلدية والوضع القانوني ونوع الإيواء. القائمة ليست شاملة ولا تمثل استشارة قانونية شخصية.',
    progress: 'تحضيرك',
    checked: 'عمليات تحقق مكتملة',
    session: 'تبقى العلامات في هذه الصفحة. صدّر قائمتك قبل مغادرتها.',
    download: 'تصدير القائمة (.txt)',
    verified: 'المصادر مراجعة في 24 سبتمبر 2026',
    steps: [
      [
        {
          title: 'حدّد فئة الإيواء',
          copy: 'حدّد فئة مؤسستك والتراخيص اللازمة لدى مصالح السياحة المحلية.',
          action: 'دوّن الفئة وبيانات الجهة المحلية المختصة.',
        },
        {
          title: 'جهّز ملف التشغيل',
          copy: 'ينظم القانون 80-14 المؤسسات وأشكال الإيواء السياحي الأخرى. راجع النصوص التطبيقية الخاصة بنشاطك.',
          action: 'تأكد من الوثائق والشروط المطلوبة لملفك.',
        },
        {
          title: 'نظّم إجراءات الضيوف',
          copy: 'تحقق لدى الجهة المختصة من إجراءات المسافرين والقواعد الخاصة بمؤسستك.',
          action: 'وثّق المسؤوليات والمواعيد وراجع الضرائب مع مستشارك.',
        },
      ],
      [
        {
          title: 'تحقق من القواعد المحلية',
          copy: 'تختلف الإجراءات حسب المسكن والبلدية. اسأل البلدية عن التصريح والتسجيل وتغيير الاستخدام المحتمل.',
          action: 'اطلب الإجراء الذي ينطبق على عنوانك.',
        },
        {
          title: 'وثّق كل حجز',
          copy: 'جهّز عقداً مكتوباً يحدد المسكن والتواريخ والسعر وشروط الدفع والإلغاء.',
          action: 'راجع نموذج العقد ومعلومات الإعلان.',
        },
        {
          title: 'جهّز السجلات الضريبية',
          copy: 'يجب التصريح بإيرادات التأجير المفروش. ويتوقف النظام المطبق على وضعك.',
          action: 'أكد النظام الضريبي وأي التزام بتحصيل رسم الإقامة.',
        },
      ],
      [
        {
          title: 'تحقق من الترخيص',
          copy: 'تشترط وزارة السياحة ترخيصاً سارياً لمرافق الإيواء المعروضة على منصات الحجز.',
          action: 'أكد فئة الترخيص وصلاحيته مع الوزارة.',
        },
        {
          title: 'حدّد التزامات الفوترة',
          copy: 'راجع هيئة الزكاة والضريبة والجمارك لتحديد خضوع نشاطك للفوترة الإلكترونية والمرحلة المطبقة.',
          action: 'أكد وضعك الضريبي والمواعيد التي تخصك.',
        },
        {
          title: 'جهّز نظام الفوترة',
          copy: 'تشرح أدلة الهيئة متطلبات إصدار الفواتير الإلكترونية وربطها.',
          action:
            'اختبر الحل مع مستشارك وتحقق أيضاً من متطلبات تسجيل النزلاء المحلية.',
        },
      ],
    ],
  },
  academy: {
    select: 'مسارك التعليمي',
    lesson: 'الدرس',
    quiz: 'دورك الآن',
    check: 'تحقق من إجابتي',
    success: 'صحيح. اكتمل الدرس!',
    retry: 'ليست الإجابة الصحيحة. حاول مجدداً.',
    completed: 'دروس مكتملة',
    session: 'يُحفظ التقدم ما دامت هذه الصفحة مفتوحة.',
    next: 'الدرس التالي',
    lessons: [
      {
        title: 'اختر سعراً يغطي تكاليفك',
        category: 'الإيرادات',
        intro:
          'امتلاء التقويم وحده لا يكفي. كل ليلة يجب أن تساهم في تغطية التكاليف.',
        sections: [
          {
            title: 'افصل التكاليف',
            copy: 'اكتب التكاليف الشهرية الثابتة مثل الإيجار والبرنامج والتأمين، ثم التكاليف المرتبطة بالليالي أو الإقامات مثل الغسيل والتنظيف. اقسم تكلفة الإقامة على متوسط مدتها.',
          },
          {
            title: 'احسب المساهمة',
            copy: 'ليلة بسعر 100 وعمولة 15% وتكاليف متغيرة 20 تترك 65 لتغطية التكاليف الثابتة. إذا كانت الثابتة 650، تكفي عشر ليالٍ لتغطيتها قبل الضرائب والتمويل.',
          },
          {
            title: 'قارن السيناريوهات',
            copy: 'جرّب شهراً هادئاً وآخر مزدحماً. خفض السعر قد يملأ التقويم دون تحسين الرصيد. حافظ على حد أدنى وقارن عقارات متشابهة في السعة والجودة.',
          },
        ],
        takeaway: 'هذا الأسبوع: احسب مساهمة الليلة ونقطة التعادل.',
        question:
          'السعر 100 والعمولة 15% والتكلفة المتغيرة 20. ما مساهمة الليلة؟',
        answers: ['85', '65', '100'],
        correct: 1,
        explanation:
          '100 − 15 − 20 = 65. تبقى التكاليف الثابتة والضرائب والتمويل.',
      },
      {
        title: 'بع خدمة يحتاجها الضيف فعلاً',
        category: 'الخدمات الإضافية',
        intro: 'الخدمة الجيدة تلبي حاجة الضيف في الوقت المناسب.',
        sections: [
          {
            title: 'ابدأ من الإقامة',
            copy: 'قد يحتاج الوصول المتأخر إلى نقل، والإقامة العائلية إلى فطور موصل. ابدأ من الطلبات التي تتلقاها واختر خدمة واحدة تستطيع تنفيذها بثبات.',
          },
          {
            title: 'اجعل العرض واضحاً',
            copy: 'اعرض السعر الكامل وما يشمله وآخر موعد للحجز وشروط الإلغاء. اجعل الاختيار صريحاً واسمح بإكمال الحجز دون شراء الخدمة.',
          },
          {
            title: 'قس الهامش',
            copy: 'نقل يُباع بـ40 وتكلفته لدى المزود 28 يترك 12 قبل التكاليف الأخرى. تابع الإيراد والتكاليف والمشتريات والمشكلات لتقرر توسيع الخدمة.',
          },
        ],
        takeaway:
          'هذا الأسبوع: حدّد خدمة واحدة وتكلفتها وتوفرها والمسؤول عنها.',
        question:
          'خدمة تباع بـ40 وتكلفة مزودها 28. كم يتبقى قبل بقية التكاليف؟',
        answers: ['40', '28', '12'],
        correct: 2,
        explanation: 'الهامش 12، وليس المبيع 40، هو ما يساهم في النتيجة.',
      },
      {
        title: 'اجعل تجهيز كل إقامة موثوقاً',
        category: 'العمليات',
        intro: 'الوصول الهادئ يبدأ قبل مغادرة الضيف السابق.',
        sections: [
          {
            title: 'حدّد تسليم المهمة',
            copy: 'توضح المهمة العقار والوقت المتاح وطريقة الدخول والمسؤول. تحقق من توافقها مع الوصول التالي قبل تأكيد دخول مبكر.',
          },
          {
            title: 'افحص الأساسيات',
            copy: 'افحص المفروشات والحمامات والمستهلكات والدخول. اطلب صوراً مفيدة تُظهر النتيجة دون وثائق أو مقتنيات شخصية يمكن التعرف عليها.',
          },
          {
            title: 'عالج الاستثناءات',
            copy: 'التلف ونقص المفروشات والتأخر تحتاج إلى مسؤول وقرار. انتهاء التنظيف لا يعني جاهزية العقار إذا بقيت مشكلة تمنع الاستقبال.',
          },
        ],
        takeaway: 'هذا الأسبوع: اكتب خمسة فحوص ومسار تصعيد عند المشكلة.',
        question: 'انتهى التنظيف لكن القفل لا يعمل. هل العقار جاهز؟',
        answers: ['نعم، انتهى التنظيف', 'لا، يجب إصلاح الدخول', 'نعم، مع صورة'],
        correct: 1,
        explanation: 'الدخول شرط أساسي. عالج المشكلة قبل تأكيد جاهزية العقار.',
      },
    ],
  },
  blog: {
    read: 'اقرأ المقال',
    close: 'إغلاق المقال',
    takeaway: 'خطوة للتطبيق',
    byline: 'فريق بيتلي · دليل عملي',
    articles: [
      {
        title: 'الحجز المباشر: قس ما تحتفظ به.',
        category: 'الإيرادات',
        intro: 'عدد الحجوزات جزء من الصورة. الأهم مساهمتها في نشاطك.',
        sections: [
          {
            title: 'قارن الظروف نفسها',
            copy: 'قارن العقار والمدة والخدمات نفسها. احتسب العمولة والدفع واكتساب العميل ووقت الإدارة. للحجز المباشر تكاليف أيضاً.',
          },
          {
            title: 'بسّط الرحلة',
            copy: 'التواريخ والعقار والخدمات والدفع: لكل خطوة سؤال تجيب عنه. اعرض الشروط قبل التأكيد واحتفظ بالاختيارات عند الرجوع. اقترح الإضافات بعد اختيار العقار.',
          },
          {
            title: 'تابع مجموعة إقامات',
            copy: 'سجّل لمدة شهر الزيارات والحجوزات والإلغاءات والتكاليف حسب القناة. قارن مساهمة الإقامات المنفذة. ارتفاع السلة دون ارتفاع الهامش لا يكفي.',
          },
        ],
        takeaway:
          'أنشئ أربعة أعمدة: القناة، إيراد الإقامات المنفذة، التكاليف، المساهمة.',
      },
      {
        title: 'ثلاث إضافات للتجربة دون تعقيد يومك.',
        category: 'تجربة الضيف',
        intro: 'ابدأ بحاجة محددة وشريك موثوق وسعر واضح.',
        sections: [
          {
            title: 'النقل عند الوصول',
            copy: 'حدّد السعة والأمتعة ونقطة اللقاء. اتفق مع المزود على إجراء تأخر الطائرة. اقترح الخدمة عندما تتضح معلومات الوصول.',
          },
          {
            title: 'الفطور',
            copy: 'اشرح المحتوى ووقت التوصيل. نسّق معلومات مسببات الحساسية مع المزود. اترك وقتاً واقعياً للتحضير وتابع عدد الوجبات وليس الحجوزات فقط.',
          },
          {
            title: 'المغادرة المتأخرة',
            copy: 'أكدها فقط إذا سمح التقويم والتنظيف. حدّد موعداً نهائياً ومسؤولاً للموافقة. أدخل التكاليف التشغيلية الإضافية عند قياس الهامش.',
          },
        ],
        takeaway:
          'جرّب إضافة واحدة في إقاماتك التالية ثم راجع الشراء وملاحظات الضيوف.',
      },
      {
        title: 'التجهيز الناجح يبدأ بتعليمات واضحة.',
        category: 'العمليات',
        intro: 'يسهل تكرار الجودة عندما يتفق الجميع على معنى الجاهزية.',
        sections: [
          {
            title: 'قبل المهمة',
            copy: 'شارك الأوقات والدخول وعدد الضيوف والاحتياجات الخاصة. يجب أن يعدّل تغيير الحجز تعليمات المهمة، لا التقويم فقط.',
          },
          {
            title: 'بعد التنظيف',
            copy: 'استخدم قائمة قصيرة وصوراً قابلة للمقارنة. الهدف حل المشكلات؛ تجنب الصور غير الضرورية ومقتنيات الضيوف الشخصية.',
          },
          {
            title: 'عند وجود مشكلة',
            copy: 'حدّد صاحب القرار والمهلة. عالج مشكلات الدخول أو التجهيز الأساسي قبل الوصول. راجع المشكلات المتكررة لتحسين التعليمات والمخزون.',
          },
        ],
        takeaway:
          'استبدل التعليمات المبهمة بنتيجة قابلة للملاحظة: منشفتان نظيفتان لكل ضيف.',
      },
    ],
  },
  glossary: {
    search: 'ابحث بالفرنسية أو الإنجليزية أو العربية',
    categories: ['كل المصطلحات', 'الإيرادات', 'التوزيع', 'العمليات'],
    translations: 'الترجمات',
    definition: 'التعريف',
  },
};

export const BAITLY_RESOURCE_MESSAGES: Record<SiteLanguage, ResourceMessages> =
  { fr, en, ar };
