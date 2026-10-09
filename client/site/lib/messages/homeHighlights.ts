import type { SiteLanguage } from '../siteLanguage';

type Highlights = {
  migration: {
    label: string; title: string; intro: string; link: string; note: string;
    steps: [string, string][];
  };
  connected: {
    label: string; title: string; intro: string; link: string;
    benefits: [string, string][];
  };
};

export const HOME_HIGHLIGHT_MESSAGES: Record<SiteLanguage, Highlights> = {
  fr: {
    migration: {
      label: 'Vous avez déjà un PMS ?',
      title: 'Changez de logiciel. Gardez le fil de votre activité.',
      intro: 'Vos réservations, vos voyageurs, votre historique : faites le point sur ce que vous pouvez récupérer avant de passer à Baitly.',
      link: 'Préparer ma migration',
      note: 'Et si vous quittez Baitly ? La réversibilité fait aussi partie du guide.',
      steps: [
        ['Identifiez les données à récupérer', 'Consultez les exports disponibles pour votre PMS actuel.'],
        ['Vérifiez les conditions de départ', 'Anticipez le préavis et la fin de vos accès.'],
        ['Préparez la reprise dans Baitly', 'Définissez le périmètre à partir de vos fichiers exportés.'],
      ],
    },
    connected: {
      label: 'Objets connectés',
      title: 'Votre logement veille. Vous gardez la main.',
      intro: 'Reliez vos équipements au séjour pour accueillir à distance et suivre les situations qui demandent votre attention.',
      link: 'Découvrir les objets connectés',
      benefits: [
        ['Des arrivées autonomes', 'Un code de serrure individuel, limité aux dates du séjour.'],
        ['Un voisinage préservé', 'Des alertes de bruit, sans enregistrer les conversations.'],
        ['Des accès à vérifier', 'Une caméra extérieure pour lever un doute sur l’entrée.'],
      ],
    },
  },
  en: {
    migration: {
      label: 'Already using a PMS?',
      title: 'Change your software. Keep your business history.',
      intro: 'Your bookings, guests and history: find out what you can recover before moving to Baitly.',
      link: 'Prepare my migration',
      note: 'Leaving Baitly later? The guide covers data portability too.',
      steps: [
        ['Identify the data to recover', 'Check the exports available from your current PMS.'],
        ['Check the exit conditions', 'Plan for notice periods and the end of your access.'],
        ['Prepare the move to Baitly', 'Define the scope using your exported files.'],
      ],
    },
    connected: {
      label: 'Connected devices',
      title: 'Your property stays alert. You stay in control.',
      intro: 'Connect your devices to each stay to welcome guests remotely and follow up on situations that need your attention.',
      link: 'Explore connected devices',
      benefits: [
        ['Independent arrivals', 'An individual lock code, valid only during the stay.'],
        ['Respect for neighbours', 'Noise alerts without recording conversations.'],
        ['Access you can check', 'An exterior camera to check a concern at the entrance.'],
      ],
    },
  },
  ar: {
    migration: {
      label: 'تستخدم نظام إدارة بالفعل؟',
      title: 'غيّر برنامجك واحتفظ بسجل نشاطك.',
      intro: 'حجوزاتك وضيوفك وسجلك: تعرّف على البيانات التي يمكنك استرجاعها قبل الانتقال إلى بيتلي.',
      link: 'التحضير للانتقال',
      note: 'وإذا غادرت بيتلي لاحقاً؟ يتناول الدليل أيضاً إمكانية استرجاع بياناتك.',
      steps: [
        ['حدد البيانات التي تحتاجها', 'اطلع على خيارات التصدير المتاحة في نظامك الحالي.'],
        ['تحقق من شروط المغادرة', 'خطط لمهلة الإشعار ونهاية صلاحية الوصول.'],
        ['حضّر الانتقال إلى بيتلي', 'حدد نطاق النقل بناءً على ملفاتك المصدّرة.'],
      ],
    },
    connected: {
      label: 'الأجهزة المتصلة',
      title: 'وحدتك تحت المتابعة والقرار يبقى بيدك.',
      intro: 'اربط أجهزتك بكل إقامة لاستقبال الضيوف عن بُعد ومتابعة المواقف التي تحتاج إلى انتباهك.',
      link: 'اكتشف الأجهزة المتصلة',
      benefits: [
        ['وصول مستقل', 'رمز قفل فردي صالح خلال فترة الإقامة فقط.'],
        ['راحة الجيران', 'تنبيهات ضوضاء دون تسجيل المحادثات.'],
        ['التحقق من الدخول', 'كاميرا خارجية للتحقق من تساؤل حول المدخل.'],
      ],
    },
  },
};
