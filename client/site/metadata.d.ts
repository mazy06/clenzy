declare module 'virtual:baitly-site-metadata' {
  const pages: Record<
    'fr' | 'en' | 'ar',
    Record<
      string,
      {
        title: string;
        description: string;
        index: boolean;
        image?: string;
        contentLanguage?: 'fr' | 'en' | 'ar';
        availableLanguages?: readonly ('fr' | 'en' | 'ar')[];
        structuredData?: Record<string, unknown>[];
        video?: import('./lib/academyStructuredData').AcademyVideoMetadata;
      }
    >
  >;
  export default pages;
}
