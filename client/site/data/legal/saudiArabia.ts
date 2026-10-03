import type { LegalArticle } from './types';

export const SAUDI_ARTICLES = [
  {
    slug: 'arabie-saoudite-licence-unite-hospitalite-privee',
    country: 'SA',
    topic: 'autorisation',
    stage: 'ouvrir',
    title: 'Arabie saoudite : la licence d’une unité de séjour privée',
    description:
      'Depuis le règlement publié le 11 septembre 2026, l’exploitation d’une unité de séjour privée exige une licence valide du ministère du Tourisme, d’une durée maximale d’un an.',
    scope:
      'Unités de séjour privées indépendantes, rémunérées, relevant du règlement saoudien « لائحة وحدة الضيافة الخاصة » publié le 11 septembre 2026.',
    facts: [
      {
        value: '1 an maximum',
        label: 'durée de la licence',
      },
      {
        value: '1 100 SAR',
        label: 'frais de demande de délivrance',
      },
    ],
    sections: [
      {
        title: 'Une licence valide avant toute exploitation',
        paragraphs: [
          'L’article 3 du règlement interdit l’exploitation d’une unité de séjour privée sans licence, après son expiration ou son annulation, pendant sa suspension, ou lorsqu’une condition de la licence n’est plus remplie. Le document est délivré par le ministère du Tourisme pour l’unité concernée.',
          'La définition vise une unité immobilière privée et indépendante qui fournit au touriste un hébergement rémunéré. Ce dossier concerne ce régime précis. Les obligations des hôtels et autres établissements touristiques ne doivent pas être transposées automatiquement à une unité privée.',
        ],
        sources: ['saPrivate'],
      },
      {
        title: 'Instruction, visite et frais',
        paragraphs: [
          'Les articles 6 et 7 prévoient une vérification des conditions et une visite de l’unité, sur place ou par un autre moyen approuvé par le ministère. La délivrance intervient après satisfaction des conditions et paiement des frais. Le refus d’une demande doit être motivé et communiqué au demandeur.',
          'Le barème joint au règlement fixe les frais de demande de délivrance à 1 100 riyals saoudiens. Il prévoit aussi 500 riyals pour chaque visite supplémentaire après les deux premières. Ces montants ne représentent pas le coût total d’exploitation ou l’ensemble des dépenses possibles du projet.',
        ],
        sources: ['saPrivate'],
      },
      {
        title: 'Suivre la durée inscrite sur le document',
        paragraphs: [
          'L’article 8 limite la durée de validité de la licence à un an. Elle indique ses dates de délivrance et d’expiration, le titulaire et l’unité. La date portée sur la licence est donc la référence à suivre pour organiser l’exploitation.',
          'Baitly permet d’enregistrer une licence par logement, son autorité émettrice, son échéance et un délai de rappel. Ce suivi documentaire aide à préparer les démarches auprès du ministère ; il ne délivre pas la licence et ne prolonge pas sa validité.',
        ],
        sources: ['saPrivate'],
      },
    ],
    checklist: [
      'Vérifier que le bien relève du régime des unités privées.',
      'Déposer la demande et répondre aux vérifications du ministère.',
      'Conserver la licence obtenue et sa date de fin.',
      'Planifier le suivi avant l’expiration du document.',
    ],
    faq: [
      {
        q: 'Peut-on continuer à louer avec une licence expirée ?',
        a: 'L’article 3 interdit l’exploitation après expiration de la licence, ainsi que pendant sa suspension ou après son annulation.',
      },
    ],
    guide: {
      en: {
        title: 'Obtain a valid private-unit licence',
        copy: 'The September 2026 regulation requires a Tourism Ministry licence before operating. It lasts at most one year. The attached fee schedule lists SAR 1,100 for a licence issuance application.',
      },
      ar: {
        title: 'الحصول على ترخيص وحدة الضيافة الخاصة',
        copy: 'تفرض لائحة سبتمبر 2026 ترخيص وزارة السياحة قبل التشغيل، لمدة لا تتجاوز سنة. ويحدد الجدول المقابل المالي لطلب إصدار الترخيص بـ1,100 ريال.',
      },
    },
  },
  {
    slug: 'arabie-saoudite-conditions-licence-proprietaire',
    country: 'SA',
    topic: 'autorisation',
    stage: 'ouvrir',
    title:
      'Licence saoudienne : propriété, copropriété et conditions du demandeur',
    description:
      'Le règlement précise l’éligibilité du demandeur, les justificatifs immobiliers, les règles de copropriété et les conditions liées au nombre d’unités exploitées.',
    scope:
      'Demandes de licence d’unité de séjour privée selon les articles 4 à 6 du règlement publié le 11 septembre 2026.',
    facts: [
      {
        value: '3 licences',
        label:
          'maximum par titulaire dans un même immeuble partagé, sous réserve des décisions ministérielles',
      },
      {
        value: 'Au-delà de 3',
        label:
          'contrat d’entretien et de nettoyage pour l’ensemble des unités concernées',
      },
    ],
    sections: [
      {
        title: 'Qui peut déposer une demande ?',
        paragraphs: [
          'L’article 5 permet la demande à une personne de nationalité saoudienne ou à un non-Saoudien propriétaire de l’unité immobilière concernée. Le dossier doit comporter un titre de propriété électronique ou une preuve du droit d’utiliser et d’exploiter le bien pendant toute la durée de la licence.',
          'La possibilité de produire un droit d’usage ne doit pas effacer la condition spécifique posée pour le demandeur non saoudien : le texte vise celui qui est propriétaire de l’unité. Il faut lire ensemble les conditions d’éligibilité et les justificatifs demandés.',
        ],
        sources: ['saPrivate'],
      },
      {
        title: 'Vérifier l’usage immobilier et la copropriété',
        paragraphs: [
          'L’article 4 prévoit des biens à usage résidentiel, agricole ou mixte résidentiel et commercial. Il encadre aussi le nombre de licences d’un même titulaire dans un même immeuble partagé : trois au maximum, sous réserve des pouvoirs de décision du ministre prévus par le texte.',
          'Les statuts et décisions de l’association des propriétaires ne doivent pas contenir de disposition interdisant ou restreignant la location quotidienne. Le bien ne doit pas déjà relever d’une licence touristique incompatible prévue par les conditions du règlement.',
        ],
        sources: ['saPrivate'],
      },
      {
        title: 'Préparer l’exploitation de plusieurs unités',
        paragraphs: [
          'Lorsqu’une demande porte le total des licences valides du demandeur au-delà de trois, l’article 5 prévoit un contrat valide de maintenance et de nettoyage couvrant toutes les unités concernées, selon les prescriptions du ministère. Ce seuil global est distinct du plafond dans un même immeuble partagé.',
          'La souscription au système Shomoos et le respect des critères de licence font également partie des conditions. Organisez un dossier par unité, complété par les documents communs à l’exploitation, pour rendre les vérifications et la visite du ministère plus simples.',
        ],
        sources: ['saPrivate'],
      },
    ],
    checklist: [
      'Documenter l’éligibilité du demandeur et son droit sur le bien.',
      'Lire les statuts et décisions de l’association des propriétaires.',
      'Contrôler le nombre de licences par immeuble et au total.',
      'Préparer le contrat de maintenance et de nettoyage lorsqu’il est requis.',
    ],
    faq: [
      {
        q: 'Les deux seuils de trois licences désignent-ils la même règle ?',
        a: 'Non. L’article 4 encadre les licences d’un titulaire dans un même immeuble partagé. L’article 5 lie un contrat de maintenance et de nettoyage au dépassement de trois licences valides au total.',
      },
    ],
    guide: {
      en: {
        title: 'Check ownership and building conditions',
        copy: 'Applicants must be Saudi or non-Saudi owners of the unit. Check property rights, condominium rules and licence-count conditions; maintenance and cleaning contracts are required when the application brings the total above three valid licences.',
      },
      ar: {
        title: 'مراجعة شروط الملكية والعقار',
        copy: 'يكون المتقدم سعودياً أو غير سعودي مالكاً للوحدة. تراجع سندات الانتفاع ونظام الملاك وحدود عدد التراخيص. ويطلب عقد صيانة ونظافة عند تجاوز ثلاث رخص سارية إجمالاً.',
      },
    },
  },
  {
    slug: 'arabie-saoudite-shomoos-unite-privee',
    country: 'SA',
    topic: 'autorisation',
    stage: 'ouvrir',
    title:
      'Shomoos en Arabie saoudite : une condition de licence de l’unité privée',
    description:
      'L’inscription au système Shomoos figure expressément parmi les conditions de demande de licence. Elle se prépare en même temps que les pièces du logement et du demandeur.',
    scope:
      'Demandeurs de licence d’unité de séjour privée relevant de l’article 5 du règlement du 11 septembre 2026.',
    facts: [
      {
        value: 'Article 5.5',
        label: 'souscription à Shomoos requise',
      },
      {
        value: 'Avant la licence',
        label: 'condition du dossier',
      },
    ],
    sections: [
      {
        title: 'Une condition inscrite dans le règlement',
        paragraphs: [
          'Le point 5 de l’article 5 exige la souscription au système Shomoos lors de la demande de licence d’une unité de séjour privée. Cette condition figure avec les justificatifs immobiliers, les règles de copropriété et les critères d’exploitation. Elle doit donc être intégrée à la préparation du dossier.',
          'Le texte applicable est celui publié le 11 septembre 2026. Pour une procédure de création ou de mise à jour du dossier, il est utile de travailler à partir de cette version officielle et de conserver la référence réglementaire avec les autres pièces.',
        ],
        sources: ['saPrivate'],
      },
      {
        title: 'Préparer un accès géré par le bon responsable',
        paragraphs: [
          'Comme méthode d’organisation, désignez la personne chargée de l’accès officiel, de son suivi et des échanges nécessaires avec le service concerné. Cette responsabilité doit être connue de l’exploitant et de l’équipe qui prépare le dossier de licence.',
          'L’inscription exigée par le règlement et l’existence d’un fichier clients dans un logiciel de gestion sont deux choses différentes. Un compte dans un PMS, un formulaire de pré-arrivée ou un livret d’accueil ne constitue pas une souscription au système Shomoos.',
        ],
        sources: ['saPrivate'],
      },
      {
        title: 'Conserver des pièces cohérentes pour l’instruction',
        paragraphs: [
          'Les articles 6 et 7 prévoient la vérification des conditions du demandeur avant la délivrance de la licence. Rassemblez donc les justificatifs correspondant à l’exploitant et à l’unité exacte, et gardez les documents utiles pour expliquer comment chaque condition de l’article 5 est satisfaite.',
          'La préparation de ce dossier peut être répartie entre propriétaire et gestionnaire, mais cette répartition interne ne doit pas masquer l’identité du titulaire de la licence. Un suivi documentaire clair facilite les échanges et les corrections éventuelles demandées par le ministère.',
        ],
        sources: ['saPrivate'],
      },
    ],
    checklist: [
      'Inclure la condition Shomoos dans la préparation de la licence.',
      'Identifier le responsable de l’accès officiel et du dossier.',
      'Conserver les justificatifs associés au titulaire et à l’unité.',
    ],
    faq: [
      {
        q: 'Un compte Baitly remplace-t-il l’inscription à Shomoos ?',
        a: 'Non. La condition de l’article 5.5 concerne le système Shomoos. L’utilisation d’un logiciel de gestion est distincte de cette inscription.',
      },
    ],
    guide: {
      en: {
        title: 'Subscribe to Shomoos for the licence application',
        copy: 'Article 5.5 expressly requires subscription to Shomoos. A property-management account or guest form does not replace that official subscription.',
      },
      ar: {
        title: 'الاشتراك في شموس ضمن شروط الترخيص',
        copy: 'تشترط الفقرة الخامسة من المادة الخامسة الاشتراك في نظام شموس. حساب برنامج إدارة العقارات أو نموذج بيانات الضيف لا يحل محل هذا الاشتراك.',
      },
    },
  },
  {
    slug: 'arabie-saoudite-reservation-paiement-unite-privee',
    country: 'SA',
    topic: 'exploitation',
    stage: 'ouvrir',
    title:
      'Réservations et paiements en Arabie saoudite : les canaux autorisés',
    description:
      'Les unités de séjour privées doivent passer par un prestataire de voyages et tourisme au sens du règlement pour les réservations et les sommes réclamées ou reçues du voyageur.',
    scope:
      'Commercialisation et paiement des unités de séjour privées régies par les articles 1 et 16 du règlement du 11 septembre 2026.',
    facts: [
      {
        value: 'Canal habilité',
        label: 'réservations et paiements',
      },
      {
        value: 'Mise à jour directe',
        label: 'disponibilité chez les prestataires',
      },
    ],
    sections: [
      {
        title: 'Identifier un prestataire au sens du texte',
        paragraphs: [
          'L’article 1 définit le prestataire de voyages et tourisme comme un acteur autorisé par le ministère à exercer cette activité ou une plateforme électronique approuvée par le ministère. Cette définition encadre ensuite les règles de réservation et de paiement de l’article 16.',
          'La présence d’un bouton de réservation ou d’un moyen de paiement en ligne ne suffit pas à démontrer cette qualité. Le choix du canal doit reposer sur son statut au regard du ministère pour l’activité concernée.',
        ],
        sources: ['saPrivate'],
      },
      {
        title: 'Faire passer réservation et paiement par ce canal',
        paragraphs: [
          'L’article 16 interdit de fournir le service de réservation de l’unité en dehors d’un prestataire de voyages et tourisme. Il interdit aussi de réclamer ou de recevoir un montant du touriste autrement que par ce prestataire. Ces deux obligations portent sur le parcours commercial et sur l’encaissement.',
          'Un hôte doit donc organiser ses annonces, confirmations et demandes de paiement autour du canal conforme à cette définition. Une fonctionnalité de réservation directe proposée par un logiciel ne vaut pas, à elle seule, approbation réglementaire de ce canal.',
        ],
        sources: ['saPrivate'],
      },
      {
        title: 'Respecter la réservation et tenir la disponibilité à jour',
        paragraphs: [
          'Le même article impose de fournir le service selon le document de réservation, de mettre directement à jour l’état de disponibilité auprès des prestataires pour éviter les doublons et de permettre l’arrivée et le départ aux horaires prévus dans ce document.',
          'Pour l’équipe, la bonne pratique consiste à rapprocher le document confirmé, le planning et les consignes transmises au voyageur. Les changements de disponibilité doivent être traités rapidement afin qu’une unité déjà réservée ne reste pas commercialisée comme libre.',
        ],
        sources: ['saPrivate'],
      },
    ],
    checklist: [
      'Vérifier le statut du prestataire ou de la plateforme auprès du ministère.',
      'Faire passer réservations et paiements par le canal requis.',
      'Synchroniser la disponibilité avec les réservations confirmées.',
      'Respecter les services et horaires du document de réservation.',
    ],
    faq: [
      {
        q: 'Un logiciel de réservation suffit-il à rendre un canal autorisé ?',
        a: 'Non. Le règlement définit le prestataire par sa licence ou l’approbation ministérielle de la plateforme, et non par ses seules fonctionnalités techniques.',
      },
    ],
    guide: {
      en: {
        title: 'Use licensed or approved booking channels',
        copy: 'Bookings and amounts requested or received from guests must go through a travel-and-tourism provider as defined by the regulation. Keep availability current and honour the booking document.',
      },
      ar: {
        title: 'استخدام قنوات الحجز والدفع المعتمدة',
        copy: 'تتم الحجوزات وأي مبالغ تطلب أو تستلم من السائح عبر مقدم خدمات السفر والسياحة وفق تعريف اللائحة، مع تحديث التوفر والالتزام بمستند الحجز.',
      },
    },
  },
  {
    slug: 'arabie-saoudite-duree-sejour-29-90-jours',
    country: 'SA',
    topic: 'exploitation',
    stage: 'suivre',
    title: 'Séjours en Arabie saoudite : la règle des 29 jours et des 90 jours',
    description:
      'Pour une même unité privée et un même touriste, le règlement limite chaque période continue à 29 jours et le cumul à 90 jours pendant la validité de la licence.',
    scope:
      'Séjours rémunérés d’un même touriste dans une même unité de séjour privée, pendant la période de validité de sa licence.',
    facts: [
      {
        value: '29 jours',
        label: 'maximum consécutif',
      },
      {
        value: '90 jours',
        label: 'cumul par touriste, unité et licence',
      },
    ],
    sections: [
      {
        title: 'Deux compteurs complémentaires',
        paragraphs: [
          'L’article 11.6 du règlement du 11 septembre 2026 pose deux limites : pas plus de 29 jours consécutifs d’hébergement rémunéré pour un touriste, et pas plus de 90 jours cumulés pour ce même touriste dans la même unité pendant la validité de la licence.',
          'Ces compteurs ne mesurent pas la même chose. Le premier regarde la continuité du séjour. Le second additionne les périodes concernées, même lorsqu’elles sont séparées, sur la période de validité de la licence de l’unité.',
        ],
        sources: ['saPrivate'],
      },
      {
        title: 'Rattacher le suivi au voyageur et à la bonne période',
        paragraphs: [
          'La limite de 90 jours du texte n’est pas un plafond global de commercialisation du logement pour tous les voyageurs. Elle porte sur le même touriste, dans la même unité. Elle ne doit pas non plus être présentée comme un compteur qui repart nécessairement au 1er janvier : le règlement vise la durée de validité de la licence.',
          'Pour préparer un suivi fiable, rapprochez l’identité du voyageur, les dates des séjours et la licence concernée. Le découpage administratif d’une réservation en plusieurs dossiers ne suffit pas à expliquer la durée réelle de l’hébergement.',
        ],
        sources: ['saPrivate'],
      },
      {
        title: 'Vérifier les prolongations avant de les confirmer',
        paragraphs: [
          'Une prolongation doit être examinée au regard de la période continue et du cumul déjà réalisé par le touriste dans l’unité. Cette vérification est utile avant de modifier une réservation confirmée, afin de ne pas découvrir le dépassement une fois le séjour prolongé.',
          'Comme méthode de gestion, conservez un historique lisible des périodes concernées et prévoyez un contrôle lors de la validation des changements. La règle saoudienne ne se confond pas avec le plafond annuel français d’une résidence principale : le pays et le régime du logement déterminent le compteur à utiliser.',
        ],
        sources: ['saPrivate'],
      },
    ],
    checklist: [
      'Suivre les jours consécutifs de chaque séjour.',
      'Additionner les périodes du même touriste dans la même unité.',
      'Rattacher le cumul à la validité de la licence.',
      'Contrôler les deux limites avant toute prolongation.',
    ],
    faq: [
      {
        q: 'Le plafond de 90 jours limite-t-il toutes les locations de l’unité ?',
        a: 'Non. L’article 11.6 vise le cumul pour un même touriste dans la même unité pendant la durée de validité de la licence.',
      },
    ],
    guide: {
      en: {
        title: 'Track the 29-day and 90-day guest limits',
        copy: 'A guest may stay at most 29 consecutive days and 90 cumulative days in the same private unit during its licence period. The 90-day limit is per guest, not total property occupancy.',
      },
      ar: {
        title: 'متابعة حد 29 يوماً وحد 90 يوماً',
        copy: 'الحد 29 يوماً متصلة و90 يوماً إجمالاً للسائح نفسه في الوحدة نفسها خلال صلاحية الترخيص. لا يمثل حد 90 يوماً مجموع إشغال الوحدة لجميع الضيوف.',
      },
    },
  },
  {
    slug: 'arabie-saoudite-accueil-proprete-annonces',
    country: 'SA',
    topic: 'exploitation',
    stage: 'accueillir',
    title: 'Accueil en Arabie saoudite : propreté, annonce fidèle et consignes',
    description:
      'Le règlement impose une unité prête à l’arrivée, des annonces conformes à la réalité et des consignes communiquées avant l’entrée du voyageur.',
    scope:
      'Qualité de service et obligations d’information des exploitants d’unités de séjour privées, articles 11 et 12.',
    facts: [
      {
        value: 'Avant l’arrivée',
        label: 'logement propre, entretenu et prêt',
      },
      {
        value: 'Photos fidèles',
        label: 'annonce conforme à la réalité',
      },
    ],
    sections: [
      {
        title: 'Une annonce qui décrit réellement le logement',
        paragraphs: [
          'L’article 12 impose l’utilisation d’informations, de données et d’images correspondant à la réalité de l’unité. La capacité d’accueil doit être annoncée lors de la commercialisation et rappelée au touriste pour qu’elle soit respectée.',
          'Un équipement retiré, une pièce rendue inaccessible ou une capacité modifiée doit donc conduire à revoir les informations diffusées. La cohérence entre l’annonce, le document de réservation et le logement préparé est un élément concret de la qualité exigée.',
        ],
        sources: ['saPrivate'],
      },
      {
        title: 'Préparer l’unité et informer le voyageur',
        paragraphs: [
          'L’unité doit être prête, propre et entretenue avant l’enregistrement du touriste. Avant son arrivée, l’exploitant doit lui communiquer, par l’intermédiaire du prestataire de voyages et tourisme, les règles générales d’utilisation et les possibilités d’accès aux installations associées, telles qu’un jardin ou une salle de sport.',
          'Une procédure d’équipe peut distinguer le nettoyage, le contrôle des équipements et la vérification finale avant l’arrivée. Un livret d’accueil sert à regrouper des consignes lisibles ; le canal de communication exigé par le règlement doit rester respecté.',
        ],
        sources: ['saPrivate'],
      },
      {
        title: 'Afficher la licence et respecter le service confirmé',
        paragraphs: [
          'L’article 11 prévoit une licence clairement visible à l’intérieur de l’unité et une signalétique à l’entrée, selon les prescriptions techniques du ministère. L’article 12 interdit de refuser le service lorsqu’un document de réservation est confirmé sans motif légalement acceptable.',
          'Conservez une version actuelle des consignes et attribuez à une personne le contrôle final du logement. Cette organisation aide à détecter un équipement indisponible avant l’arrivée et à traiter la situation dans le cadre de la réservation confirmée.',
        ],
        sources: ['saPrivate'],
      },
    ],
    checklist: [
      'Actualiser les photos, équipements et capacité annoncés.',
      'Contrôler propreté, entretien et disponibilité avant l’arrivée.',
      'Transmettre les règles et accès via le prestataire concerné.',
      'Afficher la licence et la signalétique requise.',
    ],
    faq: [
      {
        q: 'Les règles d’usage peuvent-elles attendre l’entrée du voyageur ?',
        a: 'L’article 12 prévoit leur communication avant l’enregistrement, par l’intermédiaire du prestataire de voyages et tourisme.',
      },
    ],
    guide: {
      en: {
        title: 'Prepare the home and communicate accurate information',
        copy: 'Keep photographs and capacity accurate. The unit must be clean, maintained and ready before check-in. Communicate usage rules beforehand through the travel-and-tourism provider.',
      },
      ar: {
        title: 'تجهيز الوحدة وتقديم معلومات مطابقة للواقع',
        copy: 'تطابق الصور والطاقة الاستيعابية الواقع، وتكون الوحدة جاهزة ونظيفة قبل الوصول. تبلغ ضوابط الاستخدام قبل الدخول عبر مقدم خدمات السفر والسياحة.',
      },
    },
  },
  {
    slug: 'arabie-saoudite-prix-services-supplementaires',
    country: 'SA',
    topic: 'exploitation',
    stage: 'ouvrir',
    title:
      'Services supplémentaires en Arabie saoudite : afficher les prix en arabe et en anglais',
    description:
      'Pour les unités privées, les prix des services supplémentaires doivent être annoncés dans les deux langues, inclure les taxes et frais réglementaires et être respectés.',
    scope:
      'Services supplémentaires proposés aux touristes par un exploitant d’unité de séjour privée, articles 14 et 16.',
    facts: [
      {
        value: 'Arabe + anglais',
        label: 'liste des prix des services',
      },
      {
        value: 'Frais inclus',
        label: 'présentation des prix annoncés',
      },
    ],
    sections: [
      {
        title: 'Une liste de prix compréhensible avant l’achat',
        paragraphs: [
          'L’article 14 demande d’annoncer au touriste, par l’intermédiaire du prestataire de voyages et tourisme, la liste des prix des services supplémentaires lorsqu’ils existent. Cette information doit être fournie en arabe et en anglais et inclure les taxes et frais réglementaires. L’exploitant doit respecter les prix annoncés.',
          'La même prestation doit donc être décrite et tarifée de façon cohérente dans les deux langues. Une différence de prix entre la présentation et la demande finale de paiement rend le parcours difficile à comprendre et contraire à l’exigence de transparence posée par le texte.',
        ],
        sources: ['saPrivate'],
      },
      {
        title: 'Organiser la vente dans le canal requis',
        paragraphs: [
          'La règle de prix s’articule avec l’article 16, qui encadre les montants demandés ou reçus du voyageur par le prestataire de voyages et tourisme. Un supplément ne doit pas être traité comme une occasion de sortir du parcours de paiement imposé par le règlement.',
          'Pour une prestation comme un service additionnel d’accueil ou d’entretien, préparez une description, les conditions de réalisation et le prix complet. Le nom de la prestation dans le catalogue, la confirmation et le relevé de paiement doit permettre de la reconnaître.',
        ],
        sources: ['saPrivate'],
      },
      {
        title: 'Maintenir une version commune pour toute l’équipe',
        paragraphs: [
          'Comme méthode d’exploitation, attribuez une date de mise à jour à votre liste interne et retirez les anciennes versions des supports utilisés. Lorsqu’un service change, actualisez les deux langues ensemble pour que le voyageur et l’équipe disposent de la même information.',
          'Le prix complet doit être celui communiqué par le canal concerné. Une liste de services dans un logiciel peut faciliter la préparation du catalogue, mais la présence de cette fonctionnalité ne vaut pas autorisation du canal de vente au sens du règlement saoudien.',
        ],
        sources: ['saPrivate'],
      },
    ],
    checklist: [
      'Préparer la liste des prix en arabe et en anglais.',
      'Inclure les taxes et frais réglementaires dans les prix annoncés.',
      'Respecter les montants communiqués au voyageur.',
      'Utiliser le prestataire requis pour les demandes et réceptions de paiement.',
    ],
    faq: [
      {
        q: 'Une liste de prix uniquement en français ou en anglais suffit-elle ?',
        a: 'L’article 14 exige l’arabe et l’anglais pour l’annonce des prix des services supplémentaires concernés.',
      },
    ],
    guide: {
      en: {
        title: 'Show extras prices in Arabic and English',
        copy: 'Announce additional-service prices in both languages through the required provider, including statutory fees and taxes, and honour those prices. Payments follow article 16.',
      },
      ar: {
        title: 'إعلان أسعار الخدمات الإضافية بالعربية والإنجليزية',
        copy: 'تعلن الأسعار باللغتين عبر مقدم الخدمة مع الرسوم والضرائب النظامية، ويلتزم بها. وتخضع المطالبة بالمبالغ واستلامها للمادة 16.',
      },
    },
  },
  {
    slug: 'arabie-saoudite-confidentialite-securite-voyageurs',
    country: 'SA',
    topic: 'voyageurs',
    stage: 'accueillir',
    title: 'Vie privée et sécurité des voyageurs en Arabie saoudite',
    description:
      'L’accès à l’unité occupée, les données personnelles et les incidents de sécurité sont encadrés par l’article 15 du règlement des unités privées.',
    scope:
      'Protection du touriste et sécurité de l’unité de séjour privée pendant le séjour.',
    facts: [
      {
        value: 'Accès encadré',
        label: 'après l’enregistrement',
      },
      {
        value: 'Signalement immédiat',
        label: 'incidents de sécurité',
      },
    ],
    sections: [
      {
        title: 'Protéger les informations du voyageur',
        paragraphs: [
          'L’article 15 impose de préserver la confidentialité et la vie privée des données du touriste. Il encadre leur partage et leur utilisation au regard des lois et règlements saoudiens et du consentement écrit mentionné par le texte. Les informations reçues pour organiser un séjour ne doivent pas être diffusées sans cadre.',
          'Pour l’équipe, définissez qui a besoin des données d’identité, des coordonnées et des informations de réservation. Un intervenant chargé du ménage peut avoir besoin d’un horaire de départ sans avoir accès à l’ensemble du dossier personnel du voyageur. Cette séparation est une mesure d’organisation pratique.',
        ],
        sources: ['saPrivate'],
      },
      {
        title: 'Respecter l’espace privé après l’arrivée',
        paragraphs: [
          'Le règlement interdit d’ouvrir l’unité après l’enregistrement sans l’autorisation du touriste ou l’accord des autorités de sécurité, que le touriste soit présent ou absent. Une disponibilité technique du code d’accès ne constitue donc pas une permission générale d’entrer.',
          'Il interdit aussi de prendre une mesure destinée à forcer le touriste à quitter l’unité après son arrivée, sauf par l’intermédiaire des autorités de sécurité et selon les dispositions applicables. Les litiges doivent être traités dans ce cadre.',
        ],
        sources: ['saPrivate'],
      },
      {
        title: 'Prévoir le signalement des incidents',
        paragraphs: [
          'Tout incident lié à la sécurité du touriste pendant sa présence, ou à la sécurité de l’unité, doit être signalé immédiatement aux autorités compétentes et au ministère par les canaux prévus. L’équipe doit connaître ces destinataires et les moyens de les contacter.',
          'Une procédure interne courte peut réunir les contacts, le rôle de chaque intervenant et les informations à consigner sur l’événement. Elle permet de réagir sans improviser ni diffuser inutilement les données du voyageur à des personnes étrangères au traitement de l’incident.',
        ],
        sources: ['saPrivate'],
      },
    ],
    checklist: [
      'Limiter les accès aux données selon les responsabilités de chacun.',
      'Obtenir l’autorisation requise avant d’ouvrir l’unité occupée.',
      'Préparer les contacts et canaux de signalement des incidents.',
      'Informer les intervenants des règles d’accès et de confidentialité.',
    ],
    faq: [
      {
        q: 'L’absence momentanée du voyageur permet-elle d’entrer librement ?',
        a: 'Non. L’article 15 encadre l’ouverture de l’unité après l’enregistrement, que le touriste soit présent ou absent.',
      },
    ],
    guide: {
      en: {
        title: 'Protect guest privacy and report safety incidents',
        copy: 'Access after check-in requires the guest’s permission or security-authority approval, even when the guest is absent. Protect personal data and immediately report safety incidents through the designated channels.',
      },
      ar: {
        title: 'حماية خصوصية السائح والإبلاغ عن حوادث السلامة',
        copy: 'لا تفتح الوحدة بعد الدخول إلا بإذن السائح أو موافقة الجهات الأمنية، ولو كان غائباً. تحمى بياناته ويبلغ فوراً عن حوادث الأمن والسلامة عبر القنوات المخصصة.',
      },
    },
  },
  {
    slug: 'arabie-saoudite-redevance-municipale-occupation',
    country: 'SA',
    topic: 'fiscalite',
    stage: 'suivre',
    title:
      'Redevance municipale d’occupation en Arabie saoudite : 2,5 % ou 5 % par nuit, déclarée chaque mois',
    description:
      'Le règlement des redevances de services municipaux fixe une redevance par nuit occupée : 5 % du prix pour les établissements classés quatre étoiles et plus, 2,5 % pour les autres, à déclarer et payer chaque mois.',
    scope:
      'Établissements d’hébergement touristique classés par le ministère du Tourisme : poste 16 du tableau 1 et articles 28 et 29 du règlement des redevances de services municipaux, modifié par l’arrêté 1/762126 du 24/10/1444 H.',
    facts: [
      {
        value: '5 %',
        label: 'du prix de la nuit en quatre étoiles et plus',
      },
      {
        value: '2,5 %',
        label: 'pour les autres classements et les camps',
      },
      {
        value: 'Avant le 15',
        label: 'paiement du mois écoulé',
      },
    ],
    sections: [
      {
        title: 'Un pourcentage du prix de chaque nuit occupée',
        paragraphs: [
          'L’article 28 du règlement prévoit une redevance sur l’occupation des unités des établissements d’hébergement touristique, selon les classements du ministère du Tourisme. Elle se calcule pour chaque unité et chaque nuit occupée, à partir du loyer de l’unité, et non par voyageur.',
          'Le poste 16 du tableau 1 fixe deux taux. Les établissements classés quatre étoiles et plus, à l’exception des camps, paient 5 % du prix de la nuit. Les établissements classés trois étoiles ou de première catégorie, deux étoiles ou économiques, une étoile, les camps de toutes catégories et toute classification non listée paient 2,5 %.',
        ],
        sources: ['saMunicipalFees'],
      },
      {
        title: 'Le même taux dans toutes les villes',
        paragraphs: [
          'Le règlement classe les municipalités en catégories, mais ce classement sert à d’autres redevances, exprimées en riyals selon la catégorie de la municipalité. La redevance d’occupation s’exprime en pourcentage unique : elle ne varie pas entre Riyad, Djeddah, Médine ou une ville moyenne.',
          'Le taux dépend donc du seul classement de l’établissement. Le règlement des unités de séjour privées ne prévoit, de son côté, que le droit de délivrance de la licence. Pour une unité privée, rattachée par défaut à la ligne « toute classification non listée », vérifiez le taux appliqué sur la plateforme Balady avant la première déclaration.',
        ],
        sources: ['saMunicipalFees', 'saPrivate'],
      },
      {
        title: 'Une déclaration mensuelle sur Balady',
        paragraphs: [
          'L’article 29 impose de présenter à la municipalité, dans les cinq premiers jours de chaque mois grégorien, un compte des unités occupées, avec le montant de la redevance en ligne distincte. La redevance est payée au plus tard le quinze du mois. La municipalité peut contrôler l’exactitude de ce compte.',
          'Le service en ligne de Balady permet d’enregistrer l’établissement, de déposer les déclarations mensuelles d’occupation et de payer selon la catégorie. Tenez un relevé mensuel des nuits occupées et du prix de chaque nuit : il sert de base à la déclaration et à tout contrôle.',
        ],
        sources: ['saMunicipalFees', 'saBalady'],
      },
    ],
    checklist: [
      'Identifier le classement de l’établissement délivré par le ministère du Tourisme.',
      'Appliquer 5 % en quatre étoiles et plus, 2,5 % dans les autres cas.',
      'Calculer la redevance pour chaque unité et chaque nuit occupée.',
      'Déclarer sur Balady avant le 5 et payer avant le 15 de chaque mois.',
    ],
    faq: [
      {
        q: 'Le taux change-t-il selon la ville ?',
        a: 'Non. Le poste 16 fixe un pourcentage unique ; le classement des municipalités ne concerne que les redevances exprimées en riyals.',
      },
      {
        q: 'La redevance se calcule-t-elle par voyageur ?',
        a: 'Non. Elle porte sur le loyer de chaque unité, pour chaque nuit occupée, quel que soit le nombre d’occupants.',
      },
    ],
    guide: {
      en: {
        title: 'Declare the municipal occupancy fee every month',
        copy: 'The municipal fee is 5% of the nightly rate for establishments rated four stars and above, and 2.5% for all others, nationwide. Declare occupied nights on Balady within the first five days of each month and pay by the 15th.',
      },
      ar: {
        title: 'التصريح الشهري برسم إشغال مرافق الضيافة',
        copy: 'رسم الإشغال 5٪ من أجرة الليلة للمنشآت المصنفة أربع نجوم فأعلى، و2.5٪ لغيرها، في جميع المدن. يقدم الحساب الشهري عبر منصة بلدي خلال الأيام الخمسة الأولى ويسدد قبل يوم 15.',
      },
    },
  },
] satisfies LegalArticle[];
