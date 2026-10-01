import type { PropertyStockItem } from '../../services/api/propertyStockApi';
import { STOCK_CATALOG_EXPANSION } from './stockCatalogExpansion';
import { createCatalogResolver, normalizeCatalogName, normalizeCatalogSearch } from './catalogMatching';

export type StockCategory = PropertyStockItem['category'];
export const STOCK_IMAGE_SHEETS = ['linen', 'kitchen-linen', 'toiletries', 'cleaning', 'consumables', 'laundry-dishes', 'drinks', 'beverages', 'breakfast', 'pantry', 'fresh-food', 'snacks', 'welcome-kits'] as const;
export const STOCK_FAMILIES = ['linen', 'toiletries', 'dishwashing', 'laundry', 'cleaning', 'household', 'hot-drinks', 'drinks', 'breakfast', 'pantry', 'fresh', 'snacks', 'kits', 'alcohol'] as const;
export type StockFamily = typeof STOCK_FAMILIES[number];
export type StockUse = 'welcome' | 'upsell';
export const STOCK_FAMILY_CATEGORIES: Record<StockFamily, StockCategory> = {
  linen: 'LINEN', toiletries: 'TOILETRIES', dishwashing: 'CLEANING', laundry: 'CLEANING', cleaning: 'CLEANING',
  household: 'CONSUMABLES', 'hot-drinks': 'CONSUMABLES', drinks: 'CONSUMABLES', breakfast: 'CONSUMABLES',
  pantry: 'CONSUMABLES', fresh: 'CONSUMABLES', snacks: 'CONSUMABLES', kits: 'CONSUMABLES', alcohol: 'CONSUMABLES',
};
export interface StockCatalogEntry {
  key: string;
  category: StockCategory;
  family: StockFamily;
  /** Suggestions de sélection uniquement : ne créent pas d'offre ni de prix. */
  uses?: StockUse[];
  names: { fr: string; en: string; ar: string };
  image: { sheet: typeof STOCK_IMAGE_SHEETS[number]; slot: number; grid?: 1 | 4 };
  aliases?: string[];
}
export const STOCK_CATEGORIES: StockCategory[] = ['LINEN', 'TOILETRIES', 'CLEANING', 'CONSUMABLES'];
export const CUSTOM_STOCK_KEY = 'custom';
/** Bibliothèque Baitly. Seules les variantes de format partagent une photo générique sans marque. */
export const STOCK_CATALOG: StockCatalogEntry[] = [
  {"key":"flat-sheet","category":"LINEN","names":{"fr":"Drap plat","en":"Flat sheet","ar":"ملاءة سرير مسطحة"},"image":{"sheet":"linen","slot":0},"aliases":["Drap","Bed sheet"],"family":"linen"},
  {"key":"fitted-sheet","category":"LINEN","names":{"fr":"Drap-housse","en":"Fitted sheet","ar":"ملاءة سرير مطاطية"},"image":{"sheet":"linen","slot":1},"aliases":["Draps housse","Drap house"],"family":"linen"},
  {"key":"duvet-cover","category":"LINEN","names":{"fr":"Housse de couette","en":"Duvet cover","ar":"غطاء لحاف"},"image":{"sheet":"linen","slot":2},"family":"linen"},
  {"key":"pillowcase","category":"LINEN","names":{"fr":"Taie d’oreiller","en":"Pillowcase","ar":"غطاء وسادة"},"image":{"sheet":"linen","slot":3},"family":"linen"},
  {"key":"square-pillow","category":"LINEN","names":{"fr":"Oreiller carré","en":"Square pillow","ar":"وسادة مربعة"},"image":{"sheet":"linen","slot":4},"family":"linen"},
  {"key":"rectangular-pillow","category":"LINEN","names":{"fr":"Oreiller rectangulaire","en":"Rectangular pillow","ar":"وسادة مستطيلة"},"image":{"sheet":"linen","slot":5},"family":"linen"},
  {"key":"duvet","category":"LINEN","names":{"fr":"Couette","en":"Duvet","ar":"لحاف"},"image":{"sheet":"linen","slot":6},"family":"linen"},
  {"key":"blanket","category":"LINEN","names":{"fr":"Couverture","en":"Blanket","ar":"بطانية"},"image":{"sheet":"linen","slot":7},"family":"linen"},
  {"key":"bath-towel","category":"LINEN","names":{"fr":"Drap de bain","en":"Bath towel","ar":"منشفة حمام كبيرة"},"image":{"sheet":"linen","slot":8},"aliases":["Serviette de bain"],"family":"linen"},
  {"key":"hand-towel","category":"LINEN","names":{"fr":"Serviette de toilette","en":"Hand towel","ar":"منشفة يد"},"image":{"sheet":"linen","slot":9},"family":"linen"},
  {"key":"bath-mat","category":"LINEN","names":{"fr":"Tapis de bain","en":"Bath mat","ar":"حصيرة حمام"},"image":{"sheet":"linen","slot":10},"family":"linen"},
  {"key":"bathrobe","category":"LINEN","names":{"fr":"Peignoir","en":"Bathrobe","ar":"رداء حمام"},"image":{"sheet":"linen","slot":11},"family":"linen"},
  {"key":"slippers","category":"LINEN","names":{"fr":"Chaussons","en":"Slippers","ar":"نعال"},"image":{"sheet":"linen","slot":12},"family":"linen"},
  {"key":"washcloth","category":"LINEN","names":{"fr":"Gant de toilette","en":"Washcloth","ar":"منشفة صغيرة"},"image":{"sheet":"linen","slot":13},"family":"linen"},
  {"key":"tablecloth","category":"LINEN","names":{"fr":"Nappe","en":"Tablecloth","ar":"مفرش طاولة"},"image":{"sheet":"linen","slot":14},"family":"linen"},
  {"key":"napkins","category":"LINEN","names":{"fr":"Serviettes de table","en":"Table napkins","ar":"مناديل مائدة"},"image":{"sheet":"linen","slot":15},"family":"linen"},
  {"key":"kitchen-towel","category":"LINEN","names":{"fr":"Torchon de cuisine","en":"Kitchen tea towel","ar":"فوطة مطبخ قطنية"},"image":{"sheet":"kitchen-linen","slot":0,"grid":1},"aliases":["Torchon","Torchons à vaisselle","Linge à vaisselle","Essuie-vaisselle","Essuie de cuisine","Serviette de cuisine","Tea towel","Dish towel","Cotton kitchen towel","فوطة مطبخ","منشفة مطبخ"],"family":"linen"},
  {"key":"fitted-sheet-90","category":"LINEN","names":{"fr":"Drap-housse 90 × 200","en":"Fitted sheet 90 × 200","ar":"ملاءة مطاطية 90 × 200"},"image":{"sheet":"linen","slot":1},"aliases":["Draps housse 90"],"family":"linen"},
  {"key":"fitted-sheet-140","category":"LINEN","names":{"fr":"Drap-housse 140 × 200","en":"Fitted sheet 140 × 200","ar":"ملاءة مطاطية 140 × 200"},"image":{"sheet":"linen","slot":1},"aliases":["Draps housse 140"],"family":"linen"},
  {"key":"fitted-sheet-160","category":"LINEN","names":{"fr":"Drap-housse 160 × 200","en":"Fitted sheet 160 × 200","ar":"ملاءة مطاطية 160 × 200"},"image":{"sheet":"linen","slot":1},"aliases":["Draps housse 160"],"family":"linen"},
  {"key":"fitted-sheet-180","category":"LINEN","names":{"fr":"Drap-housse 180 × 200","en":"Fitted sheet 180 × 200","ar":"ملاءة مطاطية 180 × 200"},"image":{"sheet":"linen","slot":1},"aliases":["Draps housse 180"],"family":"linen"},
  {"key":"duvet-cover-140","category":"LINEN","names":{"fr":"Housse de couette 140 × 200","en":"Duvet cover 140 × 200","ar":"غطاء لحاف 140 × 200"},"image":{"sheet":"linen","slot":2},"family":"linen"},
  {"key":"duvet-cover-240","category":"LINEN","names":{"fr":"Housse de couette 240 × 220","en":"Duvet cover 240 × 220","ar":"غطاء لحاف 240 × 220"},"image":{"sheet":"linen","slot":2},"family":"linen"},
  {"key":"pillowcase-65","category":"LINEN","names":{"fr":"Taie d’oreiller 65 × 65","en":"Pillowcase 65 × 65","ar":"غطاء وسادة 65 × 65"},"image":{"sheet":"linen","slot":3},"family":"linen"},
  {"key":"pillowcase-50","category":"LINEN","names":{"fr":"Taie d’oreiller 50 × 70","en":"Pillowcase 50 × 70","ar":"غطاء وسادة 50 × 70"},"image":{"sheet":"linen","slot":3},"family":"linen"},
  {"key":"hand-soap","category":"TOILETRIES","names":{"fr":"Savon mains","en":"Hand soap","ar":"صابون يدين"},"image":{"sheet":"toiletries","slot":0},"aliases":["Savon liquide","Savon pour les mains"],"family":"toiletries","uses":["welcome"]},
  {"key":"shower-gel","category":"TOILETRIES","names":{"fr":"Gel douche","en":"Shower gel","ar":"جل استحمام"},"image":{"sheet":"toiletries","slot":1},"family":"toiletries","uses":["welcome"]},
  {"key":"shampoo","category":"TOILETRIES","names":{"fr":"Shampoing","en":"Shampoo","ar":"شامبو"},"image":{"sheet":"toiletries","slot":2},"aliases":["Shampooing"],"family":"toiletries","uses":["welcome"]},
  {"key":"conditioner","category":"TOILETRIES","names":{"fr":"Après-shampoing","en":"Conditioner","ar":"بلسم شعر"},"image":{"sheet":"toiletries","slot":3},"family":"toiletries","uses":["welcome"]},
  {"key":"body-lotion","category":"TOILETRIES","names":{"fr":"Lait pour le corps","en":"Body lotion","ar":"لوشن للجسم"},"image":{"sheet":"toiletries","slot":4},"family":"toiletries","uses":["welcome"]},
  {"key":"soap-bar","category":"TOILETRIES","names":{"fr":"Savonnette","en":"Soap bar","ar":"قطعة صابون"},"image":{"sheet":"toiletries","slot":5},"aliases":["Savon solide"],"family":"toiletries","uses":["welcome"]},
  {"key":"toilet-paper","category":"TOILETRIES","names":{"fr":"Papier toilette","en":"Toilet paper","ar":"ورق مرحاض"},"image":{"sheet":"toiletries","slot":6},"family":"toiletries","uses":["welcome"]},
  {"key":"tissues","category":"TOILETRIES","names":{"fr":"Mouchoirs","en":"Tissues","ar":"مناديل ورقية"},"image":{"sheet":"toiletries","slot":7},"family":"toiletries","uses":["welcome"]},
  {"key":"toothbrush","category":"TOILETRIES","names":{"fr":"Brosse à dents","en":"Toothbrush","ar":"فرشاة أسنان"},"image":{"sheet":"toiletries","slot":8},"family":"toiletries","uses":["welcome"]},
  {"key":"toothpaste","category":"TOILETRIES","names":{"fr":"Dentifrice","en":"Toothpaste","ar":"معجون أسنان"},"image":{"sheet":"toiletries","slot":9},"family":"toiletries","uses":["welcome"]},
  {"key":"razor","category":"TOILETRIES","names":{"fr":"Rasoir","en":"Razor","ar":"شفرة حلاقة"},"image":{"sheet":"toiletries","slot":10},"family":"toiletries","uses":["welcome"]},
  {"key":"shaving-foam","category":"TOILETRIES","names":{"fr":"Mousse à raser","en":"Shaving foam","ar":"رغوة حلاقة"},"image":{"sheet":"toiletries","slot":11},"family":"toiletries","uses":["welcome"]},
  {"key":"cotton-pads","category":"TOILETRIES","names":{"fr":"Disques de coton","en":"Cotton pads","ar":"أقراص قطن"},"image":{"sheet":"toiletries","slot":12},"family":"toiletries","uses":["welcome"]},
  {"key":"cotton-swabs","category":"TOILETRIES","names":{"fr":"Cotons-tiges","en":"Cotton swabs","ar":"أعواد قطن"},"image":{"sheet":"toiletries","slot":13},"family":"toiletries","uses":["welcome"]},
  {"key":"shower-cap","category":"TOILETRIES","names":{"fr":"Bonnet de douche","en":"Shower cap","ar":"قبعة استحمام"},"image":{"sheet":"toiletries","slot":14},"family":"toiletries","uses":["welcome"]},
  {"key":"comb","category":"TOILETRIES","names":{"fr":"Peigne","en":"Comb","ar":"مشط"},"image":{"sheet":"toiletries","slot":15},"family":"toiletries","uses":["welcome"]},
  {"key":"shower-gel-30","category":"TOILETRIES","names":{"fr":"Gel douche 30 ml","en":"Shower gel 30 ml","ar":"جل استحمام 30 مل"},"image":{"sheet":"toiletries","slot":1},"family":"toiletries","uses":["welcome"]},
  {"key":"shower-gel-300","category":"TOILETRIES","names":{"fr":"Gel douche 300 ml","en":"Shower gel 300 ml","ar":"جل استحمام 300 مل"},"image":{"sheet":"toiletries","slot":1},"aliases":["Gel douche 300ml"],"family":"toiletries","uses":["welcome"]},
  {"key":"shampoo-30","category":"TOILETRIES","names":{"fr":"Shampoing 30 ml","en":"Shampoo 30 ml","ar":"شامبو 30 مل"},"image":{"sheet":"toiletries","slot":2},"aliases":["Shampooing 30ml"],"family":"toiletries","uses":["welcome"]},
  {"key":"shampoo-300","category":"TOILETRIES","names":{"fr":"Shampoing 300 ml","en":"Shampoo 300 ml","ar":"شامبو 300 مل"},"image":{"sheet":"toiletries","slot":2},"aliases":["Shampooing 300ml"],"family":"toiletries","uses":["welcome"]},
  {"key":"conditioner-30","category":"TOILETRIES","names":{"fr":"Après-shampoing 30 ml","en":"Conditioner 30 ml","ar":"بلسم شعر 30 مل"},"image":{"sheet":"toiletries","slot":3},"family":"toiletries","uses":["welcome"]},
  {"key":"body-lotion-30","category":"TOILETRIES","names":{"fr":"Lait pour le corps 30 ml","en":"Body lotion 30 ml","ar":"لوشن للجسم 30 مل"},"image":{"sheet":"toiletries","slot":4},"family":"toiletries","uses":["welcome"]},
  {"key":"hand-soap-300","category":"TOILETRIES","names":{"fr":"Savon mains 300 ml","en":"Hand soap 300 ml","ar":"صابون يدين 300 مل"},"image":{"sheet":"toiletries","slot":0},"family":"toiletries","uses":["welcome"]},
  {"key":"soap-bar-20","category":"TOILETRIES","names":{"fr":"Savonnette 20 g","en":"Soap bar 20 g","ar":"قطعة صابون 20 غ"},"image":{"sheet":"toiletries","slot":5},"family":"toiletries","uses":["welcome"]},
  {"key":"dish-soap","category":"CLEANING","names":{"fr":"Liquide vaisselle","en":"Dishwashing liquid","ar":"سائل غسل الصحون"},"image":{"sheet":"cleaning","slot":0},"family":"dishwashing"},
  {"key":"dishwasher-tablets","category":"CLEANING","names":{"fr":"Pastilles lave-vaisselle","en":"Dishwasher tablets","ar":"أقراص غسالة الصحون"},"image":{"sheet":"laundry-dishes","slot":0},"aliases":["Tablettes lave-vaisselle","Pastille vaisselle","Tablette vaisselle"],"family":"dishwashing"},
  {"key":"laundry-detergent","category":"CLEANING","names":{"fr":"Lessive liquide","en":"Liquid laundry detergent","ar":"منظف غسيل سائل"},"image":{"sheet":"cleaning","slot":2},"family":"laundry"},
  {"key":"fabric-softener","category":"CLEANING","names":{"fr":"Adoucissant","en":"Fabric softener","ar":"منعم أقمشة"},"image":{"sheet":"cleaning","slot":3},"family":"laundry"},
  {"key":"surface-cleaner","category":"CLEANING","names":{"fr":"Nettoyant multi-surfaces","en":"Multi-surface cleaner","ar":"منظف متعدد الأسطح"},"image":{"sheet":"cleaning","slot":4},"family":"cleaning"},
  {"key":"glass-cleaner","category":"CLEANING","names":{"fr":"Nettoyant vitres","en":"Glass cleaner","ar":"منظف زجاج"},"image":{"sheet":"cleaning","slot":5},"family":"cleaning"},
  {"key":"toilet-cleaner","category":"CLEANING","names":{"fr":"Gel WC","en":"Toilet cleaner","ar":"منظف مرحاض"},"image":{"sheet":"cleaning","slot":6},"family":"cleaning"},
  {"key":"disinfectant","category":"CLEANING","names":{"fr":"Désinfectant","en":"Disinfectant","ar":"مطهر"},"image":{"sheet":"cleaning","slot":7},"family":"cleaning"},
  {"key":"descaler","category":"CLEANING","names":{"fr":"Détartrant","en":"Limescale remover","ar":"مزيل تكلس"},"image":{"sheet":"cleaning","slot":8},"family":"cleaning"},
  {"key":"sponges","category":"CLEANING","names":{"fr":"Éponges","en":"Sponges","ar":"إسفنج"},"image":{"sheet":"cleaning","slot":9},"family":"cleaning"},
  {"key":"microfiber-cloth","category":"CLEANING","names":{"fr":"Chiffon microfibre","en":"Microfiber cloth","ar":"قطعة قماش مايكروفايبر"},"image":{"sheet":"cleaning","slot":10},"family":"cleaning"},
  {"key":"cleaning-gloves","category":"CLEANING","names":{"fr":"Gants de ménage","en":"Cleaning gloves","ar":"قفازات تنظيف"},"image":{"sheet":"cleaning","slot":11},"family":"cleaning"},
  {"key":"bin-bags","category":"CLEANING","names":{"fr":"Sacs poubelle","en":"Bin bags","ar":"أكياس نفايات"},"image":{"sheet":"cleaning","slot":12},"family":"cleaning"},
  {"key":"mop-refill","category":"CLEANING","names":{"fr":"Recharge de serpillière","en":"Mop refill","ar":"رأس ممسحة بديل"},"image":{"sheet":"cleaning","slot":13},"family":"cleaning"},
  {"key":"dustpan-brush","category":"CLEANING","names":{"fr":"Pelle et balayette","en":"Dustpan and brush","ar":"جاروف وفرشاة"},"image":{"sheet":"cleaning","slot":14},"family":"cleaning"},
  {"key":"cleaning-wipes","category":"CLEANING","names":{"fr":"Lingettes nettoyantes","en":"Cleaning wipes","ar":"مناديل تنظيف"},"image":{"sheet":"cleaning","slot":15},"family":"cleaning"},
  {"key":"dish-soap-500","category":"CLEANING","names":{"fr":"Liquide vaisselle 500 ml","en":"Dishwashing liquid 500 ml","ar":"سائل صحون 500 مل"},"image":{"sheet":"cleaning","slot":0},"family":"dishwashing"},
  {"key":"dish-soap-1l","category":"CLEANING","names":{"fr":"Liquide vaisselle 1 L","en":"Dishwashing liquid 1 L","ar":"سائل صحون 1 لتر"},"image":{"sheet":"cleaning","slot":0},"family":"dishwashing"},
  {"key":"laundry-detergent-1l","category":"CLEANING","names":{"fr":"Lessive liquide 1 L","en":"Laundry detergent 1 L","ar":"منظف غسيل 1 لتر"},"image":{"sheet":"cleaning","slot":2},"family":"laundry"},
  {"key":"surface-cleaner-750","category":"CLEANING","names":{"fr":"Nettoyant multi-surfaces 750 ml","en":"Surface cleaner 750 ml","ar":"منظف أسطح 750 مل"},"image":{"sheet":"cleaning","slot":4},"family":"cleaning"},
  {"key":"glass-cleaner-750","category":"CLEANING","names":{"fr":"Nettoyant vitres 750 ml","en":"Glass cleaner 750 ml","ar":"منظف زجاج 750 مل"},"image":{"sheet":"cleaning","slot":5},"family":"cleaning"},
  {"key":"bin-bags-10","category":"CLEANING","names":{"fr":"Sacs poubelle 10 L","en":"Bin bags 10 L","ar":"أكياس نفايات 10 لتر"},"image":{"sheet":"cleaning","slot":12},"family":"cleaning"},
  {"key":"bin-bags-30","category":"CLEANING","names":{"fr":"Sacs poubelle 30 L","en":"Bin bags 30 L","ar":"أكياس نفايات 30 لتر"},"image":{"sheet":"cleaning","slot":12},"family":"cleaning"},
  {"key":"bin-bags-50","category":"CLEANING","names":{"fr":"Sacs poubelle 50 L","en":"Bin bags 50 L","ar":"أكياس نفايات 50 لتر"},"image":{"sheet":"cleaning","slot":12},"family":"cleaning"},
  {"key":"coffee-capsules","category":"CONSUMABLES","names":{"fr":"Capsules de café","en":"Coffee capsules","ar":"كبسولات قهوة"},"image":{"sheet":"consumables","slot":0},"aliases":["Capsules cafe","Capsules café"],"family":"hot-drinks","uses":["welcome","upsell"]},
  {"key":"coffee-pods","category":"CONSUMABLES","names":{"fr":"Dosettes de café","en":"Coffee pods","ar":"أقراص قهوة"},"image":{"sheet":"consumables","slot":1},"family":"hot-drinks","uses":["welcome","upsell"]},
  {"key":"ground-coffee","category":"CONSUMABLES","names":{"fr":"Café moulu","en":"Ground coffee","ar":"قهوة مطحونة"},"image":{"sheet":"consumables","slot":2},"family":"hot-drinks","uses":["welcome","upsell"]},
  {"key":"tea","category":"CONSUMABLES","names":{"fr":"Sachets de thé","en":"Tea bags","ar":"أكياس شاي"},"image":{"sheet":"consumables","slot":3},"aliases":["Thé","Sachets de the"],"family":"hot-drinks","uses":["welcome","upsell"]},
  {"key":"sugar","category":"CONSUMABLES","names":{"fr":"Sucre en sachets","en":"Sugar sachets","ar":"أكياس سكر"},"image":{"sheet":"consumables","slot":4},"aliases":["Sucre en dosettes","Dosettes de sucre","Sucre individuel","Sucre en portions","Sucre en sticks","Sticks de sucre","Sachets de sucre","Sugar packets","Sugar sticks","Sucre blanc en dosettes","Sucre blanc en sachets"],"family":"breakfast","uses":["welcome","upsell"]},
  {"key":"salt-pepper","category":"CONSUMABLES","names":{"fr":"Sel et poivre","en":"Salt and pepper","ar":"ملح وفلفل"},"image":{"sheet":"consumables","slot":5},"family":"pantry","uses":["welcome","upsell"]},
  {"key":"water","category":"CONSUMABLES","names":{"fr":"Eau plate","en":"Still water","ar":"مياه"},"image":{"sheet":"consumables","slot":6},"aliases":["Bouteille d’eau","Bouteille d’eau plate"],"family":"drinks","uses":["welcome","upsell"]},
  {"key":"milk","category":"CONSUMABLES","names":{"fr":"Lait","en":"Milk","ar":"حليب"},"image":{"sheet":"consumables","slot":7},"family":"breakfast","uses":["welcome","upsell"]},
  {"key":"biscuits","category":"CONSUMABLES","names":{"fr":"Biscuits d’accueil","en":"Welcome biscuits","ar":"بسكويت للضيافة"},"image":{"sheet":"consumables","slot":8},"family":"snacks","uses":["welcome","upsell"]},
  {"key":"kitchen-paper","category":"CONSUMABLES","names":{"fr":"Essuie-tout","en":"Kitchen paper","ar":"ورق مطبخ"},"image":{"sheet":"consumables","slot":9},"family":"household"},
  {"key":"aluminium-foil","category":"CONSUMABLES","names":{"fr":"Papier aluminium","en":"Aluminium foil","ar":"ورق ألمنيوم"},"image":{"sheet":"consumables","slot":10},"family":"household"},
  {"key":"cling-film","category":"CONSUMABLES","names":{"fr":"Film alimentaire","en":"Cling film","ar":"نايلون تغليف الطعام"},"image":{"sheet":"consumables","slot":11},"family":"household"},
  {"key":"freezer-bags","category":"CONSUMABLES","names":{"fr":"Sacs congélation","en":"Freezer bags","ar":"أكياس تجميد"},"image":{"sheet":"consumables","slot":12},"family":"household"},
  {"key":"matches","category":"CONSUMABLES","names":{"fr":"Allumettes","en":"Matches","ar":"أعواد ثقاب"},"image":{"sheet":"consumables","slot":13},"family":"household"},
  {"key":"batteries-aa","category":"CONSUMABLES","names":{"fr":"Piles AA","en":"AA batteries","ar":"بطاريات AA"},"image":{"sheet":"consumables","slot":14},"family":"household"},
  {"key":"coffee-decaf","category":"CONSUMABLES","names":{"fr":"Capsules de café décaféiné","en":"Decaf coffee capsules","ar":"كبسولات قهوة منزوعة الكافيين"},"image":{"sheet":"consumables","slot":0},"family":"hot-drinks","uses":["welcome","upsell"]},
  {"key":"tea-green","category":"CONSUMABLES","names":{"fr":"Thé vert","en":"Green tea","ar":"شاي أخضر"},"image":{"sheet":"consumables","slot":3},"family":"hot-drinks","uses":["welcome","upsell"]},
  {"key":"tea-black","category":"CONSUMABLES","names":{"fr":"Thé noir","en":"Black tea","ar":"شاي أسود"},"image":{"sheet":"consumables","slot":3},"family":"hot-drinks","uses":["welcome","upsell"]},
  {"key":"herbal-tea","category":"CONSUMABLES","names":{"fr":"Tisanes","en":"Herbal tea","ar":"أعشاب للشرب"},"image":{"sheet":"consumables","slot":3},"family":"hot-drinks","uses":["welcome","upsell"]},
  {"key":"brown-sugar","category":"CONSUMABLES","names":{"fr":"Sucre roux en sachets","en":"Brown sugar sachets","ar":"أكياس سكر بني"},"image":{"sheet":"consumables","slot":4},"aliases":["Sucre roux en dosettes","Dosettes de sucre roux","Sucre roux en sticks","Sticks de sucre roux","Sachets de sucre roux","Brown sugar packets"],"family":"breakfast","uses":["welcome","upsell"]},
  {"key":"water-500","category":"CONSUMABLES","names":{"fr":"Eau plate 50 cl","en":"Still water 500 ml","ar":"مياه 500 مل"},"image":{"sheet":"consumables","slot":6},"aliases":["Bouteille d’eau 50 cl","Bouteille d’eau plate 50 cl","Bouteille d’eau 500 ml","Eau 50 cl","Eau 500 ml"],"family":"drinks","uses":["welcome","upsell"]},
  {"key":"water-1l","category":"CONSUMABLES","names":{"fr":"Eau plate 1 L","en":"Still water 1 L","ar":"مياه 1 لتر"},"image":{"sheet":"consumables","slot":6},"aliases":["Bouteille d’eau 1 L","Bouteille d’eau plate 1 L","Eau 1 L"],"family":"drinks","uses":["welcome","upsell"]},
  {"key":"milk-250","category":"CONSUMABLES","names":{"fr":"Lait 25 cl","en":"Milk 250 ml","ar":"حليب 250 مل"},"image":{"sheet":"consumables","slot":7},"family":"breakfast","uses":["welcome","upsell"]},
  {"key":"batteries-aaa","category":"CONSUMABLES","names":{"fr":"Piles AAA","en":"AAA batteries","ar":"بطاريات AAA"},"image":{"sheet":"consumables","slot":14},"family":"household"},
  ...STOCK_CATALOG_EXPANSION,
];

