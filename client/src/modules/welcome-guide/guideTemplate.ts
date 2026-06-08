import type {
  GuideActivity,
  GuidePoi,
  GuideSection,
  GuideSectionItem,
  GuideSectionLayout,
} from '../../services/api/welcomeGuideApi';

/**
 * Modèle de base d'un nouveau livret, repris fidèlement du template « Baitly welcome
 * book » (`wb-data.jsx`). À la création, le formulaire est pré-rempli avec un contenu
 * riche et structuré (sections en accordéons / listes d'icônes / transports, lieux,
 * activités) que l'hôte personnalise, complète ou supprime librement.
 */

type Lang = 'fr' | 'en' | 'ar';

interface TplItem {
  icon: string;
  label: string;
  detail?: string;
  steps?: string[];
}
interface TplSection {
  icon: string;
  title: string;
  subtitle: string;
  layout: GuideSectionLayout;
  body?: string;
  items?: TplItem[];
}
interface GuideTemplate {
  welcomeMessage: string;
  sections: TplSection[];
  pois: Array<{ category: string; name: string; type: string; note: string; featured?: boolean }>;
  activities: Array<{ title: string; price: string; description: string; featured?: boolean }>;
}

const TEMPLATES: Record<Lang, GuideTemplate> = {
  fr: {
    welcomeMessage:
      "Bienvenue chez nous ! Installez-vous, respirez — tout ce qu'il vous faut pour un séjour parfait est dans ce livret. Pour la moindre question, nous restons joignables à tout moment.",
    sections: [
      {
        icon: 'sofa',
        title: 'Le logement',
        subtitle: "Équipements & modes d'emploi",
        layout: 'steps',
        items: [
          { icon: 'coffee', label: 'Machine à café', steps: ['Placez une capsule, fermez le levier.', 'Posez votre tasse, lancez la grande tasse.', 'Capsules offertes dans le tiroir.'] },
          { icon: 'thermometer-sun', label: 'Chauffage & climatisation', steps: ["Thermostat mural dans l'entrée.", 'Confort recommandé : 20–21°C.', 'La clim se règle via la télécommande.'] },
          { icon: 'washing-machine', label: 'Lave-linge', steps: ["Lessive sous l'évier.", 'Programme « Éco 40° » conseillé.', 'Étendoir dans le placard de la salle de bain.'] },
          { icon: 'tv', label: 'TV & streaming', steps: ['Télécommande sur le meuble.', 'Netflix & Disney+ déjà connectés.', 'Déconnectez vos comptes avant le départ.'] },
          { icon: 'flame', label: 'Plaques de cuisson', steps: ['Touchez le bouton power 1 seconde.', 'Ustensiles compatibles dans le tiroir.', 'Sécurité enfant : appui long sur le cadenas.'] },
          { icon: 'shower-head', label: 'Salle de bain', steps: ['Eau chaude instantanée.', "Serviettes propres dans l'armoire.", 'Sèche-cheveux dans le tiroir du bas.'] },
        ],
      },
      {
        icon: 'scroll-text',
        title: 'Règlement intérieur',
        subtitle: 'Pour un séjour serein',
        layout: 'rules',
        items: [
          { icon: 'cigarette-off', label: 'Logement strictement non-fumeur' },
          { icon: 'party-popper', label: "Pas de fête ni d'événement" },
          { icon: 'moon', label: 'Silence entre 22h et 8h (voisinage)' },
          { icon: 'users', label: 'Respecter le nombre de voyageurs' },
          { icon: 'paw-print', label: 'Animaux sur demande uniquement' },
          { icon: 'recycle', label: "Tri sélectif — bacs sous l'évier" },
        ],
      },
      {
        icon: 'train-front',
        title: 'Transports',
        subtitle: 'Comment se déplacer',
        layout: 'list',
        items: [
          { icon: 'train-front', label: 'Transports en commun', detail: 'Métro / bus / tram les plus proches' },
          { icon: 'bike', label: 'Vélos en libre-service', detail: 'Station à quelques minutes à pied' },
          { icon: 'car-front', label: 'Taxi / VTC', detail: 'Uber, Bolt — 2 à 5 min d’attente' },
          { icon: 'plane', label: 'Aéroport', detail: 'Transfert sur demande' },
        ],
      },
      {
        icon: 'info',
        title: 'Bon à savoir',
        subtitle: 'Infos pratiques',
        layout: 'text',
        body: "Le code Wi-Fi est en haut du livret.\nServiettes et linge de maison propres dans l'armoire.\nUn numéro utile est disponible en cas d'urgence.\nMerci de laisser le logement tel que vous l'avez trouvé en partant.",
      },
    ],
    pois: [
      { category: 'RESTAURANT', name: 'Notre table préférée', type: 'Cuisine du moment', note: 'Notre adresse coup de cœur — pensez à réserver.', featured: true },
      { category: 'RESTAURANT', name: 'Le bistrot du coin', type: 'Bistrot', note: 'Cuisine généreuse et conviviale.' },
      { category: 'CAFE', name: 'Le café du matin', type: 'Petit-déjeuner & pauses', note: 'Parfait pour bien commencer la journée.', featured: true },
      { category: 'GROCERY', name: 'Épicerie / supérette', type: 'Courses', note: 'Pour les indispensables, à deux pas.' },
      { category: 'ATTRACTION', name: 'Incontournable du quartier', type: 'À voir', note: 'Le lieu à ne pas manquer pendant votre séjour.' },
      { category: 'PHARMACY', name: 'Pharmacie la plus proche', type: 'Santé', note: 'En cas de besoin.' },
    ],
    activities: [
      { title: 'Croisière au coucher du soleil', price: '39 € / pers.', description: "Une vue imprenable depuis l'eau, en fin de journée.", featured: true },
      { title: 'Dégustation de spécialités locales', price: '45 € / pers.', description: 'Vins, fromages et produits du terroir, commentés.' },
      { title: 'Visite guidée des incontournables', price: '29 € / pers.', description: 'Les lieux emblématiques avec un guide passionné.' },
      { title: 'Atelier cuisine', price: '65 € / pers.', description: 'Mettez la main à la pâte avec un chef local.' },
    ],
  },
  en: {
    welcomeMessage:
      "Welcome to our home! Settle in, breathe — everything you need for a perfect stay is in this guide. If you have any question at all, we're reachable any time.",
    sections: [
      {
        icon: 'sofa',
        title: 'The apartment',
        subtitle: 'Amenities & how-to guides',
        layout: 'steps',
        items: [
          { icon: 'coffee', label: 'Coffee machine', steps: ['Insert a capsule, close the lever.', 'Place your cup, press the large-cup button.', 'Complimentary capsules in the drawer.'] },
          { icon: 'thermometer-sun', label: 'Heating & A/C', steps: ['Wall thermostat in the hallway.', 'Recommended: 20–21°C.', 'A/C via the remote.'] },
          { icon: 'washing-machine', label: 'Washer', steps: ['Detergent under the sink.', "Use the 'Eco 40°' cycle.", 'Drying rack in the bathroom cupboard.'] },
          { icon: 'tv', label: 'TV & streaming', steps: ['Remote on the console.', 'Netflix & Disney+ already signed in.', 'Please sign out before you leave.'] },
          { icon: 'flame', label: 'Hob', steps: ['Hold the power button for 1 second.', 'Compatible pans in the drawer.', 'Child-lock: long-press the padlock.'] },
          { icon: 'shower-head', label: 'Bathroom', steps: ['Instant hot water.', 'Fresh towels in the cabinet.', 'Hairdryer in the bottom drawer.'] },
        ],
      },
      {
        icon: 'scroll-text',
        title: 'House rules',
        subtitle: 'For a serene stay',
        layout: 'rules',
        items: [
          { icon: 'cigarette-off', label: 'Strictly no smoking' },
          { icon: 'party-popper', label: 'No parties or events' },
          { icon: 'moon', label: 'Quiet hours 10pm – 8am (neighbours)' },
          { icon: 'users', label: 'Respect the guest count' },
          { icon: 'paw-print', label: 'Pets on request only' },
          { icon: 'recycle', label: 'Please recycle — bins under the sink' },
        ],
      },
      {
        icon: 'train-front',
        title: 'Getting around',
        subtitle: 'How to move',
        layout: 'list',
        items: [
          { icon: 'train-front', label: 'Public transport', detail: 'Nearest metro / bus / tram' },
          { icon: 'bike', label: 'Shared bikes', detail: 'Station a few minutes away' },
          { icon: 'car-front', label: 'Taxi / ride-hail', detail: 'Uber, Bolt — 2–5 min wait' },
          { icon: 'plane', label: 'Airport', detail: 'Transfer on request' },
        ],
      },
      {
        icon: 'info',
        title: 'Good to know',
        subtitle: 'Practical info',
        layout: 'text',
        body: 'The Wi-Fi code is at the top of this guide.\nFresh towels and linen are in the cupboard.\nA useful number is available in case of emergency.\nPlease leave the place as you found it on departure.',
      },
    ],
    pois: [
      { category: 'RESTAURANT', name: 'Our favourite spot', type: 'Seasonal cuisine', note: 'Our go-to — booking recommended.', featured: true },
      { category: 'RESTAURANT', name: 'The local bistro', type: 'Bistro', note: 'Hearty, friendly cooking.' },
      { category: 'CAFE', name: 'The morning café', type: 'Breakfast & breaks', note: 'A great way to start the day.', featured: true },
      { category: 'GROCERY', name: 'Grocery / mini-market', type: 'Shopping', note: 'For the essentials, just around the corner.' },
      { category: 'ATTRACTION', name: 'Neighbourhood must-see', type: 'To see', note: 'The place not to miss during your stay.' },
      { category: 'PHARMACY', name: 'Nearest pharmacy', type: 'Health', note: 'Should you need it.' },
    ],
    activities: [
      { title: 'Sunset cruise', price: '€39 / person', description: 'A stunning view from the water at the end of the day.', featured: true },
      { title: 'Local food tasting', price: '€45 / person', description: 'Wines, cheeses and regional produce, with commentary.' },
      { title: 'Guided highlights tour', price: '€29 / person', description: 'The iconic spots with a passionate guide.' },
      { title: 'Cooking workshop', price: '€65 / person', description: 'Get hands-on with a local chef.' },
    ],
  },
  ar: {
    welcomeMessage:
      'أهلاً بك في بيتنا! استرِح وتنفّس — كل ما تحتاجه لإقامة مثالية موجود في هذا الدليل. لأي سؤال، نحن متاحون في أي وقت.',
    sections: [
      {
        icon: 'sofa',
        title: 'المسكن',
        subtitle: 'التجهيزات وطريقة الاستخدام',
        layout: 'steps',
        items: [
          { icon: 'coffee', label: 'آلة القهوة', steps: ['ضع كبسولة وأغلق الذراع.', 'ضع كوبك واضغط زر الكوب الكبير.', 'كبسولات مجانية في الدرج.'] },
          { icon: 'thermometer-sun', label: 'التدفئة والتكييف', steps: ['منظّم الحرارة في المدخل.', 'يُنصح بـ 20–21°م.', 'يُضبط التكييف عبر جهاز التحكم.'] },
          { icon: 'washing-machine', label: 'الغسالة', steps: ['المنظّف تحت الحوض.', 'يُفضّل برنامج « اقتصادي 40° ».', 'حبل النشر في خزانة الحمام.'] },
          { icon: 'tv', label: 'التلفاز والبث', steps: ['جهاز التحكم على الطاولة.', 'نتفليكس وديزني+ مسجّلان مسبقاً.', 'سجّل الخروج قبل المغادرة.'] },
          { icon: 'flame', label: 'الموقد', steps: ['اضغط زر التشغيل ثانية واحدة.', 'الأواني المتوافقة في الدرج.', 'قفل الأطفال: اضغط مطوّلاً على القفل.'] },
          { icon: 'shower-head', label: 'الحمّام', steps: ['ماء ساخن فوري.', 'مناشف نظيفة في الخزانة.', 'مجفّف الشعر في الدرج السفلي.'] },
        ],
      },
      {
        icon: 'scroll-text',
        title: 'قواعد المنزل',
        subtitle: 'من أجل إقامة هادئة',
        layout: 'rules',
        items: [
          { icon: 'cigarette-off', label: 'ممنوع التدخين منعاً باتاً' },
          { icon: 'party-popper', label: 'لا حفلات ولا فعاليات' },
          { icon: 'moon', label: 'الهدوء بين 10 مساءً و8 صباحاً' },
          { icon: 'users', label: 'الالتزام بعدد الضيوف' },
          { icon: 'paw-print', label: 'الحيوانات بناءً على الطلب فقط' },
          { icon: 'recycle', label: 'فرز النفايات — الحاويات تحت الحوض' },
        ],
      },
      {
        icon: 'train-front',
        title: 'المواصلات',
        subtitle: 'كيفية التنقّل',
        layout: 'list',
        items: [
          { icon: 'train-front', label: 'النقل العام', detail: 'أقرب مترو / حافلة / ترام' },
          { icon: 'bike', label: 'دراجات مشتركة', detail: 'محطة على بُعد دقائق' },
          { icon: 'car-front', label: 'سيارة أجرة', detail: 'أوبر، بولت — انتظار 2 إلى 5 دقائق' },
          { icon: 'plane', label: 'المطار', detail: 'نقل عند الطلب' },
        ],
      },
      {
        icon: 'info',
        title: 'معلومات مفيدة',
        subtitle: 'معلومات عملية',
        layout: 'text',
        body: 'رمز الواي فاي أعلى الدليل.\nالمناشف والبياضات النظيفة في الخزانة.\nيتوفر رقم مفيد للطوارئ.\nيُرجى ترك المسكن كما وجدته عند المغادرة.',
      },
    ],
    pois: [
      { category: 'RESTAURANT', name: 'مطعمنا المفضّل', type: 'مطبخ موسمي', note: 'وجهتنا المفضّلة — يُنصح بالحجز.', featured: true },
      { category: 'RESTAURANT', name: 'مطعم الحي', type: 'بيسترو', note: 'مطبخ كريم وودود.' },
      { category: 'CAFE', name: 'مقهى الصباح', type: 'فطور واستراحات', note: 'طريقة رائعة لبدء اليوم.', featured: true },
      { category: 'GROCERY', name: 'بقالة / متجر صغير', type: 'تسوّق', note: 'للأساسيات، على بُعد خطوات.' },
      { category: 'ATTRACTION', name: 'معلم لا يُفوّت في الحي', type: 'للزيارة', note: 'المكان الذي يجب زيارته خلال إقامتك.' },
      { category: 'PHARMACY', name: 'أقرب صيدلية', type: 'صحة', note: 'عند الحاجة.' },
    ],
    activities: [
      { title: 'رحلة بحرية عند الغروب', price: '39 € / للشخص', description: 'إطلالة ساحرة من الماء في نهاية اليوم.', featured: true },
      { title: 'تذوّق المأكولات المحلية', price: '45 € / للشخص', description: 'نبيذ وأجبان ومنتجات محلية مع الشرح.' },
      { title: 'جولة مرشدة لأبرز المعالم', price: '29 € / للشخص', description: 'الأماكن الأيقونية مع مرشد شغوف.' },
      { title: 'ورشة طبخ', price: '65 € / للشخص', description: 'جرّب الطبخ مع طاهٍ محلي.' },
    ],
  },
};

