import { FRANCE_ARABIC } from './france.ar';
import { MOROCCO_ARABIC } from './morocco.ar';
import { SAUDI_ARABIC } from './saudiArabia.ar';
import type { ArabicArticle } from './arabicTypes';
import type { LegalArticleSlug } from './articleImages';
import { LEGAL_SOURCES, type LegalArticle } from './types';

export const ARABIC_ARTICLES = {
  ...FRANCE_ARABIC,
  ...MOROCCO_ARABIC,
  ...SAUDI_ARABIC,
} satisfies Record<LegalArticleSlug, ArabicArticle>;

export const ARTICLE_LANGUAGES = ['fr', 'ar'] as const;
export const articleLanguage = (language: string): 'fr' | 'ar' =>
  language === 'ar' ? 'ar' : 'fr';

export function localizeArticle(
  article: LegalArticle,
  language: string,
): LegalArticle {
  if (language !== 'ar') return article;
  const {
    imageAlt: _imageAlt,
    sections,
    ...content
  } = ARABIC_ARTICLES[article.slug];
  return {
    ...article,
    ...content,
    sections: sections.map((section, index) => ({
      ...section,
      sources: article.sections[index].sources,
    })),
  };
}

export const ARABIC_SOURCE_LABELS: Record<string, string> = {
  maLaw: 'المغرب · القانون 80-14، المواد 29 إلى 38 و43 إلى 48',
  maPermit: 'المغرب · المرسوم 2-23-441، المواد 60 إلى 67',
  maGuests: 'المغرب · المرسوم 2-15-865، المواد 1 إلى 6 والملحق 1',
  maTax: 'الخزينة العامة للمملكة · القانون 47-06، المواد 70 إلى 76',
  frRegistration: 'ليجيفرانس · قانون السياحة، المادة L324-1-1',
  frDge: 'المديرية العامة للمقاولات · واجهة بيانات المساكن المفروشة والتسجيل',
  frHome: 'الخدمة العامة الفرنسية · تأجير السكن الرئيسي',
  frSecond: 'الخدمة العامة الفرنسية · تأجير السكن الثانوي',
  frDpe: 'ليجيفرانس · قانون البناء، المادة L631-10',
  frReform: 'ليجيفرانس · القانون 2024-1039، المواد 3 و8 و9',
  frMicro: 'ليجيفرانس · المدونة العامة للضرائب، المادة 50-0 (1 يوليو 2026)',
  frLmp: 'ليجيفرانس · المدونة العامة للضرائب، المادة 155 IV',
  frPolice: 'الخدمة العامة الفرنسية · استمارة الشرطة الفردية',
  frTax: 'الخدمة العامة الفرنسية للمقاولات · رسم الإقامة',
  saPrivate: 'أم القرى · لائحة وحدة الضيافة الخاصة، 11 سبتمبر 2026',
};

export const legalSourceLabel = (id: string, language: string) =>
  language === 'ar' ? ARABIC_SOURCE_LABELS[id] : LEGAL_SOURCES[id].label;
