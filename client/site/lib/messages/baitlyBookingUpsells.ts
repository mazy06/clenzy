import type { SiteLanguage } from '../siteLanguage';

export type BookingUpsellGroup = 'stay' | 'private' | 'experiences';
export type BookingUpsellId =
  | 'late'
  | 'cleaning'
  | 'chef'
  | 'dinner'
  | 'balloon'
  | 'desert';

export interface BookingUpsellMessages {
  eyebrow: string;
  title: string;
  intro: string;
  link: string;
  choose: string;
  groups: Record<BookingUpsellGroup, { label: string; copy: string }>;
  offers: Record<BookingUpsellId, { title: string; detail: string }>;
  add: string;
  added: string;
  remove: string;
  selection: string;
  empty: string;
  total: string;
  value: string;
  tryIt: string;
  note: string;
  ownTitle: string;
  ownCopy: string;
  partnerTitle: string;
  partnerCopy: string;
  continuation: string;
  guideLink: string;
}

const fr: BookingUpsellMessages = {
  eyebrow: 'Upsells & expériences',
  title: 'Votre booking engine vend aussi tout ce qui fait le séjour.',
  intro:
    'Une nuit de plus n’est pas la seule façon de vendre davantage. Mettez vos services et les expériences de vos partenaires en vitrine sur votre site de réservation : le voyageur découvre, choisit et complète son séjour.',
  link: 'Découvrir les upsells',
  choose: 'Explorer les familles d’upsells',
  groups: {
    stay: {
      label: 'Confort du séjour',
      copy: 'Arrivée anticipée, départ tardif, ménage, linge ou panier d’accueil : valorisez les services que vous proposez déjà.',
    },
    private: {
      label: 'Services privés',
      copy: 'Chef à domicile, repas, transfert aéroport, spa ou garde d’enfants : proposez une attention adaptée à chaque voyageur.',
    },
    experiences: {
      label: 'Activités & expériences',
      copy: 'Montgolfière, excursion, dîner dans le désert ou cours de cuisine : donnez envie de découvrir la destination avec vos partenaires.',
    },
  },
  offers: {
    late: {
      title: 'Prendre son temps',
      detail: 'Départ tardif à 16 h · pour le séjour',
    },
    cleaning: {
      title: 'Retrouver une maison impeccable',
      detail: 'Ménage en cours de séjour · 1 passage',
    },
    chef: {
      title: 'Un chef, chez vous',
      detail: 'Dîner préparé sur place · pour deux',
    },
    dinner: {
      title: 'Le dîner vous attend',
      detail: 'Repas livré au logement · pour deux',
    },
    balloon: {
      title: 'Le lever du soleil, vu d’en haut',
      detail: 'Vol en montgolfière · pour 1 personne',
    },
    desert: {
      title: 'Une escapade dans le désert',
      detail: 'Excursion accompagnée · pour 1 personne',
    },
  },
  add: 'Ajouter au séjour',
  added: 'Ajouté au séjour',
  remove: 'Retirer',
  selection: 'Votre sélection',
  empty:
    'Ajoutez un service ou une expérience. Le montant de votre sélection se met à jour ici.',
  total: 'Total des extras',
  value: 'de ventes additionnelles dans cet exemple',
  tryIt: 'Essayez d’ajouter une option',
  note: 'Sélection de démonstration, tarifs illustratifs en euros. Les offres et modalités de réservation dépendent de votre catalogue et de vos partenaires. Aucun achat réel.',
  ownTitle: 'Vos services, vos prix',
  ownCopy:
    'Mettez en avant vos propres prestations et fixez leurs tarifs. Un départ tardif ou un dîner devient une offre visible, au lieu de rester une demande par message.',
  partnerTitle: 'Les expériences de vos partenaires',
  partnerCopy:
    'Complétez votre offre avec des activités locales. La rémunération et les conditions sont celles convenues avec chaque partenaire.',
  continuation:
    'Sur le site de réservation, puis dans le livret : multipliez les occasions de proposer une attention, avant l’arrivée et pendant le séjour.',
  guideLink: 'Voir les upsells dans le livret d’accueil',
};

