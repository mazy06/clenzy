import type { SiteLanguage } from '../siteLanguage';

/**
 * Livret d'accueil montre sur la page produit.
 *
 * <p>Le contenu suit le marche de la langue : un sejour a Marrakech en
 * francais, a Riyad en arabe. Les activites proposees et la devise changent
 * avec — un livret saoudien qui vend une montgolfiere a Marrakech ne
 * ressemblerait a rien.</p>
 */
const fr = {
  eyebrow: 'Aperçu',
  title: 'Le livret que reçoit votre voyageur.',
  intro: 'Un simple lien, sans application — tout le séjour dans sa poche.',
  cta: 'Voir une démo',
  stay: 'Marrakech · 20 → 25 juillet',
  checkinTitle: 'Complétez votre arrivée',
  checkinSub: 'Obligatoire pour accéder au livret',
  checkinFields: [
    { label: 'Nom complet', value: 'Marie Lefebvre' },
    { label: 'Pièce d’identité', value: 'Passeport · 21FR8842' },
    { label: 'Date de naissance', value: '14/03/1991' },
    { label: 'Nationalité', value: 'France' },
  ],
  checkinDone: 'Déclaration de voyageur transmise — rien à ressaisir pour l’hôte.',
  openGuide: 'Accéder au livret',
  fieldsFilled: 'renseignés',
  hostName: 'Votre hôte Amine',
  hostWord:
    'Bienvenue chez nous ! Installez-vous, tout ce qu’il faut pour un séjour parfait est dans ce livret.',
  essentialsTitle: 'Les essentiels',
  essentials: [
    { label: 'Wi-Fi', value: 'DUPLEX-BADII' },
    { label: 'Code d’accès', value: '4821' },
    { label: 'Arrivée', value: 'dès 15:00' },
    { label: 'Départ', value: 'avant 11:00' },
  ],
  exploreTitle: 'Explorer le livret',
  sections: [
    { title: 'Arrivée & accès', sub: 'Trouver le logement, entrer' },
    { title: 'Règlement intérieur', sub: 'Les règles de la maison' },
    { title: 'Le quartier', sub: 'Nos adresses autour de vous' },
  ],
  activitiesTitle: 'Expériences à réserver',
  activities: [
    { title: 'Montgolfière au lever du soleil', price: '1 200 MAD', tag: 'Coup de cœur' },
    { title: 'Dîner dans le désert', price: '650 MAD', tag: null as string | null },
    { title: 'Cours de cuisine locale', price: '450 MAD', tag: null as string | null },
  ],
  book: 'Réserver',
  poweredBy: 'Propulsé par',
  accessCode: 'Code d’accès',
  accessCodeValidity: 'Actif du 20 au 25 juillet',
  commission: 'Commission reversée',
  steps: [
    { title: 'Check-in en ligne', copy: 'Le voyageur saisit son identité — la déclaration part toute seule.' },
    { title: 'Accueil personnalisé', copy: 'Le mot de l’hôte, une fois l’arrivée validée.' },
    { title: 'Les essentiels', copy: 'Wi-Fi, code d’accès, horaires — sans avoir à les écrire.' },
    { title: 'Le quartier', copy: 'Vos adresses, pas celles d’un guide générique.' },
    { title: 'Expériences à réserver', copy: 'Activités et services, réservables en un geste.' },
  ],
};

export type GuideMessages = typeof fr;

