import type { LegalArticle } from './types';

export const MOROCCO_ARTICLES = [
  {
    slug: 'maroc-autorisation-hebergement-chez-habitant',
    country: 'MA',
    topic: 'autorisation',
    stage: 'ouvrir',
    title: 'Hébergement chez l’habitant au Maroc : obtenir son autorisation',
    description:
      'Un accueil chez soi relève d’un cadre précis : autorisation d’exploitation, dossier auprès de l’autorité locale et cahier des charges. Voici les pièces et les étapes prévues par les textes.',
    scope:
      'Hébergement chez l’habitant au sens de l’article 29 de la loi 80-14 : accueil touristique dans l’habitation où l’hôte élit domicile.',
    facts: [
      {
        value: 'Avant l’ouverture',
        label: 'autorisation d’exploitation',
      },
      {
        value: '30 jours',
        label: 'délai de décision prévu par le décret',
      },
    ],
    sections: [
      {
        title: 'Le domicile de l’hôte définit ce régime',
        paragraphs: [
          'La loi 80-14 décrit l’hébergement chez l’habitant comme un accueil sous gestion familiale, dans l’habitation où le particulier élit domicile, pour une ou plusieurs nuitées. Cette définition est le point de départ du dossier. Elle ne permet pas d’assimiler automatiquement une villa ou un appartement entier exploité en l’absence de son propriétaire à un hébergement chez l’habitant.',
          'L’article 30 soumet l’exploitation à une autorisation assortie d’un cahier des charges. Une annonce publiée ou une réservation reçue ne constitue pas cette autorisation. Le document administratif doit correspondre à la forme d’hébergement effectivement exploitée.',
        ],
        sources: ['maLaw'],
      },
      {
        title: 'Constituer le dossier auprès de l’autorité locale',
        paragraphs: [
          'Les articles 60 et 61 du décret 2-23-441 prévoient une demande déposée contre récépissé auprès de l’autorité locale compétente. Le dossier comprend le formulaire de demande, une copie de la carte nationale d’identité électronique du responsable, le contrat d’assurance, les photos des chambres et des espaces communs et le cahier des charges signé.',
          'Il comporte aussi une copie du permis d’habiter ou un certificat d’un ingénieur spécialisé attestant notamment de la sécurité, de la solidité et de la stabilité du bâtiment et du respect des règles de prévention incendie. Préparer des documents lisibles et cohérents avec les lieux facilite leur examen.',
        ],
        sources: ['maPermit'],
      },
      {
        title: 'Suivre l’instruction jusqu’à la décision',
        paragraphs: [
          'L’instruction comprend l’étude du dossier et une visite des lieux par le représentant du tourisme. Le décret prévoit une autorisation, en cas de réponse favorable, dans les 30 jours à compter du dépôt du dossier, ou la notification d’un refus motivé dans le même délai. Ce délai ne doit pas être présenté comme une autorisation automatique à son expiration.',
          'Conservez le récépissé, les pièces transmises et la décision dans un même dossier. Le titulaire reste tenu de respecter les conditions de son autorisation pendant l’exploitation.',
        ],
        sources: ['maPermit'],
      },
    ],
    checklist: [
      'Identifier la forme d’hébergement correspondant à l’activité réelle.',
      'Réunir identité, assurance, photos et justificatif de sécurité du bâtiment.',
      'Signer le cahier des charges et conserver le récépissé de dépôt.',
      'Archiver l’autorisation obtenue avant l’exploitation.',
    ],
    faq: [
      {
        q: 'L’autorisation est-elle remplacée par une inscription sur une plateforme ?',
        a: 'Non. L’article 30 exige une autorisation d’exploitation. La commercialisation du logement est une démarche distincte.',
      },
    ],
    guide: {
      en: {
        title: 'Obtain the homestay operating permit',
        copy: 'For hosting in the home where you live: apply to the local authority with identity, insurance, photographs, a building document and signed specifications. The decree provides a 30-day decision period.',
      },
      ar: {
        title: 'الحصول على ترخيص الإيواء لدى الساكن',
        copy: 'يخص الاستقبال في المسكن الذي يقيم فيه المضيف. يودع الطلب لدى السلطة المحلية مع وثائق الهوية والتأمين والصور ووثيقة سلامة المبنى ودفتر التحملات الموقع. ينص المرسوم على أجل قرار قدره 30 يوماً.',
      },
    },
  },
  {
    slug: 'maroc-renouvellement-autorisation-hebergement',
    country: 'MA',
    topic: 'autorisation',
    stage: 'suivre',
    title:
      'Autorisation d’hébergement au Maroc : validité, renouvellement et contrôle',
    description:
      'L’autorisation d’hébergement chez l’habitant est accordée pour cinq ans renouvelables. Le renouvellement suit la procédure de délivrance et les conditions restent contrôlables pendant l’exploitation.',
    scope:
      'Autorisations d’hébergement chez l’habitant et d’hébergement alternatif régies par les articles 60 à 67 du décret 2-23-441.',
    facts: [
      {
        value: '5 ans',
        label: 'validité de l’autorisation',
      },
      {
        value: 'Même procédure',
        label: 'pour le renouvellement',
      },
    ],
    sections: [
      {
        title: 'Une échéance à suivre dès la délivrance',
        paragraphs: [
          'L’article 65 du décret 2-23-441 fixe une durée de cinq ans renouvelables. Le renouvellement s’effectue selon les modalités applicables à la demande initiale, définies aux articles 60 à 64. Il s’agit donc d’une démarche à préparer avec les documents requis, et non d’une simple reconduction automatique.',
          'À réception de la décision, relevez le titulaire, le logement concerné, la date et la durée de validité. Une organisation qui gère plusieurs logements doit conserver un dossier distinct pour chaque autorisation afin de retrouver facilement la bonne décision.',
        ],
        sources: ['maPermit'],
      },
      {
        title: 'Maintenir les conditions d’exploitation',
        paragraphs: [
          'Les agents de contrôle peuvent visiter les lieux pendant la durée de validité de l’autorisation pour vérifier le respect du cahier des charges. Le procès-verbal de visite est transmis à l’autorité locale compétente. L’obtention initiale du document ne met donc pas fin aux obligations d’entretien et d’exploitation.',
          'En cas de non-conformité, l’article 67 prévoit une mise en demeure précisant un délai. L’exploitant doit notifier, contre récépissé, la mise en œuvre des observations avant l’expiration de ce délai. Une nouvelle visite vérifie leur exécution ; le défaut de mise en conformité expose au retrait de l’autorisation.',
        ],
        sources: ['maPermit'],
      },
      {
        title: 'Préparer une trace exploitable',
        paragraphs: [
          'Comme méthode d’organisation, réunissez la décision en cours, les pièces actualisées, les échanges avec l’administration et les preuves des corrections demandées. Une date d’alerte interne peut être choisie pour préparer le renouvellement ; ce rappel d’organisation ne constitue pas un délai légal supplémentaire.',
          'Baitly permet de renseigner une licence ou une autorisation par logement, son échéance et un délai d’alerte. Cette saisie facilite le suivi du dossier et laisse la démarche administrative auprès de l’autorité compétente à l’exploitant.',
        ],
        sources: ['maPermit'],
      },
    ],
    checklist: [
      'Enregistrer la date de fin de validité de chaque autorisation.',
      'Préparer le renouvellement avec les pièces de la procédure initiale.',
      'Conserver les procès-verbaux et récépissés de mise en conformité.',
    ],
    faq: [
      {
        q: 'Une alerte dans un logiciel renouvelle-t-elle l’autorisation ?',
        a: 'Non. Le renouvellement suit la procédure prévue aux articles 60 à 65. Le rappel sert à préparer cette démarche.',
      },
    ],
    guide: {
      en: {
        title: 'Track the five-year permit and renewal',
        copy: 'The permit lasts five years and is renewable through the original application procedure. Compliance with the operating specifications can be inspected throughout its validity.',
      },
      ar: {
        title: 'متابعة صلاحية الترخيص وتجديده',
        copy: 'الترخيص صالح لخمس سنوات قابلة للتجديد وفق إجراءات الطلب الأصلي. ويمكن مراقبة احترام دفتر التحملات طوال مدة الصلاحية.',
      },
    },
  },
  {
    slug: 'maroc-assurance-hebergement-chez-habitant',
    country: 'MA',
    topic: 'exploitation',
    stage: 'ouvrir',
    title:
      'Assurance obligatoire au Maroc : les garanties de l’hébergement chez l’habitant',
    description:
      'Incendie, vol des effets des clients et responsabilité civile : la loi 80-14 impose ces garanties ainsi que le renouvellement du contrat et sa présentation lors des contrôles.',
    scope:
      'Autres formes d’hébergement touristique du chapitre III de la loi 80-14, dont l’hébergement chez l’habitant.',
    facts: [
      {
        value: '3 risques',
        label: 'incendie, vol des effets, responsabilité civile',
      },
      {
        value: 'Contrat valide',
        label: 'à présenter lors des contrôles',
      },
    ],
    sections: [
      {
        title: 'Ce que prévoit l’article 34',
        paragraphs: [
          'L’exploitant doit contracter une assurance couvrant les risques d’incendie, de vol des effets des clients et de responsabilité civile. Il doit procéder régulièrement à son renouvellement et présenter le contrat lors des contrôles. Ces obligations portent sur l’activité d’hébergement et les risques explicitement visés par la loi.',
          'Une assurance souscrite pour un usage personnel du logement n’établit pas, à elle seule, que ces garanties couvrent l’accueil de voyageurs. Pour constituer le dossier, faites correspondre le contrat à l’activité et au logement concernés et gardez les conditions permettant d’identifier les garanties.',
        ],
        sources: ['maLaw'],
      },
      {
        title: 'L’assurance fait partie du dossier administratif',
        paragraphs: [
          'L’article 61 du décret 2-23-441 inclut une copie du contrat d’assurance dans la demande d’autorisation de l’hébergement chez l’habitant. Le document doit donc être disponible lors de la préparation du dossier, puis maintenu à jour pendant l’exploitation.',
          'Pour une conciergerie, une bonne méthode consiste à identifier qui souscrit, qui conserve le document et qui suit son échéance. Cette répartition pratique évite qu’un contrat soit supposé renouvelé sans que sa version actuelle figure dans le dossier du logement.',
        ],
        sources: ['maPermit', 'maLaw'],
      },
      {
        title: 'Les conséquences d’une absence de couverture',
        paragraphs: [
          'L’article 44 prévoit, pour un exploitant d’hébergement chez l’habitant qui ne souscrit pas ou ne renouvelle pas l’assurance obligatoire, une amende comprise entre 10 000 et 100 000 dirhams. Le tribunal peut également ordonner une fermeture provisoire dans les conditions prévues par cet article.',
          'Le montant d’une prime ou la présence d’une protection proposée par une plateforme ne remplace pas l’examen des garanties du contrat. Le point de contrôle utile est la couverture effective des risques exigés pour l’activité exploitée.',
        ],
        sources: ['maLaw'],
      },
    ],
    checklist: [
      'Identifier les trois garanties exigées dans le contrat.',
      'Conserver une copie avec le dossier d’autorisation.',
      'Suivre la date d’expiration et archiver les renouvellements.',
    ],
    faq: [
      {
        q: 'Faut-il conserver seulement une preuve de paiement ?',
        a: 'La loi impose de présenter le contrat d’assurance lors des contrôles. Une preuve de paiement seule ne décrit pas nécessairement les garanties.',
      },
    ],
    guide: {
      en: {
        title: 'Maintain the required insurance',
        copy: 'Article 34 requires cover for fire, theft of guests’ belongings and civil liability. Renew the contract and keep it available for inspections.',
      },
      ar: {
        title: 'الحفاظ على التأمين الإلزامي',
        copy: 'تفرض المادة 34 التأمين ضد الحريق وسرقة أمتعة الزبائن والمسؤولية المدنية، مع تجديد العقد وإتاحته عند المراقبة.',
      },
    },
  },
  {
    slug: 'maroc-teledeclaration-voyageurs-8-heures',
    country: 'MA',
    topic: 'voyageurs',
    stage: 'accueillir',
    title:
      'Déclarer les voyageurs au Maroc : la télédéclaration quotidienne avant 8 h',
    description:
      'Le décret 2-15-865 organise la transmission quotidienne des données après les arrivées et les départs. Inscription au système, horaire et responsable : les points à organiser.',
    scope:
      'Établissements et autres formes d’hébergement touristique soumis à la loi 80-14.',
    facts: [
      {
        value: 'Avant 8 h',
        label: 'télédéclaration chaque jour',
      },
      {
        value: 'Arrivées + départs',
        label: 'événements à déclarer',
      },
    ],
    sections: [
      {
        title: 'Une obligation quotidienne de l’exploitant',
        paragraphs: [
          'L’article 36 de la loi 80-14 impose la déclaration électronique quotidienne des données relatives à la clientèle. L’article premier du décret 2-15-865 précise que l’exploitant effectue cette transmission chaque jour avant huit heures, à la suite des arrivées et des départs, auprès des services compétents de la DGSN ou de la Gendarmerie royale.',
          'Le dispositif concerne la clientèle de séjour ou de passage des hébergements entrant dans ce cadre. Le texte ne limite pas cette obligation aux seuls touristes étrangers. La nationalité ne doit donc pas servir de filtre pour décider quels séjours traiter.',
        ],
        sources: ['maLaw', 'maGuests'],
      },
      {
        title: 'Disposer de l’accès officiel avant les premiers séjours',
        paragraphs: [
          'L’article 3 du décret prévoit l’inscription de l’exploitant au système de télédéclaration, ainsi que la réception et le renouvellement du certificat d’authentification ou du dongle de sécurité. Ces prérequis d’accès font partie de l’organisation de l’exploitation.',
          'Un planning de réservations ou un formulaire de pré-arrivée rassemble des informations utiles, mais ne prouve pas qu’une déclaration a été transmise aux autorités. La préparation des données et leur dépôt dans le système officiel constituent deux étapes distinctes.',
        ],
        sources: ['maGuests'],
      },
      {
        title: 'Organiser la relève du matin',
        paragraphs: [
          'Pour appliquer ce rythme quotidien, prévoyez une personne responsable, un remplaçant et une liste des arrivées et départs réellement intervenus. Comparez les données d’identité aux bulletins remplis lors de l’accueil avant de saisir ou de transmettre les informations. Il s’agit d’une méthode d’organisation, pas d’un nouveau formulaire imposé.',
          'Classez ensuite les éléments de suivi disponibles dans le système utilisé. En cas d’indisponibilité de celui-ci, le décret prévoit une procédure particulière, détaillée dans notre dossier consacré aux pannes de télédéclaration.',
        ],
        sources: ['maGuests'],
      },
    ],
    checklist: [
      'Disposer d’un accès au système officiel et des moyens d’authentification.',
      'Rapprocher quotidiennement arrivées, départs et bulletins voyageurs.',
      'Désigner le responsable de la transmission avant 8 h et son remplaçant.',
    ],
    faq: [
      {
        q: 'Un formulaire rempli avant l’arrivée vaut-il télédéclaration ?',
        a: 'Non. Il prépare les données. La transmission quotidienne dans le dispositif officiel reste une étape distincte à effectuer par l’exploitant.',
      },
    ],
    guide: {
      en: {
        title: 'Report arrivals and departures before 8 a.m.',
        copy: 'Operators must report guest data daily before 8 a.m. following arrivals and departures, to the competent DGSN or Royal Gendarmerie service, using the official reporting system.',
      },
      ar: {
        title: 'التصريح اليومي قبل الثامنة صباحاً',
        copy: 'يصرح المستغل يومياً ببيانات الزبائن عقب وصولهم ومغادرتهم قبل الثامنة صباحاً لدى المصالح المختصة للأمن الوطني أو الدرك الملكي عبر النظام الرسمي.',
      },
    },
  },
  {
    slug: 'maroc-bulletin-individuel-hebergement',
    country: 'MA',
    topic: 'voyageurs',
    stage: 'accueillir',
    title:
      'Bulletin individuel d’hébergement au Maroc : identité, signature et archivage',
    description:
      'À l’arrivée, l’exploitant demande une pièce d’identité et un bulletin renseigné et signé. La loi impose ensuite un archivage pendant une année.',
    scope:
      'Accueil des clients dans les établissements et autres formes d’hébergement touristique de la loi 80-14.',
    facts: [
      {
        value: 'À l’arrivée',
        label: 'identité et bulletin signé',
      },
      {
        value: '1 an',
        label: 'durée d’archivage prévue',
      },
    ],
    sections: [
      {
        title: 'Le bulletin complète le contrôle d’identité',
        paragraphs: [
          'L’article 37 de la loi 80-14 exige, dès l’arrivée du client, la présentation de pièces d’identité ainsi que le renseignement et la signature d’un bulletin individuel d’hébergement. Ces éléments servent notamment à la déclaration de la clientèle prévue par l’article 36.',
          'La préparation avant le séjour peut fluidifier l’accueil. Elle ne dispense pas d’obtenir les éléments et la signature requis à l’arrivée. Un nom issu d’une réservation, parfois établi au nom d’un tiers, ne suffit pas à identifier la personne effectivement hébergée.',
        ],
        sources: ['maLaw'],
      },
      {
        title: 'Utiliser le modèle réglementaire',
        paragraphs: [
          'L’annexe 1 du décret 2-15-865 contient le modèle du bulletin. Elle distingue les informations obligatoires des informations complémentaires. Les champs obligatoires comprennent notamment l’identité, la nationalité, la date de naissance, le pays de résidence, les dates de séjour et la nature et le numéro de la pièce d’identité présentée.',
          'Le formulaire comporte aussi une déclaration et une signature du client. Pour éviter de perdre cette distinction, partez du modèle officiel lors de la préparation de votre procédure d’accueil plutôt que d’ajouter des champs au hasard à un formulaire commercial.',
        ],
        sources: ['maGuests'],
      },
      {
        title: 'Conserver pendant une année et limiter les accès',
        paragraphs: [
          'L’article 38 impose l’archivage des bulletins pendant une année et leur mise à disposition des services compétents de la DGSN ou de la Gendarmerie royale, à leur demande. La déclaration électronique n’efface pas cette obligation d’archivage.',
          'Les données d’identité doivent rester accessibles aux personnes qui en ont besoin pour l’exploitation et les demandes des autorités. Comme règle d’organisation, séparez ce dossier des supports de communication destinés aux voyageurs et des documents accessibles aux intervenants qui n’ont pas à consulter ces informations.',
        ],
        sources: ['maLaw'],
      },
    ],
    checklist: [
      'Préparer le modèle officiel et ses champs obligatoires.',
      'Vérifier la pièce d’identité et recueillir la signature à l’arrivée.',
      'Classer les bulletins pour l’archivage d’un an et les demandes des autorités.',
    ],
    faq: [
      {
        q: 'La télédéclaration remplace-t-elle l’archivage du bulletin ?',
        a: 'Non. L’article 38 maintient un archivage d’une année et la mise à disposition des services compétents à leur demande.',
      },
    ],
    guide: {
      en: {
        title: 'Collect and retain the signed guest form',
        copy: 'Ask for identification and a completed, signed individual accommodation form on arrival. Keep the form for one year and provide it to the competent authorities on request.',
      },
      ar: {
        title: 'جمع بطاقة الإيواء الموقعة وحفظها',
        copy: 'تطلب وثيقة الهوية وتعبئة وتوقيع البطاقة الفردية عند الوصول. تحفظ البطاقة لمدة سنة وتوضع رهن إشارة المصالح المختصة عند طلبها.',
      },
    },
  },
  {
    slug: 'maroc-taxe-sejour-declaration-reversement',
    country: 'MA',
    topic: 'fiscalite',
    stage: 'suivre',
    title:
      'Taxe de séjour au Maroc : collecte, exonération et calendrier de reversement',
    description:
      'La loi 47-06 prévoit une taxe par personne et par nuitée, une exonération pour les moins de 12 ans, une déclaration annuelle et des versements trimestriels.',
    scope:
      'Établissements et autres formes d’hébergement touristique régis par la loi 80-14, exploités par des personnes physiques ou morales.',
    facts: [
      {
        value: 'Moins de 12 ans',
        label: 'enfants exonérés',
      },
      {
        value: 'Avant le 1er avril',
        label: 'déclaration annuelle',
      },
      {
        value: 'Trimestriel',
        label: 'reversement de la collecte',
      },
    ],
    sections: [
      {
        title: 'Appliquer le tarif à la bonne catégorie',
        paragraphs: [
          'Les articles 70 et 72 de la loi 47-06, modifiée par la loi 07-20, prévoient une taxe de séjour qui s’ajoute au prix de l’hébergement. Elle est calculée par personne et par nuitée, selon le tarif applicable à la catégorie d’hébergement. Les enfants de moins de douze ans sont exonérés par l’article 71.',
          'Le tarif dépend de la catégorie et de la décision locale prise dans le cadre légal. Il n’existe donc pas un montant unique à appliquer indistinctement à tous les logements du Maroc. Le dossier du logement doit contenir le tarif retenu, sa catégorie et la référence locale correspondante.',
        ],
        sources: ['maTax'],
      },
      {
        title: 'Faire apparaître la taxe et la reverser',
        paragraphs: [
          'L’article 76 rend les exploitants responsables du recouvrement de la taxe auprès de leurs clients et exige que son montant apparaisse distinctement sur les factures. Une présentation séparée permet au voyageur de comprendre ce qu’il paie et facilite le rapprochement des sommes collectées.',
          'Le versement est trimestriel, avant l’expiration du mois suivant chaque trimestre, auprès de la caisse du régisseur de recettes de la commune concernée ou du comptable public chargé du recouvrement. Le bordereau repose sur les clients et les nuitées de la période.',
        ],
        sources: ['maTax'],
      },
      {
        title: 'Préparer aussi la déclaration annuelle',
        paragraphs: [
          'L’article 74 prévoit une déclaration avant le premier avril de chaque année auprès du service d’assiette communal, avec le nombre de clients et de nuitées de l’année écoulée. Ce rendez-vous annuel est distinct du reversement trimestriel.',
          'Une méthode pratique consiste à rapprocher, période par période, les séjours, les exonérations, les montants facturés et les versements déjà effectués. Conservez les bordereaux et justificatifs pour expliquer tout écart entre le total des réservations et le montant de taxe dû.',
        ],
        sources: ['maTax'],
      },
    ],
    checklist: [
      'Rattacher le logement à sa catégorie et au tarif local applicable.',
      'Identifier les enfants de moins de 12 ans et distinguer la taxe sur les factures.',
      'Préparer les versements trimestriels et leurs bordereaux.',
      'Déposer la déclaration annuelle avant le 1er avril.',
    ],
    faq: [
      {
        q: 'La déclaration annuelle remplace-t-elle les versements trimestriels ?',
        a: 'Non. Les articles 74 et 76 prévoient deux obligations distinctes : une déclaration annuelle des clients et nuitées, et des versements trimestriels de la taxe.',
      },
    ],
    guide: {
      en: {
        title: 'Collect and remit the local tourist tax',
        copy: 'Apply the local category rate per person and night; children under 12 are exempt. Show the tax separately on invoices, remit quarterly and file the annual guest/night declaration before 1 April.',
      },
      ar: {
        title: 'تحصيل رسم الإقامة وأداؤه',
        copy: 'يطبق السعر المحلي حسب الصنف لكل شخص وليلة، مع إعفاء الأطفال دون 12 سنة. يظهر الرسم منفصلاً في الفاتورة ويؤدى كل ثلاثة أشهر، مع التصريح السنوي قبل فاتح أبريل.',
      },
    },
  },
  {
    slug: 'maroc-panne-teledeclaration-hebergement',
    country: 'MA',
    topic: 'voyageurs',
    stage: 'suivre',
    title: 'Panne de télédéclaration au Maroc : la procédure à suivre',
    description:
      'Une panne prolongée n’interrompt pas les obligations de déclaration. Le décret organise le dépôt des bulletins, les mesures de rétablissement et la reprise des données.',
    scope:
      'Indisponibilité du système de télédéclaration utilisé par les hébergements relevant du décret 2-15-865.',
    facts: [
      {
        value: 'Plus de 24 h',
        label: 'déclenche la procédure de dépôt',
      },
      {
        value: '72 h',
        label: 'reprise des données après rétablissement',
      },
    ],
    sections: [
      {
        title: 'Au-delà de 24 heures : déposer les bulletins',
        paragraphs: [
          'L’article 4 du décret 2-15-865 prévoit qu’en cas d’indisponibilité du système dépassant 24 heures, l’exploitant dépose une copie des bulletins individuels auprès des services compétents de la DGSN ou de la Gendarmerie royale avant huit heures du matin. La panne ne permet donc pas de suspendre simplement le traitement des arrivées.',
          'Conservez les bulletins et l’identification des séjours concernés pour éviter une perte de données pendant l’interruption. Dans votre procédure interne, notez la date de début de l’incident, les démarches réalisées et les pièces déposées.',
        ],
        sources: ['maGuests'],
      },
      {
        title: 'Agir sur la panne et préserver le suivi mensuel',
        paragraphs: [
          'Sauf cas indépendants de sa volonté, l’exploitant dispose de 48 heures pour prendre les mesures nécessaires à la résolution du problème. L’article 5 vise notamment les outils informatiques, la connexion internet, l’installation du système et l’accès à l’espace privé. Ce délai porte sur les mesures à prendre, pas sur une dispense de déclaration.',
          'Si toutes les arrivées du mois n’ont pas pu être télédéclarées, l’article 4 prévoit également un formulaire statistique des nuitées non déclarées, à déposer avant le troisième jour du mois suivant auprès des services extérieurs du ministère du Tourisme.',
        ],
        sources: ['maGuests'],
      },
      {
        title: 'Régulariser après le rétablissement',
        paragraphs: [
          'Une fois le système rétabli, l’article 6 impose de télédéclarer dans les 72 heures les données de clientèle non transmises pendant l’indisponibilité. La conservation d’une liste des séjours en attente permet de contrôler cette reprise sans confondre données déjà envoyées et données manquantes.',
          'Pour votre équipe, préparez une procédure courte avec les coordonnées du service compétent, l’emplacement des modèles et le responsable de la reprise. Ces éléments d’organisation rendent les obligations du décret plus faciles à exécuter lors d’un incident.',
        ],
        sources: ['maGuests'],
      },
    ],
    checklist: [
      'Tracer le début de l’indisponibilité et les séjours concernés.',
      'Au-delà de 24 h, déposer les copies de bulletins avant 8 h.',
      'Prendre les mesures de résolution prévues et préparer le relevé mensuel si nécessaire.',
      'Télédéclarer les données en attente dans les 72 h suivant le rétablissement.',
    ],
    faq: [
      {
        q: 'Le dépôt papier dispense-t-il de ressaisir les données ?',
        a: 'Non. L’article 6 prévoit leur télédéclaration dans les 72 heures suivant le rétablissement du système.',
      },
    ],
    guide: {
      en: {
        title: 'Use the reporting outage procedure',
        copy: 'After an outage exceeding 24 hours, submit copies of guest forms before 8 a.m. Report missing data electronically within 72 hours after service is restored.',
      },
      ar: {
        title: 'تطبيق إجراء تعطل التصريح الإلكتروني',
        copy: 'إذا تجاوز تعطل النظام 24 ساعة، تودع نسخ البطاقات قبل الثامنة صباحاً. وتصرح البيانات المتبقية إلكترونياً خلال 72 ساعة من استعادة النظام.',
      },
    },
  },
] satisfies LegalArticle[];