function pick(lang: string): GuideTemplate {
  return TEMPLATES[(lang as Lang)] ?? TEMPLATES.fr;
}

/** Mot d'accueil par défaut du modèle. */
export function templateWelcomeMessage(lang: string): string {
  return pick(lang).welcomeMessage;
}

/** Sections pré-remplies (structurées : steps / rules / list / text), ids frais. */
export function buildTemplateSections(lang: string): GuideSection[] {
  const now = Date.now();
  return pick(lang).sections.map((s, i): GuideSection => ({
    id: `s-${now}-${i}`,
    icon: s.icon,
    title: s.title,
    subtitle: s.subtitle,
    layout: s.layout,
    body: s.body ?? '',
    items: (s.items ?? []).map((it, j): GuideSectionItem => ({
      id: `it-${now}-${i}-${j}`,
      icon: it.icon,
      label: it.label,
      detail: it.detail ?? '',
      steps: it.steps ?? [],
    })),
  }));
}

/** Points « autour de moi » pré-remplis (catégorie + nom + type + note ; à géolocaliser). */
export function buildTemplatePois(lang: string): GuidePoi[] {
  const now = Date.now();
  return pick(lang).pois.map((p, i): GuidePoi => ({
    id: `poi-${now}-${i}`,
    category: p.category,
    name: p.name,
    type: p.type,
    address: '',
    lat: null,
    lng: null,
    note: p.note,
    featured: !!p.featured,
  }));
}

/** Activités à proposer pré-remplies (manuelles, à compléter avec un lien de réservation). */
export function buildTemplateActivities(lang: string): GuideActivity[] {
  const now = Date.now();
  return pick(lang).activities.map((a, i): GuideActivity => ({
    id: `act-${now}-${i}`,
    source: 'MANUAL',
    externalId: null,
    title: a.title,
    imageUrl: null,
    price: a.price,
    bookingUrl: '',
    description: a.description,
    featured: !!a.featured,
  }));
}