const en: GuideMessages = {
  eyebrow: 'Preview',
  title: 'The guide your guest receives.',
  intro: 'A single link, no app — the whole stay in their pocket.',
  cta: 'See a demo',
  stay: 'Marrakech · 20 → 25 July',
  checkinTitle: 'Complete your check-in',
  checkinSub: 'Required to open the guide',
  checkinFields: [
    { label: 'Full name', value: 'Marie Lefebvre' },
    { label: 'ID document', value: 'Passport · 21FR8842' },
    { label: 'Date of birth', value: '14/03/1991' },
    { label: 'Nationality', value: 'France' },
  ],
  checkinDone: 'Guest registration filed — nothing for the host to re-enter.',
  openGuide: 'Open the guide',
  fieldsFilled: 'completed',
  hostName: 'Your host Amine',
  hostWord:
    'Welcome! Make yourself at home — everything you need for a perfect stay is in this guide.',
  essentialsTitle: 'The essentials',
  essentials: [
    { label: 'Wi-Fi', value: 'DUPLEX-BADII' },
    { label: 'Access code', value: '4821' },
    { label: 'Check-in', value: 'from 15:00' },
    { label: 'Check-out', value: 'before 11:00' },
  ],
  exploreTitle: 'Explore the guide',
  sections: [
    { title: 'Arrival & access', sub: 'Finding the property, getting in' },
    { title: 'House rules', sub: 'The rules of the house' },
    { title: 'The neighbourhood', sub: 'Our addresses around you' },
  ],
  activitiesTitle: 'Experiences to book',
  activities: [
    { title: 'Hot-air balloon at sunrise', price: '1,200 MAD', tag: 'Favourite' },
    { title: 'Dinner in the desert', price: '650 MAD', tag: null },
    { title: 'Local cooking class', price: '450 MAD', tag: null },
  ],
  book: 'Book',
  poweredBy: 'Powered by',
  accessCode: 'Access code',
  accessCodeValidity: 'Active 20 to 25 July',
  commission: 'Commission paid back',
  steps: [
    { title: 'Online check-in', copy: 'The guest enters their identity — the registration files itself.' },
    { title: 'Personal welcome', copy: 'The host’s word, once check-in is approved.' },
    { title: 'The essentials', copy: 'Wi-Fi, access code, times — without writing them out.' },
    { title: 'The neighbourhood', copy: 'Your addresses, not a generic guidebook’s.' },
    { title: 'Experiences to book', copy: 'Activities and services, bookable in one tap.' },
  ],
};

const ar: GuideMessages = {
  eyebrow: 'معاينة',
  title: 'الدليل الذي يستلمه نزيلك.',
  intro: 'رابط واحد، بلا تطبيق — الإقامة كلها في جيبه.',
  cta: 'شاهد عرضاً توضيحياً',
  stay: 'الرياض · 20 ← 25 يوليو',
  checkinTitle: 'أكمل إجراءات وصولك',
  checkinSub: 'مطلوب لفتح الدليل',
  checkinFields: [
    { label: 'الاسم الكامل', value: 'نورة العتيبي' },
    { label: 'وثيقة الهوية', value: 'هوية وطنية · 10•••4821' },
    { label: 'تاريخ الميلاد', value: '1991/03/14' },
    { label: 'الجنسية', value: 'السعودية' },
  ],
  checkinDone: 'سُجِّل النزيل — ولا شيء يعيد المضيف إدخاله.',
  openGuide: 'ادخل إلى الدليل',
  fieldsFilled: 'مكتملة',
  hostName: 'مضيفك أمين',
  hostWord: 'أهلاً بك! استرح، وكل ما تحتاجه لإقامة مثالية موجود في هذا الدليل.',
  essentialsTitle: 'الأساسيات',
  essentials: [
    { label: 'الواي فاي', value: 'DUPLEX-BADII' },
    { label: 'رمز الدخول', value: '4821' },
    { label: 'الوصول', value: 'من 15:00' },
    { label: 'المغادرة', value: 'قبل 11:00' },
  ],
  exploreTitle: 'تصفّح الدليل',
  sections: [
    { title: 'الوصول والدخول', sub: 'كيف تصل إلى الوحدة وتدخلها' },
    { title: 'قواعد المكان', sub: 'أنظمة البيت' },
    { title: 'الحي', sub: 'عناويننا المفضّلة حولك' },
  ],
  activitiesTitle: 'تجارب للحجز',
  activities: [
    { title: 'رحلة منطاد عند الشروق', price: '450 ر.س', tag: 'الأكثر طلباً' },
    { title: 'عشاء في صحراء الثمامة', price: '240 ر.س', tag: null },
    { title: 'درس طبخ سعودي', price: '170 ر.س', tag: null },
  ],
  book: 'احجز',
  poweredBy: 'مدعوم بـ',
  accessCode: 'رمز الدخول',
  accessCodeValidity: 'فعّال من 20 إلى 25 يوليو',
  commission: 'عمولة مُعادة إليك',
  steps: [
    { title: 'تسجيل وصول إلكتروني', copy: 'يُدخل النزيل هويته — والتسجيل النظامي يتم وحده.' },
    { title: 'ترحيب شخصي', copy: 'كلمة المضيف، بعد اعتماد الوصول.' },
    { title: 'الأساسيات', copy: 'الواي فاي ورمز الدخول والمواعيد — دون كتابتها مرّة بعد مرّة.' },
    { title: 'الحي', copy: 'عناوينك أنت، لا عناوين دليل عام.' },
    { title: 'تجارب للحجز', copy: 'أنشطة وخدمات، تُحجز بحركة واحدة.' },
  ],
};

export const GUIDE_MESSAGES: Record<SiteLanguage, GuideMessages> = { fr, en, ar };
