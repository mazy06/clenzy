/**
 * Contenus juridiques du site Baitly — rédigés pour un éditeur SaaS marocain
 * opérant aussi vers l'UE. Les identifiants entre crochets 〔…〕 sont à
 * compléter à l'immatriculation ; faire relire par un conseil avant mise en
 * production publique.
 */

export interface LegalBlock {
  heading: string;
  paragraphs?: string[];
  list?: string[];
  table?: { headers: string[]; rows: string[][] };
}

export interface LegalDoc {
  slug: string;
  title: string;
  intro: string;
  updated: string;
  blocks: LegalBlock[];
}

export const LEGAL_DOCS: LegalDoc[] = [
  /* ─────────────────────────── MENTIONS LÉGALES ─────────────────────────── */
  {
    slug: 'mentions-legales',
    title: 'Mentions légales',
    updated: '24 juillet 2026',
    intro:
      'Informations relatives à l’éditeur et à l’hébergement du site baitly et de la plateforme associée, conformément à la loi marocaine n° 53-05 relative à l’échange électronique de données juridiques et, pour les utilisateurs établis dans l’Union européenne, à la loi française n° 2004-575 pour la confiance dans l’économie numérique (LCEN).',
    blocks: [
      {
        heading: '1. Éditeur du site et de la plateforme',
        paragraphs: [
          'Le site et la plateforme Baitly (ci-après « le Service ») sont édités par 〔Baitly SARL〕, société à responsabilité limitée de droit marocain au capital de 〔•〕 MAD, dont le siège social est situé 〔adresse du siège, ville〕, Maroc.',
        ],
        list: [
          'Identifiant Commun de l’Entreprise (ICE) : 〔•〕',
          'Registre de commerce : RC 〔•〕 — 〔ville〕',
          'Identifiant fiscal (IF) : 〔•〕 · Taxe professionnelle : 〔•〕 · CNSS : 〔•〕',
          'Directeur de la publication : 〔nom du gérant〕, en qualité de gérant',
          'Contact : contact@baitly.ma · +212 〔•〕',
        ],
      },
      {
        heading: '2. Hébergement',
        paragraphs: [
          'Le Service est hébergé par 〔OVHcloud — 2 rue Kellermann, 59100 Roubaix, France — +33 9 72 10 10 07〕. Les données de production sont hébergées dans des centres de données situés dans l’Union européenne. Certains sous-traitants techniques listés dans la Politique de confidentialité peuvent opérer depuis d’autres juridictions, dans les conditions qui y sont décrites.',
        ],
      },
      {
        heading: '3. Propriété intellectuelle',
        paragraphs: [
          'L’ensemble des éléments composant le site et la plateforme (architecture, code, textes, graphismes, logos, marque « Baitly », mark animé, bases de données, documentation) est protégé par la loi marocaine n° 17-97 relative à la protection de la propriété industrielle et par la loi n° 2-00 relative aux droits d’auteur et droits voisins, ainsi que par les conventions internationales applicables.',
          'Toute reproduction, représentation, adaptation ou extraction, totale ou partielle, sans autorisation écrite préalable de l’éditeur est interdite et constitue une contrefaçon. Les marques et logos de tiers cités (Airbnb, Booking.com, Google, Stripe, CMI, PayZone, YouCan Pay, Nuki, Minut, Channex…) demeurent la propriété de leurs titulaires respectifs ; leur mention n’implique ni partenariat ni approbation de leur part, sauf indication expresse.',
        ],
      },
      {
        heading: '4. Responsabilité relative au contenu du site',
        paragraphs: [
          'Les informations publiées sur le site (fonctionnalités, tarifs indicatifs, contenus pédagogiques, données de marché) sont fournies à titre informatif et peuvent être modifiées à tout moment. Elles ne constituent ni un conseil juridique, ni un conseil comptable ou fiscal. Les obligations réglementaires décrites (fiche de police, taxe de séjour, facturation) sont mises en œuvre par le Service en l’état de la réglementation connue ; il appartient à chaque client de vérifier leur adéquation à sa situation avec ses propres conseils.',
        ],
      },
      {
        heading: '5. Liens hypertextes',
        paragraphs: [
          'Le site peut contenir des liens vers des sites tiers. L’éditeur n’exerce aucun contrôle sur ces sites et décline toute responsabilité quant à leur contenu. La mise en place d’un lien vers le site baitly ne requiert pas d’autorisation préalable sous réserve qu’elle ne porte pas atteinte à l’image de l’éditeur ; l’éditeur se réserve le droit d’en demander la suppression.',
        ],
      },
      {
        heading: '6. Données personnelles et cookies',
        paragraphs: [
          'Le traitement des données personnelles (visiteurs du site, prospects, utilisateurs de la plateforme, voyageurs) est décrit dans la Politique de confidentialité, qui fait partie intégrante des présentes. Le dépôt de cookies non essentiels est soumis à votre consentement préalable, recueilli et modifiable via le bandeau dédié.',
        ],
      },
      {
        heading: '7. Droit applicable',
        paragraphs: [
          'Le site est régi par le droit marocain. Les présentes mentions sont fournies en langue française ; en cas de traduction, la version française prévaut.',
        ],
      },
    ],
  },

  /* ──────────────────────── POLITIQUE DE CONFIDENTIALITÉ ─────────────────── */
  {
    slug: 'confidentialite',
    title: 'Politique de confidentialité',
    updated: '24 juillet 2026',
    intro:
      'La présente politique décrit comment 〔Baitly SARL〕 traite les données à caractère personnel, en conformité avec la loi marocaine n° 09-08 relative à la protection des personnes physiques à l’égard du traitement des données à caractère personnel et, lorsque le traitement relève de son champ d’application territorial, avec le Règlement (UE) 2016/679 (« RGPD »).',
    blocks: [
      {
        heading: '1. Responsable de traitement et rôles',
        paragraphs: [
          'Pour les données des visiteurs du site, des prospects et des utilisateurs titulaires d’un compte, 〔Baitly SARL〕 agit en qualité de responsable de traitement.',
          'Pour les données que nos clients (conciergeries, hôtes, gestionnaires) importent ou collectent dans la plateforme — notamment les données de leurs voyageurs (identité, coordonnées, pièces d’identité aux fins de fiche de police, données de séjour et de paiement) — Baitly agit en qualité de sous-traitant au sens de l’article 28 du RGPD et de la loi 09-08 : le client demeure responsable de traitement et Baitly ne traite ces données que sur ses instructions documentées. Un accord de traitement des données (DPA) est annexé aux CGV.',
        ],
      },
      {
        heading: '2. Déclarations auprès de la CNDP',
        paragraphs: [
          'Les traitements mis en œuvre au Maroc font l’objet des formalités préalables requises auprès de la Commission Nationale de contrôle de la protection des Données à caractère Personnel (CNDP) : déclaration(s) n° 〔•〕 et, le cas échéant, demandes d’autorisation pour les traitements y étant soumis (données sensibles, transferts à l’étranger). Les références sont tenues à jour sur cette page.',
        ],
      },
      {
        heading: '3. Données traitées et finalités',
        table: {
          headers: ['Catégorie', 'Exemples de données', 'Finalités', 'Base légale'],
          rows: [
            ['Visiteurs du site', 'Données de navigation, cookies, mesure d’audience', 'Fonctionnement et amélioration du site, statistiques', 'Intérêt légitime / consentement (cookies non essentiels)'],
            ['Prospects', 'Identité, coordonnées, taille du portefeuille, outil actuel', 'Réponse aux demandes de démo, prospection B2B', 'Mesures précontractuelles / intérêt légitime'],
            ['Clients & utilisateurs', 'Identité, coordonnées, rôle, journaux de connexion, facturation', 'Fourniture du Service, support, facturation, sécurité', 'Exécution du contrat / obligation légale (comptabilité)'],
            ['Voyageurs (pour le compte des clients)', 'Identité, coordonnées, pièce d’identité (fiche de police), séjours, communications', 'Gestion des réservations, obligations déclaratives (DGSN, taxe de séjour), messagerie', 'Instructions du client responsable de traitement'],
            ['Données de paiement', 'Références de transaction (jamais les numéros de carte complets, conservés par les prestataires certifiés PCI-DSS)', 'Encaissement, remboursements, lutte contre la fraude', 'Exécution du contrat / obligation légale'],
          ],
        },
      },
      {
        heading: '4. Fonctionnalités d’intelligence artificielle',
        paragraphs: [
          'Certaines fonctionnalités (agents, suggestions de réponses, analyse de documents) font appel à des modèles d’IA fournis par des sous-traitants spécialisés. Les données transmises à ces fournisseurs le sont dans la stricte mesure nécessaire à la fonctionnalité, ne sont pas utilisées par eux pour entraîner leurs modèles au titre de nos accords, et les actions à effet significatif restent soumises à validation humaine par le client (fonctionnement « human-in-the-loop »). Un registre des décisions automatisées est tenu dans la plateforme (journal d’audit).',
        ],
      },
      {
        heading: '5. Sous-traitants et destinataires',
        paragraphs: [
          'Les données sont accessibles aux seuls personnels habilités de Baitly et à nos sous-traitants, dans la limite de leurs missions :',
        ],
        list: [
          'Hébergement et infrastructure : 〔OVHcloud (UE)〕',
          'Paiements : Stripe (UE/États-Unis), CMI / PayZone (Maroc), YouCan Pay (Maroc)',
          'Emails transactionnels : 〔Brevo (UE)〕 · Messagerie WhatsApp : Meta Platforms (États-Unis)',
          'Modèles d’IA : 〔Anthropic / autres fournisseurs listés dans le DPA〕',
          'Connectivité canaux : Channex (distribution OTA)',
          'Autorités publiques lorsque la loi l’exige (DGSN pour les fiches de police, administration fiscale pour la taxe de séjour), pour le compte et sur instruction du client',
        ],
      },
      {
        heading: '6. Transferts internationaux',
        paragraphs: [
          'Lorsque des données sont transférées hors du Maroc, le transfert est réalisé conformément aux articles 43 et 44 de la loi 09-08 (autorisation préalable de la CNDP lorsqu’elle est requise) ; lorsque des données relevant du RGPD sont transférées hors de l’Espace économique européen, il est encadré par des garanties appropriées (clauses contractuelles types de la Commission européenne, mesures supplémentaires le cas échéant). La liste à jour des transferts figure dans le DPA.',
        ],
      },
      {
        heading: '7. Durées de conservation',
        list: [
          'Prospects : 3 ans après le dernier contact.',
          'Comptes clients : durée du contrat, puis archivage des données de facturation 10 ans (obligations comptables).',
          'Données voyageurs traitées en sous-traitance : selon les instructions et durées fixées par le client responsable de traitement ; suppression ou restitution en fin de contrat (clause de réversibilité des CGV).',
          'Journaux techniques et de sécurité : 12 mois.',
          'Cookies : 13 mois maximum ; consentement re-sollicité au-delà.',
        ],
      },
      {
        heading: '8. Sécurité',
        paragraphs: [
          'Baitly met en œuvre des mesures techniques et organisationnelles adaptées : chiffrement en transit (TLS) et au repos, cloisonnement strict des données par organisation (multi-tenant), contrôle d’accès par rôles, authentification via un fournisseur d’identité dédié, journalisation, sauvegardes régulières testées, tests d’intrusion périodiques et gestion documentée des vulnérabilités. Les cartes bancaires ne transitent jamais par nos serveurs : elles sont traitées par des prestataires certifiés PCI-DSS.',
          'En cas de violation de données susceptible d’engendrer un risque pour les personnes, Baitly notifie l’autorité compétente et, le cas échéant, les clients concernés dans les délais légaux (72 heures s’agissant du RGPD), et documente l’incident.',
        ],
      },
      {
        heading: '9. Vos droits',
        paragraphs: [
          'Conformément à la loi 09-08 et, le cas échéant, au RGPD, vous disposez des droits d’accès, de rectification, d’effacement, d’opposition, de limitation et de portabilité de vos données, ainsi que du droit de définir des directives post-mortem et de retirer votre consentement à tout moment.',
          'Exercice des droits : privacy@baitly.ma (réponse sous 30 jours ; justificatif d’identité requis en cas de doute raisonnable). Les voyageurs dont les données sont traitées pour le compte d’un client sont invités à s’adresser d’abord à leur hébergeur/gestionnaire, responsable de traitement ; Baitly relaie sans délai toute demande reçue directement.',
          'Vous pouvez introduire une réclamation auprès de la CNDP (www.cndp.ma) ou, pour les personnes relevant du RGPD, auprès de l’autorité de contrôle de votre État membre (en France, la CNIL).',
        ],
      },
      {
        heading: '10. Cookies',
        paragraphs: [
          'Le site utilise des cookies strictement nécessaires (session, sécurité, préférences de consentement) exemptés de consentement, et, sous réserve de votre accord, des cookies de mesure d’audience. Aucun cookie publicitaire tiers n’est déposé. Vous pouvez retirer votre consentement à tout moment via le lien « Gérer les cookies » en pied de page.',
        ],
      },
      {
        heading: '11. Mise à jour de la présente politique',
        paragraphs: [
          'Cette politique peut être mise à jour pour refléter l’évolution du Service ou de la réglementation. En cas de modification substantielle, les utilisateurs titulaires d’un compte en sont informés par email ou notification in-app au moins 30 jours avant l’entrée en vigueur.',
        ],
      },
    ],
  },

  /* ──────────────────────────────── CGV ─────────────────────────────────── */
  {
    slug: 'cgv',
    title: 'Conditions générales de vente et d’utilisation',
    updated: '24 juillet 2026',
    intro:
      'Les présentes conditions (« CGV ») régissent la souscription et l’utilisation de la plateforme Baitly par des clients professionnels. Elles prévalent sur tout autre document, sous réserve de conditions particulières signées. La souscription en ligne ou la signature d’un bon de commande emporte leur acceptation pleine et entière.',
    blocks: [
      {
        heading: 'Article 1 — Définitions',
        list: [
          '« Service » : la plateforme SaaS Baitly (PMS, channel manager, booking engine, agents IA, modules et add-ons), sa documentation et ses API.',
          '« Client » : tout professionnel (personne morale ou physique agissant à des fins professionnelles) ayant souscrit un abonnement. Le Service n’est pas destiné aux consommateurs.',
          '« Utilisateur » : toute personne physique autorisée par le Client à accéder au Service (employé, prestataire, propriétaire mandant).',
          '« Données Client » : ensemble des données importées ou générées dans le Service par ou pour le Client, y compris les données de ses voyageurs.',
          '« Abonnement » : droit d’accès au Service pour un nombre de logements et un plan donnés, à durée mensuelle ou annuelle.',
        ],
      },
      {
        heading: 'Article 2 — Objet et description du Service',
        paragraphs: [
          'Baitly fournit un service logiciel en mode SaaS destiné à la gestion de locations de courte durée : gestion des réservations et calendriers, synchronisation avec les plateformes de distribution, moteur de réservation directe, encaissements via des prestataires de paiement tiers, opérations de ménage et maintenance, facturation, portail propriétaires et fonctionnalités d’assistance par intelligence artificielle.',
          'Les fonctionnalités de conformité (fiche de police, taxe de séjour, mentions de facturation) sont des outils d’aide à l’accomplissement des obligations du Client, qui demeure seul responsable de ses obligations légales, déclaratives et fiscales.',
        ],
      },
      {
        heading: 'Article 3 — Souscription, essai et compte',
        paragraphs: [
          'La souscription s’effectue en ligne ou par bon de commande. Un essai gratuit peut être proposé ; à son terme, l’accès est suspendu sauf souscription d’un Abonnement. Le Client garantit l’exactitude des informations fournies (notamment ICE/RC ou SIRET, adresse, contact de facturation) et la mise à jour de celles-ci.',
          'Le Client est responsable de la gestion des comptes Utilisateurs, de la confidentialité des identifiants et de l’usage fait du Service sous ses accès. Baitly peut suspendre un accès en cas de risque avéré pour la sécurité.',
        ],
      },
      {
        heading: 'Article 4 — Tarifs, facturation et paiement',
        paragraphs: [
          'Les tarifs en vigueur sont publiés sur la page Tarifs, exprimés hors taxes, par logement et par mois, selon le plan choisi ; les add-ons sont facturés en sus. Les prix en dirhams s’entendent pour une facturation marocaine (TVA marocaine applicable) ; les prix en euros pour une facturation depuis/vers l’UE selon les règles de TVA applicables.',
          'La facturation est mensuelle ou annuelle, terme à échoir, par prélèvement ou carte via nos prestataires de paiement. Les factures sont émises sous forme électronique, numérotées séquentiellement et réputées acceptées à défaut de contestation motivée sous 15 jours.',
          'Tout retard de paiement entraîne de plein droit, après mise en demeure restée infructueuse 8 jours, la suspension de l’accès au Service, l’exigibilité immédiate des sommes dues et des pénalités de retard calculées au taux légal en vigueur, sans préjudice de l’indemnité forfaitaire de recouvrement applicable entre professionnels.',
          'Baitly peut réviser ses tarifs avec un préavis de 60 jours notifié par email ; la révision s’applique à la période de facturation suivante. En cas de désaccord, le Client peut résilier avant l’entrée en vigueur sans pénalité.',
        ],
      },
      {
        heading: 'Article 5 — Durée, résiliation et réversibilité',
        paragraphs: [
          'L’Abonnement mensuel est sans engagement et résiliable à tout moment avec effet à la fin de la période en cours. L’Abonnement annuel est résiliable à son échéance moyennant préavis de 30 jours ; il se renouvelle tacitement à défaut.',
          'Réversibilité : pendant toute la durée du contrat et pendant 60 jours après son terme, le Client peut exporter ses Données Client dans des formats standards (CSV/JSON) via les fonctions d’export du Service ou sur demande. À l’issue de ce délai, les Données Client sont supprimées des systèmes de production, puis des sauvegardes au fil de leur cycle de rotation (90 jours maximum), à l’exception des données dont la conservation est légalement requise.',
          'Baitly peut résilier de plein droit en cas de manquement grave non réparé sous 15 jours après mise en demeure (notamment défaut de paiement, usage illicite, atteinte à la sécurité).',
        ],
      },
      {
        heading: 'Article 6 — Obligations et usages interdits',
        list: [
          'Utiliser le Service conformément à sa destination, aux lois applicables (notamment hébergement touristique, fiscalité, protection des données) et aux conditions des plateformes tierces connectées ;',
          'Ne pas tenter d’accéder aux données d’autres organisations, de contourner les mesures de sécurité, ni de réaliser des tests d’intrusion sans accord écrit ;',
          'Ne pas revendre, sous-licencier ou mettre à disposition le Service à des tiers hors Utilisateurs autorisés ;',
          'Ne pas utiliser le Service pour des contenus ou activités illicites, ni pour envoyer des communications non sollicitées en violation des règles applicables ;',
          'Obtenir des voyageurs les informations et consentements requis lorsque le Client active des équipements connectés (capteurs, serrures, caméras d’extérieur).',
        ],
      },
      {
        heading: 'Article 7 — Données personnelles',
        paragraphs: [
          'Chaque partie s’engage à respecter la réglementation applicable. Pour les Données Client comportant des données personnelles, Baitly agit en qualité de sous-traitant selon l’accord de traitement des données (DPA) annexé, qui précise objet, durée, nature et finalités, catégories de données et de personnes, obligations de sécurité, conditions de recours à des sous-traitants ultérieurs, assistance et sort des données. La Politique de confidentialité complète le présent article.',
        ],
      },
      {
        heading: 'Article 8 — Fonctionnalités d’IA et responsabilité des décisions',
        paragraphs: [
          'Les agents et assistants IA du Service produisent des propositions (tarifs, réponses, affectations) fondées sur les données disponibles. Sauf activation expresse d’un mode automatique par le Client, ces propositions sont soumises à validation humaine. Le Client conserve la maîtrise et la responsabilité des décisions appliquées ; Baitly garantit la traçabilité (journal d’audit) et des garde-fous configurables (bornes tarifaires, planchers, périodes de repos), mais ne garantit pas l’atteinte de résultats économiques déterminés.',
        ],
      },
      {
        heading: 'Article 9 — Niveaux de service et support',
        paragraphs: [
          'Baitly vise une disponibilité mensuelle du Service de 99,5 %, mesurée hors fenêtres de maintenance planifiée notifiées au moins 48 heures à l’avance et hors causes exogènes (pannes des plateformes tierces, force majeure). L’état du Service et l’historique des incidents sont publiés sur la page Statut du service.',
          'Le support est accessible par email et WhatsApp aux heures ouvrées (lun.–ven., 9h–18h, heure de Rabat), avec un objectif de première réponse sous 4 heures ouvrées (1 heure ouvrée pour les incidents bloquants). Les plans Sur mesure peuvent prévoir des engagements renforcés par conditions particulières.',
        ],
      },
      {
        heading: 'Article 10 — Garanties et responsabilité',
        paragraphs: [
          'Le Service est fourni avec une obligation de moyens. Baitly ne garantit pas l’absence totale d’erreurs ni la compatibilité avec des besoins particuliers non documentés, et n’est pas responsable des décisions des plateformes tierces (déréférencement, modification d’API, suspension de compte OTA) ni des services de paiement, dont les relations contractuelles sont directes entre le Client et ces tiers.',
          'La responsabilité totale cumulée de Baitly, toutes causes confondues, est plafonnée aux sommes effectivement payées par le Client au titre des 12 derniers mois précédant le fait générateur. Sont exclus les dommages indirects (perte de chiffre d’affaires, de clientèle, d’image, de données non imputable à un manquement de Baitly à ses obligations de sauvegarde). Rien dans les présentes n’exclut la responsabilité qui ne peut l’être en vertu de la loi.',
        ],
      },
      {
        heading: 'Article 11 — Propriété intellectuelle',
        paragraphs: [
          'Le Service, ses évolutions et sa documentation demeurent la propriété exclusive de Baitly. Le Client bénéficie d’un droit d’utilisation personnel, non exclusif et non cessible pendant la durée de l’Abonnement. Les Données Client demeurent la propriété du Client, qui concède à Baitly une licence limitée aux seules fins de fourniture du Service. Baitly peut exploiter des données agrégées et anonymisées (ne permettant l’identification ni du Client ni des personnes) à des fins statistiques et d’amélioration, y compris pour ses indicateurs de marché.',
        ],
      },
      {
        heading: 'Article 12 — Confidentialité',
        paragraphs: [
          'Chaque partie s’engage à préserver la confidentialité des informations non publiques de l’autre partie dont elle aurait connaissance à l’occasion du contrat, pendant sa durée et 3 ans après son terme, sauf obligation légale de divulgation.',
        ],
      },
      {
        heading: 'Article 13 — Force majeure',
        paragraphs: [
          'Aucune partie ne sera responsable d’un manquement causé par un événement de force majeure tel que défini par la loi et la jurisprudence applicables. Si l’événement excède 30 jours, chaque partie peut résilier sans indemnité les Abonnements affectés.',
        ],
      },
      {
        heading: 'Article 14 — Divers',
        list: [
          'Sous-traitance et cession : Baitly peut recourir à des sous-traitants et céder le contrat dans le cadre d’une réorganisation, sous réserve du maintien des engagements ; le Client ne peut céder sans accord écrit.',
          'Références commerciales : sauf refus écrit, le Client autorise la mention de son nom et logo comme référence.',
          'Non-renonciation, nullité partielle, intégralité : clauses usuelles applicables.',
          'Preuve : les journaux et enregistrements du Service font foi entre les parties, sauf preuve contraire.',
        ],
      },
      {
        heading: 'Article 15 — Droit applicable et juridiction',
        paragraphs: [
          'Les présentes sont régies par le droit marocain. À défaut de résolution amiable dans les 30 jours d’une notification écrite, tout litige relèvera de la compétence exclusive du Tribunal de commerce de 〔Casablanca / Marrakech〕, nonobstant pluralité de défendeurs ou appel en garantie. Des conditions particulières peuvent stipuler un droit et un for différents pour les clients établis dans l’UE.',
        ],
      },
    ],
  },
];

export function getLegalDoc(slug: string | undefined): LegalDoc | undefined {
  return LEGAL_DOCS.find((doc) => doc.slug === slug);
}
