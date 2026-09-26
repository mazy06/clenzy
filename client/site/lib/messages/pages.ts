import type { SiteLanguage } from '../siteLanguage';
import { BAITLY_MIGRATION_MESSAGES } from './baitlyMigration';
import { BAITLY_READINESS_MESSAGES } from './baitlyReadiness';

/**
 * Textes propres aux pages secondaires de la landing.
 *
 * <p>Un dictionnaire par langue plutot que des cles plates : ces pages sont
 * de la copie commerciale, elle se relit en bloc. Les listes structurees
 * (modules, solutions, ressources, tarifs) vivent dans leurs propres
 * fichiers.</p>
 */
const fr = {
  solutions: {
    eyebrow: 'Solutions',
    title: 'Le même moteur. Votre façon de travailler.',
    intro:
      'Conciergerie, hôte indépendant, riad ou portefeuille multi-propriétaires : Baitly s’adapte au périmètre, aux rôles et à la réglementation de chacun.',
    cta: 'En parler avec nous',
  },
  resources: {
    eyebrow: 'Ressources',
    title: 'La donnée et le savoir-faire, en accès libre.',
    intro:
      'Baromètre de marché, calculateurs, guides réglementaires : ce que nous apprenons en opérant Baitly, nous le partageons.',
  },
  migration: BAITLY_MIGRATION_MESSAGES.fr,
  compare: BAITLY_READINESS_MESSAGES.fr.compare,
  demo: {
    eyebrow: 'Démo',
    title: 'Voyez Baitly tourner. En vrai.',
    intro:
      'Une démo guidée par un humain qui connaît le métier — pas un webinaire enregistré.',
    expectations: [
      '30 minutes, sur vos propres logements si vous le souhaitez',
      'En arabe, en français ou en anglais',
      'Vos questions de conformité traitées en direct',
      'Aucun engagement — et pas de relance harcelante',
    ],
    hurry: 'Pressé ?',
    whatsapp: 'Écrivez-nous sur WhatsApp',
    fields: {
      name: 'Votre nom',
      namePlaceholder: 'Salma Bennani',
      phone: 'Téléphone / WhatsApp',
      email: 'Email',
      size: 'Nombre de logements',
      tool: 'Outil actuel',
    },
    sizes: { s1: '1 à 4', s2: '5 à 20', s3: '21 à 50', s4: 'Plus de 50' },
    tools: { none: 'Extranets + Excel', other: 'Autre' },
    submit: 'Réserver ma démo',
    legal: 'Réponse sous 24 h ouvrées. Vos données restent chez Baitly.',
  },
  status: BAITLY_READINESS_MESSAGES.fr.status,
};

export type PageMessages = typeof fr;

const en: PageMessages = {
  solutions: {
    eyebrow: 'Solutions',
    title: 'The same engine. Your way of working.',
    intro:
      'Property manager, independent host, guesthouse or multi-owner portfolio: Baitly adapts to each one’s scope, roles and regulations.',
    cta: 'Talk it through with us',
  },
  resources: {
    eyebrow: 'Resources',
    title: 'The data and the know-how, openly.',
    intro:
      'Market barometer, calculators, regulatory guides: what we learn running Baitly, we share.',
  },
  migration: BAITLY_MIGRATION_MESSAGES.en,
  compare: BAITLY_READINESS_MESSAGES.en.compare,
  demo: {
    eyebrow: 'Demo',
    title: 'See Baitly run. For real.',
    intro: 'A demo guided by a human who knows the trade — not a recorded webinar.',
    expectations: [
      'Thirty minutes, on your own properties if you like',
      'In Arabic, French or English',
      'Your compliance questions answered live',
      'No commitment — and no pestering follow-ups',
    ],
    hurry: 'In a hurry?',
    whatsapp: 'Message us on WhatsApp',
    fields: {
      name: 'Your name',
      namePlaceholder: 'Salma Bennani',
      phone: 'Phone / WhatsApp',
      email: 'Email',
      size: 'Number of properties',
      tool: 'Current tool',
    },
    sizes: { s1: '1 to 4', s2: '5 to 20', s3: '21 to 50', s4: 'More than 50' },
    tools: { none: 'Extranets + Excel', other: 'Other' },
    submit: 'Book my demo',
    legal: 'Answer within one working day. Your data stays with Baitly.',
  },
  status: BAITLY_READINESS_MESSAGES.en.status,
};

const ar: PageMessages = {
  solutions: {
    eyebrow: 'الحلول',
    title: 'المحرّك نفسه. وطريقتك في العمل.',
    intro:
      'شركة إدارة، أو مضيف مستقل، أو دار ضيافة، أو محفظة متعددة الملّاك: يتكيّف بايتلي مع نطاق كلٍّ منها وأدوارها وأنظمتها.',
    cta: 'تحدّث إلينا',
  },
  resources: {
    eyebrow: 'الموارد',
    title: 'البيانات والخبرة، متاحة للجميع.',
    intro:
      'مؤشر السوق، والحاسبات، والأدلة التنظيمية: ما نتعلّمه من تشغيل بايتلي نشاركه معكم.',
  },
  migration: BAITLY_MIGRATION_MESSAGES.ar,
  compare: BAITLY_READINESS_MESSAGES.ar.compare,
  demo: {
    eyebrow: 'عرض توضيحي',
    title: 'شاهد بايتلي يعمل. على الحقيقة.',
    intro: 'عرض يقوده إنسان يعرف المهنة — لا ندوة مسجّلة.',
    expectations: [
      'ثلاثون دقيقة، على وحداتك أنت إن رغبت',
      'بالعربية أو الفرنسية أو الإنجليزية',
      'أسئلة الامتثال لديك تُجاب مباشرةً',
      'بلا أي التزام — وبلا متابعة مزعجة',
    ],
    hurry: 'على عجل؟',
    whatsapp: 'راسلنا على واتساب',
    fields: {
      name: 'اسمك',
      namePlaceholder: 'سلمى بناني',
      phone: 'الهاتف / واتساب',
      email: 'البريد الإلكتروني',
      size: 'عدد الوحدات',
      tool: 'الأداة الحالية',
    },
    sizes: { s1: 'من 1 إلى 4', s2: 'من 5 إلى 20', s3: 'من 21 إلى 50', s4: 'أكثر من 50' },
    tools: { none: 'لوحات المنصّات وإكسل', other: 'أخرى' },
    submit: 'احجز عرضي',
    legal: 'الرد خلال يوم عمل واحد. تبقى بياناتك لدى بايتلي.',
  },
  status: BAITLY_READINESS_MESSAGES.ar.status,
};

export const PAGE_MESSAGES: Record<SiteLanguage, PageMessages> = { fr, en, ar };
