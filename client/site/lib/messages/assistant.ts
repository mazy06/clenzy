import type { SiteLanguage } from '../siteLanguage';

/**
 * Conversation de la maquette d'assistant.
 *
 * <p>Les repliques portent leur emphase en clair : `<b>…</b>` est le seul
 * balisage admis, rendu par `richText`. Un traducteur lit une phrase, pas un
 * tableau de fragments — et le chiffre reste solidaire de sa phrase.</p>
 *
 * <p>Les montants suivent le marche de la langue : riyals en arabe, dirhams
 * en francais. Ce sont des exemples, pas des conversions.</p>
 */
export interface AssistantTurn {
  ask: string;
  answer: string;
  detail: string;
  hitl: { title: string; done: string; left?: string; right?: string };
  after?: string;
}

const fr = {
  windowTitle: 'app.baitly — Assistant',
  name: 'Assistant Baitly',
  tagline: 'Analyse, actions et réponses sur vos données',
  chips: ['Occupation août : 72 %', '2 propositions à valider', '3 arrivées demain'],
  applied: 'Validé',
  pending: 'En attente',
  apply: 'Appliquer',
  refuse: 'Refuser',
  writing: 'L’assistant rédige',
  placeholder: 'Demande une analyse, une action, un chiffre…',
  disclaimer: 'L’assistant agit sur vos tarifs après confirmation.',
  send: 'Envoyer',
  suggestions: ['Montre les nuits creuses', 'Prépare le digest du lundi', 'Compare à 2025'],
  /** Prix de la carte de rendement : avant, après, revenu estimé. */
  yield: { from: 1250, to: 1100, revenue: 6800 },
  perNight: '/nuit',
  estimatedRevenue: 'revenu estimé',
  turns: [
    {
      ask: 'Quel est mon taux d’occupation en août ?',
      answer:
        'Ton occupation d’août est à <b>72 %</b> (+6 pts vs juillet). Il reste 9 nuits creuses sur le Riad Yasmine entre le 18 et le 27 : une baisse ciblée de 12 % devrait les combler.',
      detail:
        'Dans le détail : 4 nuits en semaine, 5 sur les week-ends. Les biens comparables du quartier sont à <b>1 180 MAD</b> en moyenne sur la période — tu es 6 % au-dessus.',
      hitl: { title: 'Baisse −12 % · 18 → 27 août', done: 'Proposition appliquée' },
      after:
        'C’est fait — les 9 nuits sont à 1 100 MAD. Je te préviens dès la première réservation captée.',
    },
    {
      ask: 'Prépare le digest du lundi',
      answer:
        'Semaine 30 : <b>14 arrivées</b>, 11 départs, 2 avis reçus (4,6 ★). Un ménage reste à replanifier — Fatima est en congé lundi sur le Riad Kasbah.',
      detail:
        'À surveiller aussi : 3 arrivées après 20 h à préparer, et le stock de linge du Riad Yasmine passe sous le seuil jeudi.',
      hitl: {
        title: 'Réassigner le ménage · Riad Kasbah',
        done: 'Mission réassignée',
        left: 'Fatima Z. → <b>Samira B.</b>',
        right: 'lundi 10:00 · 2 h',
      },
      after:
        'Samira est notifiée sur WhatsApp, la check-list photo est déjà attachée à la mission.',
    },
    {
      ask: 'Réponds à l’avis 3★ de Julien',
      answer:
        'Julien reproche le bruit de la rue le samedi soir. Je propose une réponse publique qui reconnaît la gêne et mentionne les bouchons d’oreilles désormais fournis.',
      detail:
        'Brouillon : « Merci Julien pour ce retour honnête. Le bruit du samedi soir est réel — nous fournissons désormais des bouchons d’oreilles et proposons la chambre côté patio. »',
      hitl: {
        title: 'Publier la réponse à l’avis',
        done: 'Réponse publiée',
        left: 'Ton : <b>empathique</b>',
        right: 'FR · 412 signes',
      },
    },
  ] as readonly AssistantTurn[],
};

export type AssistantMessages = typeof fr;