export function stockCatalogName(item: StockCatalogEntry, language: string): string {
  return item.names[language.startsWith('ar') ? 'ar' : language.startsWith('en') ? 'en' : 'fr'];
}

export const normalizeStockSearch = normalizeCatalogSearch;

const useKeywords: Record<StockUse, string> = {
  welcome: 'accueil welcome ترحيب',
  upsell: 'upsell vente supplément minibar بيع إضافي',
};
// Index construit une seule fois, y compris les formes françaises avec ou sans ligature.
const searchIndex = new Map(STOCK_CATALOG.map(item => [item.key, normalizeCatalogName([
  ...Object.values(item.names), ...(item.aliases ?? []), ...(item.uses ?? []).map(use => useKeywords[use]),
].join(' '))]));

export function searchStockCatalog(query: string, category?: StockCategory, filters: { family?: StockFamily; use?: StockUse } = {}): StockCatalogEntry[] {
  const words = normalizeCatalogName(query).split(' ').filter(Boolean);
  return STOCK_CATALOG.filter(item => (!category || item.category === category)
    && (!filters.family || item.family === filters.family)
    && (!filters.use || item.uses?.includes(filters.use))
    && words.every(word => searchIndex.get(item.key)!.includes(word)));
}

/** Référence explicite, puis nom reconnu (y compris les articles libres), sans mutation. */
export const resolveStockCatalog = createCatalogResolver(STOCK_CATALOG);
