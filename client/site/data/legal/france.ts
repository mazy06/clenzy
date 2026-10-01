import type { LegalArticle } from './types';

export const FRANCE_ARTICLES = [
  {
    slug: 'france-enregistrement-meuble-tourisme',
    country: 'FR',
    topic: 'autorisation',
    stage: 'ouvrir',
    title:
      'Meublé de tourisme en France : déclaration et numéro d’enregistrement',
    description:
      'Déclaration du logement, numéro à conserver et données à mettre à jour : comprendre le cadre d’enregistrement sans confondre la démarche du loueur avec l’API des plateformes.',
    scope:
      'Meublés de tourisme définis par l’article L324-1-1 du Code du tourisme : villas, appartements et studios meublés à usage exclusif du voyageur.',
    facts: [
      {
        value: 'Avant de louer',
        label: 'déclaration du meublé',
      },
      {
        value: 'Par logement',
        label: 'numéro et dossier propres au bien',
      },
    ],
    sections: [
      {
        title: 'Ce que prévoit le Code du tourisme',
        paragraphs: [
          'Dans sa version en vigueur depuis le 20 mai 2026, l’article L324-1-1 prévoit une déclaration préalable soumise à enregistrement auprès d’un téléservice national. Le loueur indique notamment si le logement est sa résidence principale et en apporte la preuve dans ce cas. Une déclaration complète donne lieu à un avis de réception comprenant un numéro de déclaration.',
          'Le texte impose aussi de mettre à jour les informations et pièces qui changent. Un changement de situation du logement ou du loueur doit donc être suivi dans le dossier, au lieu de laisser les anciennes informations se propager d’une annonce à l’autre.',
        ],
        sources: ['frRegistration'],
      },
      {
        title: 'Distinguer la règle et le parcours administratif',
        paragraphs: [
          'La Direction générale des entreprises distingue le téléservice d’enregistrement des loueurs de l’API meublés, destinée aux échanges de données entre intermédiaires et collectivités. Un loueur n’a pas à créer un compte sur cette API pour accomplir sa démarche d’enregistrement. Utilisez les instructions officielles de la DGE et le parcours indiqué par votre commune pour le logement concerné.',
          'Conservez le récépissé et reportez le numéro délivré dans les annonces lorsque requis. Le SIRET utilisé pour l’activité fiscale et le numéro de déclaration du logement répondent à des finalités différentes : l’un ne remplace pas l’autre.',
        ],
        sources: ['frDge', 'frHome'],
      },
      {
        title: 'Construire un dossier par bien',
        paragraphs: [
          'Préparez une fiche comportant l’adresse exacte, l’identité du loueur, la qualification résidence principale ou secondaire et les pièces transmises. Ajoutez les démarches distinctes éventuellement nécessaires, comme l’autorisation de changement d’usage : un numéro d’enregistrement ne constitue pas à lui seul cette autorisation.',
          'Baitly dispose d’un champ de numéro d’enregistrement rattaché au logement dans sa configuration réglementaire. Il permet de centraliser la référence obtenue ; l’enregistrement officiel reste une démarche auprès du service compétent.',
        ],
        sources: ['frRegistration', 'frSecond'],
      },
    ],
    checklist: [
      'Identifier le statut réel du logement et l’adresse exacte.',
      'Suivre le parcours officiel d’enregistrement et archiver le récépissé.',
      'Reporter le numéro dans les annonces concernées.',
      'Mettre à jour le dossier lorsque les informations changent.',
    ],
    faq: [
      {
        q: 'Le SIRET est-il le numéro d’enregistrement du logement ?',
        a: 'Non. Le SIRET identifie l’activité auprès des services fiscaux. Le numéro de déclaration concerne le meublé de tourisme.',
      },
    ],
    guide: {
      en: {
        title: 'Declare the property and retain its registration number',
        copy: 'Article L324-1-1 provides for prior registration. Keep the receipt, identify whether the property is your main home, and update changed information. The operator’s registration service is distinct from the platforms’ API.',
      },
      ar: {
        title: 'التصريح بالعقار وحفظ رقم التسجيل',
        copy: 'تنص المادة L324-1-1 على التسجيل المسبق. يحتفظ بالوصل وتحدد صفة السكن الرئيسي وتحدث البيانات المتغيرة. خدمة تسجيل المؤجر منفصلة عن واجهة بيانات المنصات.',
      },
    },
  },
  {
    slug: 'france-residence-principale-90-120-jours',
    country: 'FR',
    topic: 'exploitation',
    stage: 'suivre',
    title:
      'Résidence principale : comprendre la limite de 90 à 120 jours de location',
    description:
      'Le plafond annuel de la résidence principale dépend de la décision communale. Il se distingue de la limite de séjour d’un même voyageur et doit être suivi tous canaux confondus.',
    scope:
      'Meublé de tourisme déclaré comme résidence principale du loueur, sous réserve des exceptions légales.',
    facts: [
      {
        value: '120 jours/an',
        label: 'plafond légal de principe',
      },
      {
        value: 'Jusqu’à 90 jours',
        label: 'abaissement possible par la commune',
      },
      {
        value: '1 mois',
        label: 'pour répondre à la demande de décompte',
      },
    ],
    sections: [
      {
        title: 'Un plafond annuel attaché à la résidence principale',
        paragraphs: [
          'L’article L324-1-1 IV fixe un maximum de 120 jours de location au cours d’une même année civile pour un meublé déclaré comme résidence principale. Une délibération motivée de la commune peut abaisser ce plafond, dans la limite de 90 jours. Le bon seuil est donc celui applicable à l’adresse du logement.',
          'Le texte prévoit des exceptions pour obligation professionnelle, raison de santé ou force majeure. Elles ne doivent pas être utilisées comme un dépassement automatique disponible à tout loueur. La situation réelle et les justificatifs correspondants restent déterminants.',
        ],
        sources: ['frRegistration'],
      },
      {
        title: 'Ne pas confondre total annuel et durée d’un séjour',
        paragraphs: [
          'Le plafond annuel concerne le logement sur l’ensemble de l’année civile. La règle des 90 jours consécutifs maximum pour un même client en meublé de tourisme répond à une autre question : la durée du séjour d’une personne. Une réservation compatible avec cette seconde règle peut malgré tout faire dépasser le plafond annuel de la résidence principale.',
          'Pour suivre le total, réunissez les périodes louées sur les différentes plateformes et les réservations directes. Changer de canal de vente ne remet pas le compteur du logement à zéro.',
        ],
        sources: ['frRegistration', 'frHome'],
      },
      {
        title: 'Pouvoir expliquer son décompte',
        paragraphs: [
          'La commune peut demander le nombre de jours loués jusqu’au 31 décembre de l’année suivant celle de la mise en location. Le loueur dispose d’un mois pour transmettre les informations, avec l’adresse du meublé et son numéro de déclaration. Le non-respect des obligations du IV peut être sanctionné par une amende civile allant jusqu’à 15 000 euros.',
          'Conservez un décompte par année, rapproché des réservations effectivement réalisées. Les séjours à cheval sur deux années doivent être suivis sur les périodes correspondantes. Cette discipline rend la réponse à une demande communale plus simple et plus fiable.',
        ],
        sources: ['frRegistration'],
      },
    ],
    checklist: [
      'Retrouver la délibération applicable à la commune du logement.',
      'Suivre les jours loués sur tous les canaux pendant l’année civile.',
      'Conserver les éléments permettant de répondre à une demande de décompte.',
    ],
    faq: [
      {
        q: 'Une réservation directe échappe-t-elle au plafond ?',
        a: 'Non. Le plafond de l’article L324-1-1 IV porte sur la location de la résidence principale, pas sur une plateforme particulière.',
      },
    ],
    guide: {
      en: {
        title: 'Track the main-home annual rental cap',
        copy: 'The standard cap is 120 days per calendar year. A municipality may lower it to 90 days. Track all channels and respond to a municipal request for the day count within one month.',
      },
      ar: {
        title: 'متابعة السقف السنوي لتأجير السكن الرئيسي',
        copy: 'السقف الأساسي 120 يوماً في السنة المدنية، ويمكن للبلدية خفضه إلى 90 يوماً. تجمع الحجوزات من جميع القنوات ويرد على طلب البلدية للكشف خلال شهر.',
      },
    },
  },
  {
    slug: 'france-changement-usage-dpe-meuble-tourisme',
    country: 'FR',
    topic: 'autorisation',
    stage: 'ouvrir',
    title:
      'Changement d’usage et DPE : préparer un meublé de tourisme en France',
    description:
      'Dans les communes concernées, la transformation d’un logement en location touristique requiert une autorisation. En métropole, le DPE demandé pour cette autorisation doit être classé de A à E.',
    scope:
      'Locaux d’habitation soumis à autorisation de changement d’usage pour une mise en location touristique ; exigence DPE de l’article L631-10 limitée à la France métropolitaine.',
    facts: [
      {
        value: 'A à E',
        label: 'DPE pour l’autorisation aujourd’hui',
      },
      {
        value: 'A à D',
        label: 'à compter du 1er janvier 2034',
      },
    ],
    sections: [
      {
        title:
          'L’autorisation de changement d’usage est une démarche distincte',
        paragraphs: [
          'Certaines communes soumettent la mise en location touristique d’un logement à une autorisation préalable de changement d’usage. Les modalités sont locales : elles peuvent notamment prévoir une autorisation temporaire ou une compensation. L’enregistrement du meublé et l’autorisation de changement d’usage répondent à deux exigences différentes.',
          'Avant de commercialiser une résidence secondaire, identifiez le règlement applicable à l’adresse. L’existence d’autres locations dans le même quartier ne prouve pas qu’un nouveau logement bénéficie de la même autorisation ou des mêmes conditions.',
        ],
        sources: ['frSecond'],
      },
      {
        title: 'Le calendrier énergétique propre à cette autorisation',
        paragraphs: [
          'L’article L631-10 du Code de la construction et de l’habitation exige un diagnostic de performance énergétique compris entre A et E pour obtenir l’autorisation préalable en vue de louer en meublé de tourisme. À partir du 1er janvier 2034, le niveau demandé sera compris entre A et D. Cet article s’applique à la France métropolitaine.',
          'Ce calendrier est celui de l’autorisation visée par le texte. Il ne doit pas être remplacé par un calendrier emprunté sans distinction à la location d’habitation de longue durée. Le type de location et la formalité demandée doivent rester explicites.',
        ],
        sources: ['frDpe'],
      },
      {
        title: 'Préparer les pièces et suivre les conditions de la décision',
        paragraphs: [
          'Réunissez le DPE, la description du logement et les pièces demandées par le dispositif communal. Lorsqu’une décision est délivrée, relevez sa durée, son titulaire et ses éventuelles conditions. Une autorisation temporaire demande un suivi de sa date de fin.',
          'Dans Baitly, le dossier de licences et d’autorisations du logement permet d’enregistrer une référence, une autorité émettrice, une échéance et un rappel. Il sert à conserver le suivi de la décision administrative obtenue, sans se substituer à son instruction.',
        ],
        sources: ['frSecond', 'frDpe'],
      },
    ],
    checklist: [
      'Identifier les règles de changement d’usage de la commune.',
      'Faire établir le DPE requis et contrôler la classe énergétique.',
      'Conserver la décision et ses conditions propres au logement.',
    ],
    faq: [
      {
        q: 'Le DPE A à E suffit-il à autoriser la location ?',
        a: 'Non. Il constitue une pièce et une condition énergétique de l’autorisation concernée. Les autres conditions du dispositif communal restent applicables.',
      },
    ],
    guide: {
      en: {
        title: 'Prepare change-of-use permission and the EPC',
        copy: 'Where change-of-use permission is required, mainland France requires an EPC rated A–E for that permission, then A–D from 1 January 2034. Municipal conditions also apply.',
      },
      ar: {
        title: 'إعداد ترخيص تغيير الاستعمال وتشخيص الطاقة',
        copy: 'عند اشتراط ترخيص تغيير الاستعمال في فرنسا المتروبولية، يجب أن يكون تصنيف الطاقة من A إلى E، ثم من A إلى D ابتداءً من فاتح يناير 2034، مع احترام الشروط البلدية.',
      },
    },
  },
  {
    slug: 'france-copropriete-location-touristique',
    country: 'FR',
    topic: 'autorisation',
    stage: 'ouvrir',
    title:
      'Location touristique en copropriété : règlement, syndic et décision collective',
    description:
      'Le règlement de copropriété et l’information du syndic font partie des vérifications préalables. La réforme de 2024 a précisé les mentions et les conditions d’une interdiction collective.',
    scope:
      'Lots situés dans une copropriété française et proposés comme meublés de tourisme.',
    facts: [
      {
        value: 'Règlement',
        label: 'à lire avant de commercialiser',
      },
      {
        value: 'Syndic',
        label: 'à informer de la déclaration',
      },
    ],
    sections: [
      {
        title: 'Lire le règlement correspondant à l’immeuble',
        paragraphs: [
          'La loi du 19 novembre 2024 prévoit que les règlements de copropriété établis à compter de son entrée en vigueur mentionnent explicitement l’autorisation ou l’interdiction de la location de meublés de tourisme. Pour un immeuble plus ancien, la rédaction des clauses existantes conserve son importance.',
          'La destination de l’immeuble et les restrictions du règlement doivent être examinées avant de lancer l’activité. Une autorisation administrative obtenue auprès de la commune ne modifie pas, à elle seule, les règles contractuelles de la copropriété.',
        ],
        sources: ['frReform', 'frHome'],
      },
      {
        title: 'Informer le syndic de la déclaration du logement',
        paragraphs: [
          'L’article 9-2 de la loi du 10 juillet 1965, créé par la réforme, impose au copropriétaire, ou par son intermédiaire au locataire autorisé, d’informer le syndic lorsqu’un lot fait l’objet de la déclaration prévue pour un meublé de tourisme. Un point d’information est ensuite inscrit à l’ordre du jour de la prochaine assemblée générale.',
          'Cette information ne doit pas être confondue avec une autorisation générale accordée par l’assemblée. Elle permet à la copropriété de connaître l’existence de l’activité, tout en laissant applicables le règlement et les décisions valablement prises.',
        ],
        sources: ['frReform'],
      },
      {
        title: 'Comprendre la possibilité d’une interdiction',
        paragraphs: [
          'La réforme ouvre, sous les conditions prévues par l’article 26 d de la loi de 1965, la possibilité de modifier le règlement à la majorité de cet article pour interdire la location touristique de lots d’habitation ne constituant pas une résidence principale. Cette possibilité est notamment subordonnée à l’interdiction de toute activité commerciale dans les lots qui ne sont pas spécifiquement destinés au commerce.',
          'Il ne s’agit donc pas d’une faculté universelle applicable de manière identique à tous les immeubles. Pour votre dossier, conservez le règlement actualisé, les décisions concernant la location touristique et la trace de l’information du syndic.',
        ],
        sources: ['frReform'],
      },
    ],
    checklist: [
      'Lire le règlement de copropriété et ses modifications.',
      'Identifier les clauses concernant les usages commerciaux et touristiques.',
      'Informer le syndic de la déclaration du meublé.',
      'Conserver les décisions d’assemblée pertinentes.',
    ],
    faq: [
      {
        q: 'Une déclaration à la mairie remplace-t-elle l’information du syndic ?',
        a: 'Non. La déclaration administrative et l’information de la copropriété sont deux démarches distinctes.',
      },
    ],
    guide: {
      en: {
        title: 'Check condominium rules and inform the manager',
        copy: 'Read the building rules and relevant resolutions. The owner must inform the condominium manager when the property is declared as a tourist rental. Administrative registration does not override condominium rules.',
      },
      ar: {
        title: 'مراجعة نظام الملكية المشتركة وإبلاغ الوكيل',
        copy: 'تراجع قواعد العقار والقرارات ذات الصلة، ويبلغ المالك وكيل الاتحاد بالتصريح بالشقة السياحية. التسجيل الإداري لا يلغي قواعد الملكية المشتركة.',
      },
    },
  },
  {
    slug: 'france-micro-bic-meuble-tourisme-2026',
    country: 'FR',
    topic: 'fiscalite',
    stage: 'suivre',
    title: 'Micro-BIC des meublés de tourisme : seuils et abattements en 2026',
    description:
      'La version de l’article 50-0 en vigueur au 1er juillet 2026 distingue les meublés touristiques non classés des meublés classés. Le régime s’apprécie aussi au regard des années de référence.',
    scope:
      'Entreprises de location meublée entrant dans le champ du micro-BIC ; règles de l’article 50-0 du CGI en vigueur au 1er juillet 2026.',
    facts: [
      {
        value: '15 000 € / 30 %',
        label: 'non classé : seuil et abattement',
      },
      {
        value: '83 600 € / 50 %',
        label: 'classé : seuil et abattement',
      },
    ],
    sections: [
      {
        title: 'Deux catégories à distinguer',
        paragraphs: [
          'L’article 50-0 du Code général des impôts retient un seuil de 15 000 euros pour l’activité de location de meublés de tourisme non classés et un abattement de 30 %. Pour les meublés de tourisme classés relevant de l’autre catégorie, le seuil de la version en vigueur au 1er juillet 2026 est de 83 600 euros et l’abattement de 50 %.',
          'Ces pourcentages servent à déterminer le résultat imposable selon le régime micro. Ils ne sont ni un taux d’impôt sur le revenu ni une réduction du montant de taxe de séjour. Le classement concerné est le classement officiel du meublé, pas une note laissée par les voyageurs.',
        ],
        sources: ['frMicro'],
      },
      {
        title: 'Examiner les années de référence',
        paragraphs: [
          'Le texte apprécie le chiffre d’affaires de l’année civile précédente ou de la pénultième année et prévoit, le cas échéant, un ajustement au prorata du temps d’exploitation. Il serait donc incorrect d’affirmer qu’un seul dépassement constaté cette année entraîne toujours une sortie immédiate du régime.',
          'Les activités mixtes et les exclusions du micro-BIC demandent également de lire les conditions de l’article. Les seuils présentés ici correspondent à cette version 2026 ; ils ne doivent pas être appliqués sans distinction à une déclaration portant sur une autre année.',
        ],
        sources: ['frMicro'],
      },
      {
        title: 'Préparer les données pour choisir et déclarer',
        paragraphs: [
          'Les contribuables éligibles peuvent opter pour un régime réel dans les conditions et délais de l’article 50-0. Le choix demande d’examiner la situation et les charges ; le seul montant du seuil ne permet pas de recommander un régime à tous les propriétaires.',
          'Conservez un relevé des recettes, les pièces justificatives et la décision de classement lorsqu’elle existe. Le texte prévoit un livre-journal des recettes professionnelles pour les entreprises restées au micro. Ces informations permettent de préparer la déclaration avec le professionnel qui suit le dossier fiscal.',
        ],
        sources: ['frMicro'],
      },
    ],
    checklist: [
      'Identifier le classement officiel et l’année fiscale concernée.',
      'Rapprocher les recettes des années de référence.',
      'Conserver le livre des recettes et ses justificatifs.',
      'Examiner l’éligibilité et les options avec le responsable du dossier fiscal.',
    ],
    faq: [
      {
        q: 'L’abattement de 30 % est-il le taux d’imposition ?',
        a: 'Non. Il réduit le chiffre d’affaires retenu pour calculer le résultat imposable au micro-BIC. L’impôt dépend ensuite de la situation fiscale.',
      },
    ],
    guide: {
      en: {
        title: 'Use the correct micro-BIC category and tax year',
        copy: 'The July 2026 tax code sets €15,000 / 30% for unclassified tourist rentals and €83,600 / 50% for classified rentals. Eligibility also depends on the reference years and other statutory conditions.',
      },
      ar: {
        title: 'اختيار فئة micro-BIC والسنة الضريبية الصحيحة',
        copy: 'يحدد نص يوليو 2026 سقف 15,000 يورو وخصماً 30٪ لغير المصنف، و83,600 يورو و50٪ للمصنف. وتبقى شروط سنوات المرجع والأهلية واجبة التطبيق.',
      },
    },
  },
  {
    slug: 'france-lmnp-lmp-criteres',
    country: 'FR',
    topic: 'fiscalite',
    stage: 'suivre',
    title: 'LMNP ou LMP : les deux critères fiscaux à distinguer',
    description:
      'Dépasser 23 000 euros de recettes ne suffit pas, à lui seul, à devenir loueur en meublé professionnel au sens fiscal. L’article 155 IV impose une seconde comparaison.',
    scope:
      'Qualification fiscale de l’activité de location meublée à l’impôt sur le revenu, selon l’article 155 IV du CGI.',
    facts: [
      {
        value: 'Plus de 23 000 €',
        label: 'recettes annuelles du foyer',
      },
      {
        value: '2 conditions',
        label: 'à réunir simultanément',
      },
    ],
    sections: [
      {
        title: 'Une première condition portant sur les recettes du foyer',
        paragraphs: [
          'Le caractère professionnel de la location meublée suppose que les recettes annuelles de cette activité, retirées par l’ensemble des membres du foyer fiscal, excèdent 23 000 euros. Il ne s’agit pas d’un seuil à examiner séparément pour chaque logement ou chaque plateforme.',
          'Cette comparaison porte sur les recettes définies par le texte. Elle ne se résume pas au solde net viré sur un compte après les frais d’un intermédiaire. Rassemblez les données de l’ensemble de l’activité avant d’en tirer une qualification.',
        ],
        sources: ['frLmp'],
      },
      {
        title: 'Une seconde condition de comparaison avec les autres revenus',
        paragraphs: [
          'Les recettes de location meublée doivent également excéder les autres revenus du foyer visés par l’article 155 IV : traitements et salaires, autres bénéfices industriels et commerciaux, bénéfices agricoles, bénéfices non commerciaux et revenus des gérants et associés mentionnés à l’article 62. Les deux conditions sont cumulatives.',
          'Par exemple, dépasser 23 000 euros sans dépasser les autres revenus concernés du foyer ne suffit pas à satisfaire ces deux critères. Pour les non-résidents fiscaux, la version du texte en vigueur depuis le 21 février 2026 prévoit une comparaison avec les revenus de même nature imposés dans l’État de résidence.',
        ],
        sources: ['frLmp'],
      },
      {
        title:
          'Séparer statut fiscal, régime d’imposition et obligations sociales',
        paragraphs: [
          'Le statut professionnel ou non professionnel et le choix entre micro-BIC et régime réel sont des questions différentes. Le classement touristique du logement ne décide pas non plus, à lui seul, du caractère professionnel de l’activité.',
          'L’article prévoit des règles particulières pour l’année de début et celle de cessation totale de l’activité, avec une annualisation des recettes dans les cas concernés. Préparez les dates et les recettes pour le professionnel chargé du dossier. Ce dossier traite de la qualification fiscale ; il ne déduit pas automatiquement un régime social de ces deux seuls critères.',
        ],
        sources: ['frLmp'],
      },
    ],
    checklist: [
      'Totaliser les recettes de location meublée de tout le foyer.',
      'Réunir les autres revenus visés par l’article 155 IV.',
      'Préciser la résidence fiscale et les dates de début ou de fin d’activité.',
      'Distinguer qualification LMNP/LMP et choix micro/réel.',
    ],
    faq: [
      {
        q: 'Le seuil de 23 000 euros est-il un seuil par logement ?',
        a: 'Non. L’article 155 IV vise les recettes de location meublée de l’ensemble des membres du foyer fiscal.',
      },
    ],
    guide: {
      en: {
        title: 'Distinguish LMNP and LMP tax status',
        copy: 'Professional status requires both annual household furnished-rental receipts above €23,000 and receipts exceeding the other income categories listed in article 155 IV. One threshold alone is insufficient.',
      },
      ar: {
        title: 'التمييز الضريبي بين LMNP وLMP',
        copy: 'تتطلب الصفة المهنية اجتماع شرطين: تجاوز إيرادات التأجير المفروش للأسرة 23,000 يورو، وتجاوزها فئات الدخل الأخرى المحددة بالمادة 155 IV. شرط واحد لا يكفي.',
      },
    },
  },
  {
    slug: 'france-taxe-sejour-collecte-exonerations',
    country: 'FR',
    topic: 'fiscalite',
    stage: 'accueillir',
    title: 'Taxe de séjour en France : tarif local, exonérations et collecte',
    description:
      'Au réel ou au forfait, la taxe de séjour suit une décision locale. Pour la taxe au réel, identifiez les voyageurs exonérés, distinguez la taxe du prix et rapprochez la collecte de chaque canal.',
    scope:
      'Hébergements touristiques situés dans une commune ou un EPCI ayant institué une taxe de séjour.',
    facts: [
      {
        value: 'Tarif local',
        label: 'selon la nature et le classement',
      },
      {
        value: 'Moins de 18 ans',
        label: 'exonération de la taxe au réel',
      },
    ],
    sections: [
      {
        title: 'Partir de la délibération de la collectivité',
        paragraphs: [
          'La commune ou l’EPCI décide de la taxe de séjour, de sa période de perception et des tarifs applicables selon la nature et le classement de l’hébergement. Le régime peut être au réel ou au forfait. Ces deux modes ne se calculent pas de la même façon : le réel dépend des nuitées et personnes concernées, tandis que le forfait repose notamment sur la capacité d’accueil.',
          'Utilisez le tarif de la commune et les taxes additionnelles applicables à l’année et au logement. Un montant affiché pour une autre ville ou pour une catégorie différente ne constitue pas une référence suffisante.',
        ],
        sources: ['frTax'],
      },
      {
        title: 'Reconnaître les exonérations du réel',
        paragraphs: [
          'Sont notamment exonérés de taxe au réel les mineurs, les travailleurs saisonniers employés dans la commune, les bénéficiaires d’un hébergement d’urgence ou d’un relogement temporaire et les personnes occupant des locaux dont le loyer est inférieur au seuil fixé par la collectivité. Ces exonérations doivent être prises en compte dans le décompte.',
          'La taxe au réel doit être distinguée du prix sur la facture remise au client et perçue avant son départ. Ne transposez pas sans distinction ces règles de présentation et d’exonération au régime forfaitaire.',
        ],
        sources: ['frTax'],
      },
      {
        title: 'Rapprocher collecte et reversement',
        paragraphs: [
          'Les dates de reversement de la taxe au réel sont fixées par la collectivité. Le calendrier local doit donc figurer dans votre procédure. Pour chaque réservation, identifiez le collecteur et les sommes déjà perçues par l’intermédiaire, afin de ne pas réclamer une seconde fois la même taxe au voyageur.',
          'Conservez un relevé des séjours, du nombre de personnes taxables, des exonérations et des montants reversés. Baitly propose une configuration de taxe de séjour et des rapports exportables : la qualité du résultat dépend du tarif et des données renseignés pour le logement.',
        ],
        sources: ['frTax', 'frHome'],
      },
    ],
    checklist: [
      'Identifier le régime au réel ou au forfait et le tarif local de l’année.',
      'Renseigner les personnes taxables et les exonérations du réel.',
      'Vérifier qui collecte pour chaque réservation.',
      'Respecter le calendrier de reversement de la collectivité.',
    ],
    faq: [
      {
        q: 'Existe-t-il un tarif national unique pour tous les meublés ?',
        a: 'Non. La collectivité fixe les tarifs dans le cadre légal, selon la nature et le classement de l’hébergement, avec les éventuelles taxes additionnelles.',
      },
    ],
    guide: {
      en: {
        title: 'Apply local tourist-tax rules',
        copy: 'Use the municipality’s regime, rate and payment calendar. Under the actual-night regime, minors and other statutory categories are exempt. Reconcile amounts collected by each booking channel.',
      },
      ar: {
        title: 'تطبيق قواعد رسم الإقامة المحلي',
        copy: 'يعتمد النظام والسعر ومواعيد الأداء المحلية. في نظام الرسم على الليالي الفعلية، يعفى القاصرون والفئات المحددة قانوناً. وتطابق المبالغ المحصلة عبر كل قناة حجز.',
      },
    },
  },
  {
    slug: 'france-fiche-police-voyageurs-etrangers',
    country: 'FR',
    topic: 'voyageurs',
    stage: 'accueillir',
    title:
      'Fiche de police en France : quels voyageurs et quelle conservation ?',
    description:
      'Les voyageurs de nationalité étrangère, y compris ceux de l’Union européenne, remplissent et signent une fiche à l’arrivée. Elle se conserve six mois et se transmet sur demande des autorités.',
    scope:
      'Hébergements touristiques loués, à titre professionnel ou non, à des clients de nationalité autre que française.',
    facts: [
      {
        value: 'À l’arrivée',
        label: 'fiche remplie et signée',
      },
      {
        value: '6 mois',
        label: 'conservation',
      },
      {
        value: 'Sur demande',
        label: 'transmission aux autorités',
      },
    ],
    sections: [
      {
        title: 'Tous les voyageurs étrangers sont concernés',
        paragraphs: [
          'L’obligation concerne les hébergeurs professionnels et non professionnels accueillant un client de nationalité étrangère. Les ressortissants d’un autre pays de l’Union européenne sont également concernés. Les meublés de tourisme, gîtes, chambres d’hôtes et hôtels font partie des hébergements visés.',
          'Le client remplit et signe la fiche dès son arrivée. Pour les enfants de moins de quinze ans, les renseignements peuvent figurer sur la fiche d’un adulte qui les accompagne. La réservation effectuée par un seul membre du groupe ne remplace pas cette formalité pour les personnes concernées.',
        ],
        sources: ['frPolice'],
      },
      {
        title: 'Recueillir les renseignements du modèle officiel',
        paragraphs: [
          'La fiche comporte le nom et les prénoms, la date et le lieu de naissance, la nationalité, le domicile habituel, le téléphone mobile, l’adresse électronique ainsi que la date d’arrivée et la date de départ prévue. Le modèle officiel est accessible depuis Service Public.',
          'Une préparation avant l’arrivée peut simplifier la saisie, à condition de garder l’étape de vérification et de signature prévue à l’accueil. Le voyageur doit être informé de son droit d’accès et de rectification des informations qui le concernent.',
        ],
        sources: ['frPolice'],
      },
      {
        title: 'Conserver sans transmettre systématiquement',
        paragraphs: [
          'La fiche doit être conservée pendant six mois. Sa transmission à la police ou à la gendarmerie intervient seulement à leur demande ; il ne s’agit pas d’un envoi automatique de chaque fiche après chaque arrivée.',
          'Prévoyez un classement qui permette de retrouver une fiche pendant la durée de conservation et limitez l’accès aux informations. Le dossier de police ne doit pas devenir un document partagé avec tous les intervenants du logement. Service Public précise que les renseignements ne doivent pas être transmis à d’autres destinataires que les services concernés.',
        ],
        sources: ['frPolice'],
      },
    ],
    checklist: [
      'Identifier les voyageurs étrangers, y compris ressortissants de l’Union européenne.',
      'Faire remplir et signer la fiche à l’arrivée.',
      'Conserver les fiches six mois avec des accès limités.',
      'Transmettre seulement sur demande des services de police ou de gendarmerie.',
    ],
    faq: [
      {
        q: 'Faut-il envoyer chaque fiche à la police après l’arrivée ?',
        a: 'Non. La transmission n’est pas systématique ; elle intervient lorsque les services de police ou de gendarmerie la demandent.',
      },
    ],
    guide: {
      en: {
        title: 'Collect police forms for foreign guests',
        copy: 'Foreign guests, including EU nationals, complete and sign a police form on arrival. Retain it for six months and send it to the police or gendarmerie only on request.',
      },
      ar: {
        title: 'جمع استمارة الشرطة للضيوف الأجانب',
        copy: 'يملأ الضيوف الأجانب، بمن فيهم مواطنو الاتحاد الأوروبي، الاستمارة ويوقعونها عند الوصول. تحفظ ستة أشهر وترسل إلى الشرطة أو الدرك عند الطلب فقط.',
      },
    },
  },
  {
    slug: 'france-classement-meuble-tourisme-etoiles',
    country: 'FR',
    topic: 'autorisation',
    stage: 'ouvrir',
    title: 'Classer un meublé de tourisme en France : démarche et durée',
    description:
      'Le classement officiel de une à cinq étoiles est volontaire et valable cinq ans. Il repose sur une visite par un organisme habilité et se distingue des avis voyageurs.',
    scope:
      'Propriétaires de meublés de tourisme souhaitant obtenir un classement officiel en étoiles.',
    facts: [
      {
        value: '1 à 5 étoiles',
        label: 'catégories de classement',
      },
      {
        value: '5 ans',
        label: 'validité de la décision',
      },
      {
        value: '15 jours',
        label: 'pour refuser la proposition reçue',
      },
    ],
    sections: [
      {
        title: 'Une démarche volontaire de qualité',
        paragraphs: [
          'Le classement officiel d’un meublé de tourisme est facultatif et payant. Il permet de situer le confort et les équipements du logement dans une catégorie de une à cinq étoiles. Il ne s’agit ni d’une note de satisfaction sur une plateforme ni d’un simple qualificatif choisi par l’hôte.',
          'Le classement n’annule pas les autres démarches : l’enregistrement du logement, les règles de copropriété et les éventuelles autorisations d’usage conservent leur propre objet. Une bonne note voyageurs ne vaut pas davantage décision administrative de classement.',
        ],
        sources: ['frHome'],
      },
      {
        title: 'De la visite à la décision',
        paragraphs: [
          'Le propriétaire sollicite un organisme évaluateur accrédité ou agréé. Après la visite, l’organisme remet dans un délai d’un mois un certificat de visite comprenant le rapport de contrôle, la grille de contrôle et une proposition de décision de classement.',
          'Le propriétaire dispose de quinze jours à compter de la réception du certificat pour refuser la proposition. En l’absence de refus dans ce délai, le classement est acquis. La décision est valable cinq ans et doit être affichée de manière visible dans le meublé.',
        ],
        sources: ['frHome'],
      },
      {
        title: 'Faire circuler la bonne information',
        paragraphs: [
          'Conservez la décision, sa catégorie et sa période de validité dans le dossier du logement. Les informations utilisées dans les annonces et dans la configuration de la taxe de séjour doivent correspondre au classement effectivement obtenu et en cours.',
          'La distinction classé ou non classé intervient aussi dans le cadre fiscal du micro-BIC. Elle doit être appréciée avec l’année et les conditions du régime concerné. Le dossier fiscal et le dossier de classement doivent donc utiliser la même référence, sans déduire un avantage automatique pour toutes les situations.',
        ],
        sources: ['frHome', 'frMicro'],
      },
    ],
    checklist: [
      'Choisir un organisme évaluateur accrédité ou agréé.',
      'Conserver le rapport, la grille et la décision.',
      'Afficher le classement dans le logement.',
      'Suivre l’échéance de cinq ans et actualiser les données diffusées.',
    ],
    faq: [
      {
        q: 'Une note de cinq étoiles sur une plateforme vaut-elle classement officiel ?',
        a: 'Non. Le classement officiel résulte de la procédure auprès d’un organisme évaluateur habilité. Les notes des voyageurs sont un autre indicateur.',
      },
    ],
    guide: {
      en: {
        title: 'Keep official star classification up to date',
        copy: 'Official classification is optional, ranges from one to five stars and lasts five years. It requires an accredited or approved assessor’s visit and is distinct from guest reviews.',
      },
      ar: {
        title: 'متابعة التصنيف الرسمي بالنجوم',
        copy: 'التصنيف الرسمي اختياري ويتراوح من نجمة إلى خمس نجوم ويصلح لخمس سنوات. يتطلب زيارة جهة تقييم معتمدة وهو منفصل عن تقييمات الضيوف.',
      },
    },
  },
] satisfies LegalArticle[];