const en: AssistantMessages = {
  windowTitle: 'app.baitly — Assistant',
  name: 'Baitly Assistant',
  tagline: 'Analysis, actions and answers on your own data',
  chips: ['August occupancy: 72%', '2 proposals to approve', '3 arrivals tomorrow'],
  applied: 'Approved',
  pending: 'Pending',
  apply: 'Apply',
  refuse: 'Decline',
  writing: 'The assistant is typing',
  placeholder: 'Ask for an analysis, an action, a figure…',
  disclaimer: 'The assistant changes your rates only after you confirm.',
  send: 'Send',
  suggestions: ['Show the empty nights', 'Prepare Monday’s digest', 'Compare with 2025'],
  yield: { from: 1250, to: 1100, revenue: 6800 },
  perNight: '/night',
  estimatedRevenue: 'estimated revenue',
  turns: [
    {
      ask: 'What is my occupancy in August?',
      answer:
        'Your August occupancy is <b>72%</b> (+6 pts vs July). Nine empty nights remain at Riad Yasmine between the 18th and the 27th: a targeted 12% cut should fill them.',
      detail:
        'In detail: four weeknights, five at weekends. Comparable properties in the area average <b>1,180 MAD</b> over the period — you are 6% above.',
      hitl: { title: 'Cut −12% · 18 → 27 August', done: 'Proposal applied' },
      after:
        'Done — the nine nights are at 1,100 MAD. I will tell you as soon as the first booking lands.',
    },
    {
      ask: 'Prepare Monday’s digest',
      answer:
        'Week 30: <b>14 arrivals</b>, 11 departures, 2 reviews received (4.6 ★). One cleaning still needs rescheduling — Fatima is off on Monday at Riad Kasbah.',
      detail:
        'Also worth watching: three arrivals after 20:00 to prepare, and Riad Yasmine’s linen stock drops below the threshold on Thursday.',
      hitl: {
        title: 'Reassign the cleaning · Riad Kasbah',
        done: 'Mission reassigned',
        left: 'Fatima Z. → <b>Samira B.</b>',
        right: 'Monday 10:00 · 2 h',
      },
      after: 'Samira is notified on WhatsApp, the photo checklist is already attached.',
    },
    {
      ask: 'Reply to Julien’s 3★ review',
      answer:
        'Julien complains about street noise on Saturday night. I suggest a public reply that acknowledges the nuisance and mentions the earplugs now provided.',
      detail:
        'Draft: “Thank you Julien for this honest feedback. Saturday night noise is real — we now provide earplugs and can offer the patio-side room.”',
      hitl: {
        title: 'Publish the review reply',
        done: 'Reply published',
        left: 'Tone: <b>empathetic</b>',
        right: 'FR · 412 characters',
      },
    },
  ],
};

const ar: AssistantMessages = {
  windowTitle: 'app.baitly — المساعد',
  name: 'مساعد بيتلي',
  tagline: 'تحليل وإجراءات وإجابات على بياناتك أنت',
  chips: ['إشغال أغسطس: 72 %', 'اقتراحان بانتظار المصادقة', '3 وصولات غداً'],
  applied: 'مُصادق عليه',
  pending: 'بانتظار المصادقة',
  apply: 'طبّق',
  refuse: 'ارفض',
  writing: 'المساعد يكتب',
  placeholder: 'اطلب تحليلاً أو إجراءً أو رقماً…',
  disclaimer: 'لا يغيّر المساعد أسعارك إلا بعد تأكيدك.',
  send: 'أرسل',
  suggestions: ['أظهر الليالي الفارغة', 'جهّز ملخّص الاثنين', 'قارن بعام 2025'],
  yield: { from: 470, to: 415, revenue: 2550 },
  perNight: '/ليلة',
  estimatedRevenue: 'الإيراد المقدَّر',
  turns: [
    {
      ask: 'كم نسبة إشغالي في أغسطس؟',
      answer:
        'إشغالك في أغسطس <b>72 %</b> (+6 نقاط عن يوليو). وتبقى تسع ليالٍ فارغة في رياض ياسمين بين 18 و27: خفض موجَّه بنسبة 12 % كفيل بملئها.',
      detail:
        'بالتفصيل: أربع ليالٍ في أيام الأسبوع، وخمس في نهاياته. والعقارات المماثلة في الحي عند <b>440 ر.س</b> وسطياً في الفترة — وأنت أعلى بـ6 %.',
      hitl: { title: 'خفض −12 % · 18 ← 27 أغسطس', done: 'طُبِّق الاقتراح' },
      after: 'تمّ — الليالي التسع عند 415 ر.س. سأخبرك فور التقاط أول حجز.',
    },
    {
      ask: 'جهّز ملخّص الاثنين',
      answer:
        'الأسبوع 30: <b>14 وصولاً</b>، و11 مغادرة، وتقييمان (4,6 ★). وتبقى عملية تنظيف بحاجة إلى إعادة جدولة — فاطمة في إجازة الاثنين في رياض القصبة.',
      detail:
        'ومما يستحق المتابعة: ثلاثة وصولات بعد الثامنة مساءً، ومخزون البياضات في رياض ياسمين ينزل تحت الحدّ يوم الخميس.',
      hitl: {
        title: 'إعادة إسناد التنظيف · رياض القصبة',
        done: 'أُعيد إسناد المهمة',
        left: 'فاطمة ز. ← <b>سميرة ب.</b>',
        right: 'الاثنين 10:00 · ساعتان',
      },
      after: 'أُشعرت سميرة على واتساب، وقائمة التحقق المصوّرة مرفقة بالمهمة.',
    },
    {
      ask: 'ردّ على تقييم جوليان بثلاث نجوم',
      answer:
        'يشتكي جوليان من ضجيج الشارع ليلة السبت. أقترح ردّاً علنياً يقرّ بالإزعاج ويذكر سدادات الأذن المتوفرة الآن.',
      detail:
        'مسوّدة: «شكراً جوليان على هذه الملاحظة الصادقة. ضجيج ليلة السبت حقيقي — ونحن نوفّر الآن سدادات أذن، ويمكننا عرض الغرفة المطلّة على الفناء.»',
      hitl: {
        title: 'نشر الرد على التقييم',
        done: 'نُشر الرد',
        left: 'النبرة: <b>متعاطفة</b>',
        right: 'بالفرنسية · 412 حرفاً',
      },
    },
  ],
};

export const ASSISTANT_MESSAGES: Record<SiteLanguage, AssistantMessages> = { fr, en, ar };
