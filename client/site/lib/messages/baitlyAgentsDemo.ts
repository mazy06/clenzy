import { demoDateLabel, localizeDemoCopy } from '../planningDemoLocale';
import type { SiteLanguage } from '../siteLanguage';

/**
 * Démo guidée « planning → constellation d'agents » de la page d'accueil.
 *
 * <p>Les cartes reprennent des suggestions réelles de l'environnement de
 * développement (avis de Laura D. et brouillon de l'agent Réputation, batterie
 * de serrure à 12 %, fiche de police à télédéclarer), avec les libellés exacts
 * du PMS (`public/locales/*.json`). Le logement ouvert est celui de la maquette
 * de planning (index {@link AGENTS_DEMO_PROPERTY_INDEX}).</p>
 *
 * <p>`voice` est le texte lu par la voix off : plus riche que la bulle, il est
 * enregistré en MP3 (`assets/voice/agents-demo/<langue>/NN.mp3`). Modifier une
 * phrase impose de régénérer son fichier et de recaler `STEP_MS`.</p>
 */
export const AGENTS_DEMO_PROPERTY_INDEX = 3;

interface GuideStep {
  title: string;
  body: string;
  voice: string;
}

const fr = {
  demo: 'Démo des agents',
  pause: 'Pause',
  play: 'Reprendre',
  voiceOn: 'Activer la voix off',
  voiceOff: 'Couper la voix off',
  voiceLabel: 'Voix off',
  stepLabel: 'Étape',
  agentAsk: 'Demandez quelque chose aux agents…',
  pageRange: '1–1 sur 6',
  board: {
    title: 'Constellation d’agents',
    toValidate: 'à valider',
    agents: 'agents',
    acting: 'en action',
    active: 'En ligne',
    cardsLabel: 'Agents',
    orbitLabel: 'Constellation',
    report: 'Bilan',
    scan: 'Scanner',
    cardsView: 'Vue agents',
    orbitView: 'Vue constellation',
    activity: 'Activité',
    alwaysValidated: 'Validation requise',
    expiresIn: 'expire dans',
    why: 'Pourquoi ?',
    dismiss: 'Ignorer',
    validated: 'Validée',
  },
  autonomy: { suggest: 'Suggérer', notify: 'Agir puis notifier', full: 'Auto' },
  status: { veille: 'En veille', act: 'Agit' },
  agents: {
    com: ['Communication', 'Messages voyageurs'],
    rev: ['Revenue', 'Tarification dynamique'],
    ops: ['Opérations', 'Ménage & interventions'],
    fin: ['Finance', 'Paiements & relevés'],
    rep: ['Avis & Réputation', 'Avis & note'],
    sync: ['Synchronisation', 'Canaux et calendriers'],
    cmp: ['Conformité', 'Conformité et sécurité'],
    gst: ['Voyageur', 'Expérience voyageur'],
    own: ['Propriétaire', 'Relation propriétaire'],
    gro: ['Croissance', 'Distribution et croissance'],
  },
  growthTask: 'Publie l’annonce sur Booking.com',
  cards: {
    review: {
      title: 'Avis sans réponse — avis #3',
      meta: 'Laura D. · 30 mai 2026 · Airbnb',
      quote: 'Très bon emplacement et logement agréable. Petit bémol sur le bruit le soir.',
      note: 'Rédiger une réponse publique : un avis positif sans réponse est une occasion manquée.',
      cta: 'Répondre',
    },
    review3: {
      title: 'Avis sans réponse — avis #1',
      meta: 'Sophie M. · 20 juin 2026 · Airbnb',
      quote: 'Séjour exceptionnel, logement très propre et parfaitement conforme aux photos.',
    },
    mandate: {
      title: 'Mandat de gestion à envoyer en signature (#7)',
      motif:
        'Le mandat est prêt mais aucune demande de signature n’est partie. « Envoyer pour signature » génère le document si besoin et adresse le lien de signature électronique au propriétaire.',
      cta: 'Envoyer pour signature',
    },
    review2: {
      title: 'Avis sans réponse — avis #6',
      meta: 'Marc V. · 22 avr. 2026 · Booking.com',
      quote: 'Excellent rapport qualité-prix, bien équipé. Nous reviendrons avec plaisir.',
    },
    lock: {
      title: 'Batterie serrure à 12 % — Serrure porte d’entrée',
      meter: 'Batterie de la serrure',
      motif:
        'La serrure connectée risque la panne — un voyageur bloqué à l’arrivée est le pire scénario. « Planifier » crée l’intervention de remplacement des piles (priorité haute, dès demain).',
      cta: 'Planifier',
    },
    maintenance: {
      title: 'Entretien préventif à planifier',
      motif:
        'Aucune maintenance terminée n’est enregistrée pour ce logement. « Planifier » crée la tournée d’entretien préventif (climatisation, plomberie, équipements) avant qu’une panne ne tombe en plein séjour.',
    },
    police: {
      title: 'Fiche police à télédéclarer (réservation #218)',
      motif:
        'Fiche(s) voyageur complétée(s) mais pas encore déposée(s) auprès de l’autorité. « Télédéclarer » soumet toutes les fiches complétées du séjour via le canal configuré.',
      cta: 'Télédéclarer',
    },
  },
  reply: {
    title: 'Répondre à cet avis',
    guest: 'Laura D.',
    proposalTitle: 'Réponse proposée',
    awaiting: 'En attente',
    proposalLead: 'Rédigée par l’agent, jamais publiée sans vous. Message proposé :',
    insert: 'Insérer dans ma réponse',
    dismiss: 'Ignorer',
    orWrite: 'ou écrivez la vôtre ci-dessous',
    yourReply: 'Votre réponse',
    consequences: 'Ce qui va se passer',
    facts: [
      'La réponse est publiée sous l’avis, visible de tous.',
      'Le brouillon proposé est modifiable : rien ne part sans votre relecture.',
    ],
    cancel: 'Annuler',
    publish: 'Publier la réponse',
    /* Brouillon réel de l'agent Réputation (avis #3). L'ajustement remplace
       la promesse vague (`vague`) par le geste concret (`precise`). */
    draftStart:
      'Merci beaucoup Laura pour votre retour et pour la belle note. Nous sommes ravis que l’emplacement et le logement vous aient plu. Nous prenons aussi bonne note de votre remarque sur le bruit le soir, et ',
    vague: 'nous allons réfléchir à des solutions pour améliorer le confort de nos voyageurs.',
    precise: 'nous avons depuis fait poser un double vitrage côté rue.',
    draftEnd: ' Au plaisir de vous accueillir à nouveau !',
  },
  schedule: {
    title: 'Planifier l’intervention',
    month: 'septembre 2026',
    weekdays: ['lu', 'ma', 'me', 'je', 've', 'sa', 'di'],
    time: 'Heure',
    assignee: 'Intervenant',
    search: 'Rechercher un intervenant…',
    matching: 'Métier correspondant',
    others: 'Autres intervenants',
    orgTeam: 'Conciergerie',
    myself: 'Moi-même',
    workers: [
      ['Youssef Amrani', 'Technicien'],
      ['Karim Belkadi', 'Tech. extérieur'],
    ],
    otherWorkers: [['Salma Idrissi', 'Agent de ménage']],
    readbackBefore: 'dimanche 27 septembre à 10:00',
    readbackDay: 'lundi 28 septembre à 10:00',
    readback: 'lundi 28 septembre à 10:00, Youssef Amrani',
    cancel: 'Annuler',
    confirm: 'Planifier',
  },
  police: {
    title: 'Télédéclarer les fiches',
    facts: [
      'Les fiches complétées partent vers le portail officiel.',
      'Les fiches incomplètes ne partent pas et restent à compléter.',
    ],
    cancel: 'Annuler',
  },
  steps: [
    {
      title: 'Tout le portefeuille, une grille',
      body: 'Chaque logement, chaque séjour et chaque canal sur le même planning.',
      voice:
        'Voici le planning Bètly : tous vos logements, tous vos séjours et tous vos canaux, réunis sur une seule grille.',
    },
    {
      title: 'Déplier un logement',
      body: 'Le chevron ouvre la constellation d’agents d’Appart. Guéliz, juste sous sa ligne.',
      voice:
        'Un clic sur le chevron d’Appart Guéliz : le planning se resserre sur ce logement et fait place à sa constellation d’agents.',
    },
    {
      title: 'Dix agents sur le pont',
      body: 'Chaque pastille compte les décisions qui vous attendent : 27 pour ce logement.',
      voice:
        'Dix agents veillent en permanence sur le logement. Chaque pastille compte les décisions qui vous attendent : vingt-sept, ici.',
    },
    {
      title: 'Un avis à traiter',
      body: 'Laura a laissé 4 étoiles et une remarque sur le bruit. L’agent a déjà préparé une réponse.',
      voice:
        'L’agent Avis et Réputation, le plus chargé, est ouvert. Laura a laissé quatre étoiles, avec un bémol sur le bruit du soir. L’agent lui a déjà préparé une réponse.',
    },
    {
      title: 'Une réponse rédigée par l’IA',
      body: '« Répondre » ouvre la proposition de l’agent. On l’insère : rien n’est encore publié.',
      voice:
        'Je clique sur Répondre. La réponse rédigée par l’intelligence artificielle s’affiche à part. Je l’insère dans ma réponse : rien n’est encore publié.',
    },
    {
      title: 'Vous l’ajustez, puis publiez',
      body: 'La promesse vague devient un geste concret : le double vitrage posé côté rue.',
      voice:
        'Et je l’ajuste ! Plutôt qu’une promesse vague, je précise que le double vitrage a été posé côté rue. Je publie : la carte quitte la file.',
    },
    {
      title: 'Une serrure à 12 %',
      body: 'L’agent Opérations repère la batterie faible avant qu’un voyageur reste bloqué dehors.',
      voice:
        'Passons aux Opérations. L’anneau pivote et amène l’agent face à sa file : la serrure connectée n’a plus que douze pour cent de batterie. Un voyageur bloqué devant la porte, c’est le pire scénario.',
    },
    {
      title: 'Planifier l’intervention',
      body: 'Date, heure, intervenant : la mission est créée et proposée au technicien.',
      voice:
        'Planifier ouvre le choix de la date, de l’heure et de l’intervenant. Lundi, dix heures, Youssef. La mission est créée, la carte se range.',
    },
    {
      title: 'La vue Agents',
      body: 'Les dix agents en liste : ceux qui attendent une décision remontent en tête.',
      voice:
        'Changeons de vue. La vue Agents liste les dix agents : ceux qui attendent une décision remontent en tête, avec leur niveau d’autonomie.',
    },
    {
      title: 'Télédéclarer la fiche de police',
      body: 'Les fiches sont complètes. Avant l’envoi, Baitly dit exactement ce qui va partir.',
      voice:
        'J’ouvre la Conformité : les fiches voyageurs du séjour sont complètes. Avant d’envoyer, Bètly m’explique ce qui va partir. Je confirme.',
    },
    {
      title: 'Régler l’autonomie',
      body: 'Revenue peut agir puis vous notifier. Les actions sensibles restent soumises à validation.',
      voice:
        'Enfin, je laisse l’agent Revenue agir, puis me notifier. Les actions sensibles, elles, attendent toujours votre feu vert. Vous restez aux commandes.',
    },
  ] as GuideStep[],
};

