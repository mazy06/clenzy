declare module 'virtual:baitly-site-metadata' {
  const pages: Record<'fr' | 'en' | 'ar', Record<string, { title: string; description: string; index: boolean }>>;
  export default pages;
}
