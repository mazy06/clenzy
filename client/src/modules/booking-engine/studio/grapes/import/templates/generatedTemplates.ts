import type { GalleryTemplate } from '../galleryTemplates';
import { makeTemplate, type TplTheme, type TemplateSpec, type TplArchetype } from './templateFactory';

/**
 * Catalogue de templates GÉNÉRÉS par la fabrique (matrice thème × archétype, cf. `templateFactory`).
 * Ajouter un thème ci-dessous + une (ou plusieurs) entrée(s) dans SPECS suffit à étendre la galerie —
 * aucun HTML/CSS à réécrire. Les templates manuels (conciergerieMarrakech, villaBordDeMer, …) restent
 * référencés séparément dans `galleryTemplates`.
 */

const img = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=70`;

const SANS = "'Inter', system-ui, -apple-system, sans-serif";
const FRAUNCES = "'Fraunces', Georgia, serif";
const CORMORANT = "'Cormorant Garamond', Georgia, serif";
const IMPORT_FRAUNCES_INTER = "@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap');";
const IMPORT_INTER = "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');";
const IMPORT_CORMORANT_MANROPE = "@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Manrope:wght@400;500;600;700&display=swap');";

const THEMES: Record<string, TplTheme> = {
  // Appart urbain — minimal, slate/indigo, tout en Inter.
  urban: {
    id: 'urban', brand: 'Norvelle', primary: '#4f46e5', primaryDeep: '#4338ca',
    fonts: IMPORT_INTER, fontHeading: "'Inter', sans-serif", fontBody: SANS,
    ink: '#1e2235', body: '#4a4f63', muted: '#878ca0', bg: '#f7f8fb', surface: '#ffffff', soft: '#f0f1f8', line: '#e6e8f0',
    images: { hero: img('photo-1502672260266-1c1ef2d93688'), about: img('photo-1545324418-cc1a3fa10c00'), story: img('photo-1493809842364-78817add7ffb'), map: img('photo-1477959858617-67f85cf4f1df') },
    category: 'appartements', categoryCap: 'Appartements',
    eyebrow: 'Appartements & conciergerie · Ville',
    heroTitle: 'Des appartements en ville, réservés en quelques clics',
    heroSub: 'Adresses sélectionnées au cœur de la ville. Réservation directe, check-in fluide, conciergerie réactive.',
    contactEmail: 'bonjour@norvelle.co', contactPhone: '+33 1 84 00 00 00', contactAddress: 'Quartier central — Paris',
    footerTagline: 'Appartements et conciergerie urbaine. Réservation directe, séjours sans friction.',
  },
  // Boutique éditorial — noir/ivoire, Fraunces.
  noir: {
    id: 'noir', brand: 'Maison Noir', primary: '#1a1a1a', primaryDeep: '#000000',
    fonts: IMPORT_FRAUNCES_INTER, fontHeading: FRAUNCES, fontBody: SANS,
    ink: '#161412', body: '#4a463f', muted: '#8a857c', bg: '#faf8f4', surface: '#ffffff', soft: '#f1ede5', line: '#e6e0d6',
    images: { hero: img('photo-1618773928121-c32242e63f39'), about: img('photo-1631049307264-da0ec9d70304'), story: img('photo-1560448204-e02f11c3d0e2'), map: img('photo-1449824913935-59a10b8d2000') },
    category: 'demeures', categoryCap: 'Demeures',
    eyebrow: 'Demeures d\'exception · Collection privée',
    heroTitle: 'Une collection de demeures, choisies une à une',
    heroSub: 'Des lieux de caractère, loin des décors interchangeables. Réservation directe et conciergerie attentionnée.',
    contactEmail: 'contact@maisonnoir.com', contactPhone: '+33 1 53 00 00 00', contactAddress: 'Rive gauche — Paris',
    footerTagline: 'Demeures de caractère et conciergerie sur mesure.',
  },
  // Premium — charbon/champagne, Cormorant.
  gold: {
    id: 'gold', brand: 'Élysée', primary: '#b08d4f', primaryDeep: '#96763d',
    fonts: IMPORT_CORMORANT_MANROPE, fontHeading: CORMORANT, fontBody: "'Manrope', system-ui, sans-serif",
    ink: '#211f1c', body: '#54504a', muted: '#8a847a', bg: '#faf7f0', surface: '#ffffff', soft: '#f3eee3', line: '#e8e0d2',
    onPrimary: '#1b1916',
    images: { hero: img('photo-1611892440504-42a792e24d32'), about: img('photo-1582719478250-c89cae4dc85b'), story: img('photo-1578683010236-d716f9a3f461'), map: img('photo-1524231757912-21f4fe3a7200') },
    category: 'suites', categoryCap: 'Suites',
    eyebrow: 'Suites & conciergerie privée',
    heroTitle: 'L\'art du séjour, dans le moindre détail',
    heroSub: 'Des suites d\'exception et un service privé. Réservation directe, discrétion absolue.',
    contactEmail: 'concierge@elysee-suites.com', contactPhone: '+33 1 42 00 00 00', contactAddress: 'Triangle d\'or — Paris',
    footerTagline: 'Suites d\'exception et conciergerie privée.',
  },
  // Chalet — bois/crème, Fraunces.
  wood: {
    id: 'wood', brand: 'Altitude', primary: '#9a5b34', primaryDeep: '#824827',
    fonts: IMPORT_FRAUNCES_INTER, fontHeading: FRAUNCES, fontBody: SANS,
    ink: '#2a211a', body: '#574b41', muted: '#8d8175', bg: '#f8f3ec', surface: '#fffdf9', soft: '#f1e8db', line: '#e7dccb',
    images: { hero: img('photo-1551524559-8af4e6624178'), about: img('photo-1520250497591-112f2f40a3f4'), story: img('photo-1542718610-a1d656d1884c'), map: img('photo-1486870591958-9b9d0d1dda99') },
    category: 'chalets', categoryCap: 'Chalets',
    eyebrow: 'Chalets & conciergerie · Montagne',
    heroTitle: 'Des chalets au pied des pistes, réservés en direct',
    heroSub: 'Refuges chaleureux en altitude. Réservation directe, bois crépitant, conciergerie aux petits soins.',
    contactEmail: 'bonjour@altitude-chalets.com', contactPhone: '+33 4 79 00 00 00', contactAddress: 'Station village — Savoie',
    footerTagline: 'Chalets de montagne et conciergerie chaleureuse.',
  },
  // Éco / nature — vert profond/sable, Fraunces.
  forest: {
    id: 'forest', brand: 'Canopée', primary: '#2f6b4f', primaryDeep: '#235540',
    fonts: IMPORT_FRAUNCES_INTER, fontHeading: FRAUNCES, fontBody: SANS,
    ink: '#1c2a23', body: '#475a50', muted: '#7f8e84', bg: '#f6f5ee', surface: '#ffffff', soft: '#eef0e6', line: '#e2e4d6',
    images: { hero: img('photo-1449158743715-0a90ebb6d2d8'), about: img('photo-1518732714860-b62714ce0c59'), story: img('photo-1469474968028-56623f02e42e'), map: img('photo-1426604966848-d7adac402bff') },
    category: 'cabanes', categoryCap: 'Cabanes',
    eyebrow: 'Cabanes & écolodges · Nature',
    heroTitle: 'Des cabanes en pleine nature, à portée de clic',
    heroSub: 'Échappées au cœur du vivant. Réservation directe, empreinte légère, conciergerie passionnée.',
    contactEmail: 'bonjour@canopee-nature.com', contactPhone: '+33 5 56 00 00 00', contactAddress: 'Forêt domaniale — Gironde',
    footerTagline: 'Cabanes et écolodges en pleine nature.',
  },
  // Méditerranéen ensoleillé — orange chaud/crème, Fraunces (distinct du terracotta riad).
  sun: {
    id: 'sun', brand: 'Costa', primary: '#e07a39', primaryDeep: '#c4652a',
    fonts: IMPORT_FRAUNCES_INTER, fontHeading: FRAUNCES, fontBody: SANS,
    ink: '#2c211a', body: '#5a4c41', muted: '#8f8175', bg: '#fcf6ee', surface: '#ffffff', soft: '#f6ebdc', line: '#eaddca',
    images: { hero: img('photo-1613490493576-7fde63acd811'), about: img('photo-1564013799919-ab600027ffc6'), story: img('photo-1499793983690-e29da59ef1c2'), map: img('photo-1507525428034-b723cf961d3e') },
    category: 'villas', categoryCap: 'Villas',
    eyebrow: 'Villas & conciergerie · Soleil',
    heroTitle: 'Des villas baignées de soleil, réservées en direct',
    heroSub: 'Maisons lumineuses face à la mer. Réservation directe, art de vivre méditerranéen, conciergerie dévouée.',
    contactEmail: 'bonjour@costa-villas.com', contactPhone: '+33 4 93 00 00 00', contactAddress: 'Bord de mer — Côte d\'Azur',
    footerTagline: 'Villas ensoleillées et conciergerie méditerranéenne.',
  },
};

/** Croisements curés (thème × archétype) — chaque entrée = un template de la galerie.
 *  Matrice complète : 6 thèmes × 4 archétypes (overlay / split / catalogue / éditorial). */
const SPECS: TemplateSpec[] = [
  // Urbain (Norvelle)
  { id: 'skyline', name: 'Skyline', description: 'Appart urbain — hero immersif', theme: THEMES.urban, archetype: 'overlay' },
  { id: 'city-loft', name: 'City Loft', description: 'Appart urbain — hero split', theme: THEMES.urban, archetype: 'split' },
  { id: 'studio-urbain', name: 'Studio Urbain', description: 'Appart urbain — catalogue d\'abord', theme: THEMES.urban, archetype: 'catalogue' },
  { id: 'carnet-de-ville', name: 'Carnet de Ville', description: 'Appart urbain — éditorial', theme: THEMES.urban, archetype: 'editorial' },
  // Boutique noir (Maison Noir)
  { id: 'boutique-noir', name: 'Boutique Noir', description: 'Noir & ivoire — hero immersif', theme: THEMES.noir, archetype: 'overlay' },
  { id: 'demeure-privee', name: 'Demeure Privée', description: 'Noir & ivoire — hero split', theme: THEMES.noir, archetype: 'split' },
  { id: 'galerie-noire', name: 'Galerie Noire', description: 'Noir & ivoire — catalogue d\'abord', theme: THEMES.noir, archetype: 'catalogue' },
  { id: 'maison-noire', name: 'Maison Noire', description: 'Noir & ivoire — éditorial', theme: THEMES.noir, archetype: 'editorial' },
  // Premium or (Élysée)
  { id: 'suite-privee', name: 'Suite Privée', description: 'Charbon & champagne — hero immersif', theme: THEMES.gold, archetype: 'overlay' },
  { id: 'ecrin-dore', name: 'Écrin Doré', description: 'Charbon & champagne — hero split', theme: THEMES.gold, archetype: 'split' },
  { id: 'le-palace', name: 'Le Palace', description: 'Charbon & champagne — catalogue d\'abord', theme: THEMES.gold, archetype: 'catalogue' },
  { id: 'grand-hotel', name: 'Le Grand Hôtel', description: 'Charbon & champagne — éditorial', theme: THEMES.gold, archetype: 'editorial' },
  // Montagne (Altitude)
  { id: 'sommet', name: 'Sommet', description: 'Bois & crème — hero immersif', theme: THEMES.wood, archetype: 'overlay' },
  { id: 'chalet-alpin', name: 'Chalet Alpin', description: 'Bois & crème — hero split', theme: THEMES.wood, archetype: 'split' },
  { id: 'refuge', name: 'Refuge', description: 'Bois & crème — catalogue d\'abord', theme: THEMES.wood, archetype: 'catalogue' },
  { id: 'carnet-altitude', name: 'Carnet d\'Altitude', description: 'Bois & crème — éditorial', theme: THEMES.wood, archetype: 'editorial' },
  // Éco / nature (Canopée)
  { id: 'pleine-foret', name: 'Pleine Forêt', description: 'Vert & sable — hero immersif', theme: THEMES.forest, archetype: 'overlay' },
  { id: 'eco-lodge', name: 'Éco-Lodge', description: 'Vert & sable — hero split', theme: THEMES.forest, archetype: 'split' },
  { id: 'cabanes-nature', name: 'Cabanes Nature', description: 'Vert & sable — catalogue d\'abord', theme: THEMES.forest, archetype: 'catalogue' },
  { id: 'au-coeur-du-vivant', name: 'Au Cœur du Vivant', description: 'Vert & sable — éditorial', theme: THEMES.forest, archetype: 'editorial' },
  // Méditerranée soleil (Costa)
  { id: 'villa-soleil', name: 'Villa Soleil', description: 'Soleil & crème — hero immersif', theme: THEMES.sun, archetype: 'overlay' },
  { id: 'baie-doree', name: 'Baie Dorée', description: 'Soleil & crème — hero split', theme: THEMES.sun, archetype: 'split' },
  { id: 'riviera', name: 'Riviera', description: 'Soleil & crème — catalogue d\'abord', theme: THEMES.sun, archetype: 'catalogue' },
  { id: 'dolce-villa', name: 'Dolce Villa', description: 'Soleil & crème — éditorial', theme: THEMES.sun, archetype: 'editorial' },
];

// Décalage d'image par archétype : chaque thème a 4 images, on les fait PIVOTER selon l'archétype pour
// que les 4 templates d'un même thème aient un héros (et donc une vignette) DIFFÉRENT, au lieu de
// partager la même photo. Les 4 archétypes d'un thème → 4 ordres distincts → 4 héros distincts.
const ARCH_ROT: Record<TplArchetype, number> = { overlay: 0, split: 1, catalogue: 2, editorial: 3 };

/** Renvoie un clone du thème avec ses 4 images pivotées de `k` crans (hero/about/story/map réordonnés). */
function rotateImages(t: TplTheme, k: number): TplTheme {
  const pool = [t.images.hero, t.images.about, t.images.story, t.images.map];
  const n = pool.length;
  return {
    ...t,
    images: { hero: pool[k % n], about: pool[(k + 1) % n], story: pool[(k + 2) % n], map: pool[(k + 3) % n] },
  };
}

/** Catalogue généré, prêt à concaténer dans `GALLERY_TEMPLATES`. Images pivotées par archétype. */
export const GENERATED_TEMPLATES: GalleryTemplate[] = SPECS.map((s) =>
  makeTemplate({ ...s, theme: rotateImages(s.theme, ARCH_ROT[s.archetype]) }),
);