export type AgentsDemoMessages = typeof fr;

const en: AgentsDemoMessages = {
  demo: 'Agents demo',
  pause: 'Pause',
  play: 'Resume',
  voiceOn: 'Turn the voice-over on',
  voiceOff: 'Mute the voice-over',
  voiceLabel: 'Voice-over',
  stepLabel: 'Step',
  agentAsk: 'Ask the agents anything…',
  pageRange: '1–1 of 6',
  board: {
    title: 'Agent constellation',
    toValidate: 'to approve',
    agents: 'agents',
    acting: 'acting',
    active: 'Online',
    cardsLabel: 'Agents',
    orbitLabel: 'Constellation',
    report: 'Report',
    scan: 'Scan',
    cardsView: 'Agent view',
    orbitView: 'Constellation view',
    activity: 'Activity',
    alwaysValidated: 'Approval required',
    expiresIn: 'expires in',
    why: 'Why?',
    dismiss: 'Dismiss',
    validated: 'Approved',
  },
  autonomy: { suggest: 'Suggest', notify: 'Act then notify', full: 'Auto' },
  status: { veille: 'Idle', act: 'Acting' },
  agents: {
    com: ['Communication', 'Guest messages'],
    rev: ['Revenue', 'Dynamic pricing'],
    ops: ['Operations', 'Cleaning & interventions'],
    fin: ['Finance', 'Payments & statements'],
    rep: ['Reviews & Reputation', 'Reviews & rating'],
    sync: ['Sync', 'Channels and calendars'],
    cmp: ['Compliance', 'Compliance and security'],
    gst: ['Guest', 'Guest experience'],
    own: ['Owner', 'Owner relations'],
    gro: ['Growth', 'Distribution and growth'],
  },
  growthTask: 'Publishing the listing on Booking.com',
  cards: {
    review: {
      title: 'Unanswered review — review #3',
      meta: 'Laura D. · 30 May 2026 · Airbnb',
      quote: 'Great location and a lovely place. One small downside: the noise in the evening.',
      note: 'Write a public reply: a positive review left unanswered is a missed opportunity.',
      cta: 'Reply',
    },
    review3: {
      title: 'Unanswered review — review #1',
      meta: 'Sophie M. · 20 June 2026 · Airbnb',
      quote: 'An exceptional stay, a spotless place that looks exactly like the photos.',
    },
    mandate: {
      title: 'Management agreement to send for signature (#7)',
      motif:
        'The agreement is ready but no signature request has gone out. “Send for signature” generates the document if needed and sends the e-signature link to the owner.',
      cta: 'Send for signature',
    },
    review2: {
      title: 'Unanswered review — review #6',
      meta: 'Marc V. · 22 Apr 2026 · Booking.com',
      quote: 'Excellent value for money, well equipped. We will gladly come back.',
    },
    lock: {
      title: 'Lock battery at 12% — Front door lock',
      meter: 'Lock battery',
      motif:
        'The smart lock may fail — a guest locked out on arrival is the worst case. “Schedule” creates the battery replacement job (high priority, from tomorrow).',
      cta: 'Schedule',
    },
    maintenance: {
      title: 'Preventive maintenance to schedule',
      motif:
        'No completed maintenance is recorded for this property. “Schedule” creates the preventive round (air conditioning, plumbing, equipment) before a breakdown hits mid-stay.',
    },
    police: {
      title: 'Police record to file (booking #218)',
      motif:
        'Guest record(s) completed but not yet filed with the authority. “File online” submits every completed record of the stay through the configured channel.',
      cta: 'File online',
    },
  },
  reply: {
    title: 'Reply to this review',
    guest: 'Laura D.',
    proposalTitle: 'Suggested reply',
    awaiting: 'Awaiting you',
    proposalLead: 'Drafted by the agent, never published without you. Suggested message:',
    insert: 'Insert into my reply',
    dismiss: 'Dismiss',
    orWrite: 'or write your own below',
    yourReply: 'Your reply',
    consequences: 'What will happen',
    facts: [
      'The reply is published under the review, visible to everyone.',
      'The suggested draft is editable: nothing goes out without your review.',
    ],
    cancel: 'Cancel',
    publish: 'Publish the reply',
    draftStart:
      'Thank you so much Laura for your feedback and the lovely rating. We are delighted you enjoyed the location and the apartment. We have also taken note of your comment about the evening noise, and ',
    vague: 'we will look into ways to make our guests even more comfortable.',
    precise: 'we have since had double glazing fitted on the street side.',
    draftEnd: ' We look forward to welcoming you again!',
  },
  schedule: {
    title: 'Schedule the job',
    month: 'September 2026',
    weekdays: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'],
    time: 'Time',
    assignee: 'Assignee',
    search: 'Search for a worker…',
    matching: 'Matching trade',
    others: 'Other workers',
    orgTeam: 'Property manager',
    myself: 'Myself',
    workers: [
      ['Youssef Amrani', 'Technician'],
      ['Karim Belkadi', 'Exterior tech'],
    ],
    otherWorkers: [['Salma Idrissi', 'Housekeeper']],
    readbackBefore: 'Sunday 27 September at 10:00',
    readbackDay: 'Monday 28 September at 10:00',
    readback: 'Monday 28 September at 10:00, Youssef Amrani',
    cancel: 'Cancel',
    confirm: 'Schedule',
  },
  police: {
    title: 'File the records online',
    facts: [
      'The completed records are sent to the official portal.',
      'Incomplete records are not sent and still need completing.',
    ],
    cancel: 'Cancel',
  },
  steps: [
    {
      title: 'Your whole portfolio, one grid',
      body: 'Every property, every stay and every channel on the same calendar.',
      voice:
        'This is the Baitly calendar: all your properties, all your stays and all your channels, brought together on a single grid.',
    },
    {
      title: 'Expand a property',
      body: 'The chevron opens the agent constellation of Appart. Guéliz, right below its row.',
      voice:
        'One click on the Guéliz apartment chevron: the calendar narrows down to this property and makes room for its agent constellation.',
    },
    {
      title: 'Ten agents on deck',
      body: 'Each badge counts the decisions waiting for you: 27 for this property.',
      voice:
        'Ten agents watch over the property around the clock. Each badge counts the decisions waiting for you: twenty-seven, right here.',
    },
    {
      title: 'A review to handle',
      body: 'Laura left 4 stars and a comment about noise. The agent has already drafted a reply.',
      voice:
        'The Reviews and Reputation agent, the busiest one, is open. Laura left four stars, with one downside: the evening noise. The agent has already drafted a reply.',
    },
    {
      title: 'A reply drafted by AI',
      body: '“Reply” opens the agent’s suggestion. We insert it: nothing is published yet.',
      voice:
        'I click Reply. The AI-drafted answer is shown on its own. I insert it into my reply: nothing is published yet.',
    },
    {
      title: 'You adjust it, then publish',
      body: 'The vague promise becomes a concrete fix: double glazing on the street side.',
      voice:
        'And I adjust it! Instead of a vague promise, I say the double glazing has been fitted on the street side. I publish, and the card leaves the queue.',
    },
    {
      title: 'A lock at 12%',
      body: 'The Operations agent spots the low battery before a guest gets locked out.',
      voice:
        'Over to Operations. The ring turns to bring the agent in front of its queue: the smart lock is down to twelve percent battery. A guest stuck at the door is the worst case.',
    },
    {
      title: 'Schedule the job',
      body: 'Date, time, assignee: the job is created and offered to the technician.',
      voice:
        'Schedule lets me pick the date, the time and the assignee. Monday, ten o’clock, Youssef. The job is created, and the card is cleared.',
    },
    {
      title: 'The agent view',
      body: 'All ten agents in a list: the ones waiting for a decision come first.',
      voice:
        'Let’s switch views. The agent view lists all ten agents: the ones waiting for a decision come first, each with its level of autonomy.',
    },
    {
      title: 'File the police record',
      body: 'The records are complete. Before sending, Baitly tells you exactly what goes out.',
      voice:
        'I open Compliance: the guest records for the stay are complete. Before sending, Baitly explains what will go out. I confirm.',
    },
    {
      title: 'Set the autonomy',
      body: 'Revenue can act, then notify you. Sensitive actions still need your approval.',
      voice:
        'Finally, I let the Revenue agent act, then notify me. Sensitive actions still wait for your green light. You stay at the controls.',
    },
  ],
};