const en: BookingUpsellMessages = {
  eyebrow: 'Upsells & experiences',
  title: 'Your booking engine sells the whole stay, too.',
  intro:
    'Another night is only one way to sell more. Showcase your services and partner experiences on your booking website, so guests can discover, choose and add to their stay.',
  link: 'Explore the upsells',
  choose: 'Explore upsell categories',
  groups: {
    stay: {
      label: 'Stay essentials',
      copy: 'Early check-in, late check-out, cleaning, linen or a welcome basket: make the services you already offer visible.',
    },
    private: {
      label: 'Private services',
      copy: 'An in-home chef, meals, airport transfers, spa or childcare: offer a thoughtful service for each guest.',
    },
    experiences: {
      label: 'Activities & experiences',
      copy: 'A balloon flight, excursion, desert dinner or cooking class: inspire guests to discover the destination with your partners.',
    },
  },
  offers: {
    late: {
      title: 'Take your time',
      detail: 'Late check-out at 4 pm · per stay',
    },
    cleaning: {
      title: 'Come back to a spotless home',
      detail: 'Mid-stay cleaning · 1 visit',
    },
    chef: {
      title: 'Your own chef',
      detail: 'Dinner prepared at home · for two',
    },
    dinner: {
      title: 'Dinner is waiting',
      detail: 'Meal delivered to the property · for two',
    },
    balloon: {
      title: 'Sunrise from above',
      detail: 'Hot-air balloon flight · for 1 person',
    },
    desert: {
      title: 'An escape into the desert',
      detail: 'Guided excursion · for 1 person',
    },
  },
  add: 'Add to the stay',
  added: 'Added to the stay',
  remove: 'Remove',
  selection: 'Your selection',
  empty: 'Add a service or experience. Your selection total updates here.',
  total: 'Extras total',
  value: 'in additional sales in this example',
  tryIt: 'Try adding an option',
  note: 'Demo selection with illustrative prices in euros. Offers and booking terms depend on your catalogue and partners. No actual purchase.',
  ownTitle: 'Your services, your prices',
  ownCopy:
    'Showcase your own services and set their prices. Late check-out or dinner becomes a visible offer, instead of a request buried in messages.',
  partnerTitle: 'Your partners’ experiences',
  partnerCopy:
    'Extend your offer with local activities. Remuneration and terms follow your agreement with each partner.',
  continuation:
    'On the booking website, then in the welcome guide: offer thoughtful extras before arrival and throughout the stay.',
  guideLink: 'Explore upsells in the welcome guide',
};

const ar: BookingUpsellMessages = {
  eyebrow: 'خدمات إضافية وتجارب',
  title: 'محرك حجزك يبيع أيضاً كل ما يجعل الإقامة مميزة.',
  intro:
    'ليلة إضافية ليست الطريقة الوحيدة لزيادة المبيعات. اعرض خدماتك وتجارب شركائك على موقع الحجز ليكتشفها الضيف ويختار ما يكمل إقامته.',
  link: 'اكتشف الخدمات الإضافية',
  choose: 'استكشف فئات الخدمات الإضافية',
  groups: {
    stay: {
      label: 'راحة الإقامة',
      copy: 'وصول مبكر أو مغادرة متأخرة أو تنظيف أو بياضات أو سلة ترحيب: أبرز الخدمات التي تقدمها بالفعل.',
    },
    private: {
      label: 'خدمات خاصة',
      copy: 'طاهٍ في المنزل أو وجبات أو نقل من المطار أو سبا أو رعاية أطفال: خدمة مناسبة لكل ضيف.',
    },
    experiences: {
      label: 'أنشطة وتجارب',
      copy: 'رحلة منطاد أو جولة أو عشاء في الصحراء أو درس طبخ: شجّع ضيوفك على اكتشاف الوجهة مع شركائك.',
    },
  },
  offers: {
    late: { title: 'خذ وقتك', detail: 'مغادرة متأخرة حتى 16:00 · للإقامة' },
    cleaning: {
      title: 'عد إلى منزل نظيف',
      detail: 'تنظيف أثناء الإقامة · زيارة واحدة',
    },
    chef: {
      title: 'طاهٍ خاص في منزلك',
      detail: 'عشاء يُحضّر في المنزل · لشخصين',
    },
    dinner: {
      title: 'عشاؤك بانتظارك',
      detail: 'وجبة تُوصّل إلى مكان الإقامة · لشخصين',
    },
    balloon: { title: 'الشروق من الأعلى', detail: 'رحلة بالمنطاد · لشخص واحد' },
    desert: { title: 'رحلة إلى الصحراء', detail: 'جولة مع مرشد · لشخص واحد' },
  },
  add: 'أضف إلى الإقامة',
  added: 'أُضيف إلى الإقامة',
  remove: 'إزالة',
  selection: 'اختياراتك',
  empty: 'أضف خدمة أو تجربة. يُحدَّث مجموع اختياراتك هنا.',
  total: 'إجمالي الإضافات',
  value: 'مبيعات إضافية في هذا المثال',
  tryIt: 'جرّب إضافة خيار',
  note: 'اختيارات تجريبية وأسعار توضيحية باليورو. تعتمد العروض وشروط الحجز على كتالوجك وشركائك. لا يوجد شراء فعلي.',
  ownTitle: 'خدماتك وأسعارك',
  ownCopy:
    'أبرز خدماتك الخاصة وحدد أسعارها. تصبح المغادرة المتأخرة أو وجبة العشاء عرضاً ظاهراً، بدلاً من طلب ضمن الرسائل.',
  partnerTitle: 'تجارب شركائك',
  partnerCopy:
    'أكمل عروضك بأنشطة محلية. تخضع العوائد والشروط لاتفاقك مع كل شريك.',
  continuation:
    'على موقع الحجز، ثم في دليل الاستقبال: فرص لتقديم إضافات مميزة قبل الوصول وخلال الإقامة.',
  guideLink: 'اكتشف الإضافات في دليل الاستقبال',
};

export const BAITLY_BOOKING_UPSELL_MESSAGES: Record<
  SiteLanguage,
  BookingUpsellMessages
> = { fr, en, ar };