/* Arabe : bulles et interface traduites, sans voix off (la relecture des
   traductions arabes précède toute génération de voix). */
const ar: AgentsDemoMessages = {
  demo: 'عرض الوكلاء',
  pause: 'إيقاف مؤقت',
  play: 'استئناف',
  voiceOn: 'تشغيل التعليق الصوتي',
  voiceOff: 'كتم التعليق الصوتي',
  voiceLabel: 'التعليق الصوتي',
  stepLabel: 'الخطوة',
  agentAsk: 'اطرح سؤالًا على الوكلاء…',
  pageRange: '1–1 من 6',
  board: {
    title: 'كوكبة الوكلاء',
    toValidate: 'بانتظار الموافقة',
    agents: 'وكلاء',
    acting: 'ينفّذون',
    active: 'متصل',
    cardsLabel: 'الوكلاء',
    orbitLabel: 'الكوكبة',
    report: 'التقرير',
    scan: 'فحص',
    cardsView: 'عرض الوكلاء',
    orbitView: 'عرض الكوكبة',
    activity: 'النشاط',
    alwaysValidated: 'الموافقة مطلوبة',
    expiresIn: 'تنتهي خلال',
    why: 'لماذا؟',
    dismiss: 'تجاهل',
    validated: 'تمت الموافقة',
  },
  autonomy: { suggest: 'اقتراح', notify: 'التنفيذ ثم الإشعار', full: 'تلقائي' },
  status: { veille: 'في وضع الانتظار', act: 'ينفّذ' },
  agents: {
    com: ['التواصل', 'رسائل الضيوف'],
    rev: ['الإيرادات', 'التسعير الديناميكي'],
    ops: ['العمليات', 'التنظيف والتدخلات'],
    fin: ['المالية', 'المدفوعات والكشوف'],
    rep: ['التقييمات والسمعة', 'التقييمات والتقدير'],
    sync: ['المزامنة', 'القنوات والتقويمات'],
    cmp: ['الامتثال', 'الامتثال والأمان'],
    gst: ['الضيف', 'تجربة الضيف'],
    own: ['المالك', 'العلاقة مع المالك'],
    gro: ['النمو', 'التوزيع والنمو'],
  },
  growthTask: 'ينشر الإعلان على Booking.com',
  cards: {
    review: {
      title: 'تقييم دون رد — التقييم رقم 3',
      meta: `لورا د. · ${demoDateLabel('2026-05-30', 'ar', { day: 'numeric', month: 'long', year: 'numeric' })} · Airbnb`,
      quote: 'موقع ممتاز ومسكن مريح. ملاحظة صغيرة حول الضجيج في المساء.',
      note: 'اكتب ردًا علنيًا: التقييم الإيجابي الذي يبقى دون رد فرصة ضائعة.',
      cta: 'رد',
    },
    review3: {
      title: 'تقييم دون رد — التقييم رقم 1',
      meta: `صوفي م. · ${demoDateLabel('2026-06-20', 'ar', { day: 'numeric', month: 'long', year: 'numeric' })} · Airbnb`,
      quote: 'إقامة استثنائية، مسكن نظيف جدًا ومطابق تمامًا للصور.',
    },
    mandate: {
      title: 'عقد إدارة بانتظار الإرسال للتوقيع (رقم 7)',
      motif:
        'العقد جاهز لكن لم يُرسل أي طلب توقيع. «إرسال للتوقيع» يُنشئ المستند عند الحاجة ويرسل رابط التوقيع الإلكتروني إلى المالك.',
      cta: 'إرسال للتوقيع',
    },
    review2: {
      title: 'تقييم دون رد — التقييم رقم 6',
      meta: `مارك ف. · ${demoDateLabel('2026-04-22', 'ar', { day: 'numeric', month: 'long', year: 'numeric' })} · Booking.com`,
      quote: 'قيمة ممتازة مقابل السعر وتجهيز جيد. سنعود بكل سرور.',
    },
    lock: {
      title: 'بطارية القفل 12 % — قفل الباب الرئيسي',
      meter: 'بطارية القفل',
      motif:
        'قد يتعطل القفل الذكي — وبقاء الضيف عالقًا عند وصوله أسوأ سيناريو. «جدولة» تُنشئ تدخل استبدال البطاريات (أولوية عالية، ابتداءً من الغد).',
      cta: 'جدولة',
    },
    maintenance: {
      title: 'صيانة وقائية بانتظار الجدولة',
      motif:
        'لا توجد صيانة مكتملة مسجلة لهذا المسكن. «جدولة» تُنشئ جولة الصيانة الوقائية (التكييف، السباكة، التجهيزات) قبل أن يقع عطل أثناء إقامة.',
    },
    police: {
      title: 'بطاقة الشرطة بانتظار التصريح (الحجز رقم 218)',
      motif:
        'بطاقات الضيوف مكتملة لكنها لم تُودع بعد لدى الجهة المختصة. «إرسال إلكتروني» يرسل كل البطاقات المكتملة للإقامة عبر القناة المعدّة.',
      cta: 'إرسال إلكتروني',
    },
  },
  reply: {
    title: 'الرد على هذا التقييم',
    guest: 'لورا د.',
    proposalTitle: 'رد مقترح',
    awaiting: 'بانتظارك',
    proposalLead: 'صاغها الوكيل، ولن تُنشر دونك. الرسالة المقترحة:',
    insert: 'إدراج في ردي',
    dismiss: 'تجاهل',
    orWrite: 'أو اكتب ردك أدناه',
    yourReply: 'ردك',
    consequences: 'ما سيحدث',
    facts: [
      'يُنشر الرد أسفل التقييم، ويراه الجميع.',
      'المسودة المقترحة قابلة للتعديل: لا يُنشر شيء دون مراجعتك.',
    ],
    cancel: 'إلغاء',
    publish: 'نشر الرد',
    draftStart:
      'شكرًا جزيلًا يا لورا على ملاحظاتك وعلى التقييم الجميل. يسعدنا أن الموقع والمسكن نالا إعجابك. وقد أخذنا ملاحظتك حول الضجيج في المساء بعين الاعتبار، و',
    vague: 'سنبحث عن حلول لتحسين راحة ضيوفنا.',
    precise: 'ركّبنا منذ ذلك الحين زجاجًا مزدوجًا في الجهة المطلة على الشارع.',
    draftEnd: ' نتطلع إلى استقبالك من جديد!',
  },
  schedule: {
    title: 'جدولة التدخل',
    month: demoDateLabel('2026-09-26', 'ar', { month: 'long', year: 'numeric' }),
    weekdays: ['ن', 'ث', 'ر', 'خ', 'ج', 'س', 'ح'],
    time: 'الوقت',
    assignee: 'المنفّذ',
    search: 'ابحث عن منفّذ…',
    matching: 'المهنة المطابقة',
    others: 'منفّذون آخرون',
    orgTeam: 'إدارة العقار',
    myself: 'أنا',
    workers: [
      ['يوسف العمراني', 'فني'],
      ['كريم بلقاضي', 'فني خارجي'],
    ],
    otherWorkers: [['سلمى الإدريسي', 'عاملة تنظيف']],
    readbackBefore: `${demoDateLabel('2026-09-27', 'ar', { weekday: 'long', day: 'numeric', month: 'long' })} في 10:00`,
    readbackDay: `${demoDateLabel('2026-09-28', 'ar', { weekday: 'long', day: 'numeric', month: 'long' })} في 10:00`,
    readback: `${demoDateLabel('2026-09-28', 'ar', { weekday: 'long', day: 'numeric', month: 'long' })} في 10:00، يوسف العمراني`,
    cancel: 'إلغاء',
    confirm: 'جدولة',
  },
  police: {
    title: 'إرسال البطاقات إلكترونيًا',
    facts: [
      'تُرسل البطاقات المكتملة إلى البوابة الرسمية.',
      'لا تُرسل البطاقات الناقصة ويبقى إكمالها مطلوبًا.',
    ],
    cancel: 'إلغاء',
  },
  steps: [
    {
      title: 'كل محفظتك في شبكة واحدة',
      body: 'كل مسكن وكل إقامة وكل قناة على التقويم نفسه.',
      voice: '',
    },
    {
      title: 'فتح مسكن',
      body: 'يفتح السهم كوكبة وكلاء المسكن مباشرة أسفل صفّه.',
      voice: '',
    },
    {
      title: 'عشرة وكلاء على أهبة الاستعداد',
      body: 'كل شارة تعدّ القرارات التي تنتظرك: 27 لهذا المسكن.',
      voice: '',
    },
    {
      title: 'تقييم بانتظار المعالجة',
      body: 'تركت لورا 4 نجوم وملاحظة حول الضجيج. وقد أعدّ الوكيل ردًا مسبقًا.',
      voice: '',
    },
    {
      title: 'رد صاغه الذكاء الاصطناعي',
      body: '«رد» يفتح اقتراح الوكيل. ندرجه: لم يُنشر شيء بعد.',
      voice: '',
    },
    {
      title: 'تعدّله ثم تنشره',
      body: 'يتحول الوعد الغامض إلى إجراء ملموس: زجاج مزدوج في جهة الشارع.',
      voice: '',
    },
    {
      title: 'قفل عند 12 %',
      body: 'يرصد وكيل العمليات ضعف البطارية قبل أن يبقى ضيف عالقًا في الخارج.',
      voice: '',
    },
    {
      title: 'جدولة التدخل',
      body: 'التاريخ والوقت والمنفّذ: تُنشأ المهمة وتُعرض على الفني.',
      voice: '',
    },
    {
      title: 'عرض الوكلاء',
      body: 'الوكلاء العشرة في قائمة: من ينتظر قرارًا يتصدّرها.',
      voice: '',
    },
    {
      title: 'التصريح ببطاقة الشرطة',
      body: 'البطاقات مكتملة. قبل الإرسال يوضح بيتلي بالضبط ما سيُرسل.',
      voice: '',
    },
    {
      title: 'ضبط الاستقلالية',
      body: 'يمكن لوكيل الإيرادات التنفيذ ثم إشعارك. الإجراءات الحساسة تبقى بانتظار موافقتك.',
      voice: '',
    },
  ],
};

export const AGENTS_DEMO_MESSAGES: Record<SiteLanguage, AgentsDemoMessages> = {
  fr,
  en,
  ar: localizeDemoCopy(ar),
};
