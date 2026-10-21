import type { GalleryTemplate, TemplatePage } from './galleryTemplates';
import { baitlyComposite, BAITLY_JOURNEY_COMPOSITE_CSS, type BaitlyBookingJourneyId } from '../baitlyJourneyComposites';
import siteCss from './baitlyJourneyTemplates.css?raw';
import coastPhoto from '../../../../../assets/booking-hospitality/baitly-coast.jpg';
import suitePhoto from '../../../../../assets/booking-hospitality/baitly-suite.jpg';
import diningPhoto from '../../../../../assets/booking-hospitality/baitly-dining.jpg';
import heritagePhoto from '../../../../../assets/booking-hospitality/baitly-heritage.jpg';
import hospitalityCss from './baitlyHospitality.css?raw';
import hospitalityFont from '../../../../../../site/assets/fonts/manrope-regular.ttf';
import hospitalityBoldFont from '../../../../../../site/assets/fonts/manrope-bold.ttf';
import { buildHospitalitySections, type HospitalityDirection } from './baitlyHospitalitySections';
import { API_CONFIG } from '../../../../../config/api';
import { WIDGET_SKIN_CSS } from '../../../sdk/styles/widgetSkin';
import { buildBaitlyPropertyDetail } from './baitlyPropertyDetails';
import { baitlyTemplateLogoMarkup, BAITLY_TEMPLATE_LOGO_CSS } from "./baitlyTemplateLogos";
import propertyDetailsCss from './baitlyPropertyDetails.css?raw';

interface Definition {
  id: string; name: string; journeyId: BaitlyBookingJourneyId;
  hero: 'panorama' | 'split' | 'poster' | 'mosaic' | 'compact' | 'receipt';
  layout: 'garden' | 'urban' | 'retreat' | 'coast' | 'direct' | 'letter';
  color: string; background: string; surface: string; ink: string; heading: string;
}
const serif = 'Georgia, serif';
const sans = '"Baitly Hospitality", Arial, sans-serif';
const DEFINITIONS: Definition[] = [
  { id:'atlas',name:'Atlas Collection',journeyId:'catalogue',hero:'panorama',layout:'garden',color:'#345443',background:'#f3f2e9',surface:'#fbfcf7',ink:'#263b30',heading:serif },
  { id:'horizon',name:'Horizon',journeyId:'catalogue',hero:'split',layout:'urban',color:'#284c64',background:'#eef3f5',surface:'#f9fcfd',ink:'#203a4b',heading:sans },
  { id:'maison',name:'Maison privée',journeyId:'single',hero:'poster',layout:'garden',color:'#8c4c31',background:'#f5f0e7',surface:'#fcfaf4',ink:'#42352a',heading:serif },
  { id:'patio',name:'Patio',journeyId:'single',hero:'mosaic',layout:'retreat',color:'#4e5e39',background:'#eff1e7',surface:'#f9fbf3',ink:'#303d2a',heading:serif },
  { id:'retraite',name:'Retraite',journeyId:'inquiry',hero:'split',layout:'retreat',color:'#5d453f',background:'#f3ede7',surface:'#fcf8f3',ink:'#3d3530',heading:serif },
  { id:'pavillon',name:'Pavillon',journeyId:'inquiry',hero:'poster',layout:'urban',color:'#324f61',background:'#edf1f3',surface:'#f8fbfc',ink:'#263c48',heading:sans },
  { id:'rivage',name:'Rivage',journeyId:'extras',hero:'panorama',layout:'coast',color:'#265c6b',background:'#edf3f2',surface:'#f7fcfa',ink:'#234149',heading:serif },
  { id:'escale',name:'Les beaux jours',journeyId:'extras',hero:'mosaic',layout:'garden',color:'#975033',background:'#f8efe6',surface:'#fff9f2',ink:'#49382c',heading:serif },
  { id:'itinerance',name:'Itinérance',journeyId:'cart',hero:'split',layout:'urban',color:'#344b74',background:'#edf1f7',surface:'#f9fbfd',ink:'#293a52',heading:sans },
  { id:'destinations',name:'Destinations',journeyId:'cart',hero:'panorama',layout:'coast',color:'#5c4d35',background:'#f4f1e8',surface:'#fcfaf4',ink:'#3e392e',heading:serif },
  { id:'direct',name:'Direct',journeyId:'express',hero:'compact',layout:'direct',color:'#2b4c48',background:'#eff4f2',surface:'#f8fcfa',ink:'#263d38',heading:sans },
  { id:'weekend',name:'Week-end',journeyId:'express',hero:'mosaic',layout:'direct',color:'#6b4458',background:'#f3eef1',surface:'#fcf8fb',ink:'#422f3b',heading:sans },
  { id:'serenite',name:'Sérénité',journeyId:'confirmation',hero:'receipt',layout:'letter',color:'#3d5948',background:'#edf3ee',surface:'#fafcf7',ink:'#2e4134',heading:serif },
  { id:'correspondance',name:'Correspondance',journeyId:'confirmation',hero:'compact',layout:'urban',color:'#3a4c68',background:'#f0f3f8',surface:'#fafbfd',ink:'#2b3a50',heading:sans },
];

export interface BaitlyTemplateProperty {
  id?: string | number; currency?: string;
  name?: string; city?: string; description?: string; photoUrls?: string[];
  imageUrl?: string; coverPhotoUrl?: string; bookingEngineVisible?: boolean;
  address?: string; maxGuests?: number; bedroomCount?: number; bathroomCount?: number;
  squareMeters?: number; nightlyPrice?: number; minimumNights?: number; cleaningBasePrice?: number;
  defaultCheckInTime?: string; defaultCheckOutTime?: string; amenities?: string[];
}

export const BAITLY_TEMPLATE_VERSION = '2026.10.17.9';
const DIRECTIONS: Record<string, HospitalityDirection> = { atlas: 'estate', horizon: 'coastal', maison: 'villa', patio: 'coastal', retraite: 'heritage', pavillon: 'estate', rivage: 'resort', escale: 'villa', itinerance: 'estate', destinations: 'coastal', direct: 'villa', weekend: 'resort', serenite: 'heritage', correspondance: 'coastal' };
const DIRECTION_LABELS: Record<HospitalityDirection, string> = { estate: 'Signature méditerranéenne', villa: 'Villa contemporaine', heritage: 'Maison de caractère', resort: 'Resort lumineux', coastal: 'Collection côtière' };

export function escapeBaitlyTemplateText(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[char]!);
}
const assetUrl = (asset: string) => new URL(asset, typeof window === 'undefined' ? 'https://app.baitly.fr' : window.location.origin).href;

function photoUrl(url: string | undefined, preview: boolean): string | undefined {
  if (!url) return undefined;
  const match = url.match(/\/api\/properties\/(\d+)\/photos\/(\d+)\/data/);
  if (match && !preview) return `${API_CONFIG.BASE_URL}/api/public/property-photos/${match[1]}/${match[2]}`;
  const absolute = url.startsWith('/') ? `${API_CONFIG.BASE_URL}${url}` : url;
  try { const parsed = new URL(absolute); return parsed.protocol === 'https:' || parsed.origin === new URL(API_CONFIG.BASE_URL).origin ? absolute : undefined; } catch { return undefined; }
}

const TITLES: Record<BaitlyBookingJourneyId, [string,string]> = {
  catalogue:['Des lieux à vivre, des séjours à choisir.','Explorez les logements, comparez les disponibilités et trouvez votre prochaine adresse.'],
  single:['Une adresse à part. Un séjour pour vous.','Découvrez le lieu, ses espaces et ses disponibilités. Préparez votre séjour directement avec votre hôte.'],
  inquiry:['Votre séjour commence par une conversation.','Un voyage en groupe, une occasion particulière ou une envie précise ? Construisons votre séjour ensemble.'],
  extras:['Le séjour, et tout ce qui le rend unique.','Choisissez votre logement, puis ajoutez les services disponibles qui vous font envie.'],
  cart:['Plusieurs étapes. Un seul voyage.','Composez votre itinéraire et regroupez vos séjours dans un même panier.'],
  express:['Moins d’étapes. Plus de séjour.','Le logement, vos dates et votre réservation : tout se prépare sur une seule page.'],
  confirmation:['Votre séjour, en clair.','Retrouvez ici les informations et le statut de votre réservation.'],
};

function buildTemplate(def: Definition, property?: BaitlyTemplateProperty, preview = false, selectedProperties?: BaitlyTemplateProperty[]): GalleryTemplate {
  const escape = escapeBaitlyTemplateText;
  const collection = (def.journeyId === 'catalogue' || def.journeyId === 'cart') && selectedProperties?.length ? selectedProperties : property ? [property] : [];
  const multiple = collection.length > 1;
  const collectionJourney = def.journeyId === 'catalogue' || def.journeyId === 'cart';
  const propertyPages = Object.fromEntries(collection.filter((item) => Number.isSafeInteger(Number(item.id)) && Number(item.id) > 0).map((item) => [String(Number(item.id)), `/logements/${Number(item.id)}`]));
  const propertyPath = (item: BaitlyTemplateProperty) => propertyPages[String(Number(item.id))] || '/logement';
  const reservationPath = (item: BaitlyTemplateProperty) => `${def.journeyId === 'cart' ? '/sejour' : '/reserver'}${Number(item.id) > 0 ? `?clenzy_property=${Number(item.id)}` : ''}`;
  const brand = escape(multiple ? def.name : property?.name || def.name);
  const city = escape(multiple ? [...new Set(collection.map((item) => item.city).filter(Boolean))].join(' · ') : property?.city || 'Des lieux à découvrir');
  const description = escape(property?.description || 'Prenez le temps de découvrir votre prochaine adresse. Les photos, les équipements et les disponibilités vous accompagnent dans votre choix.');
  const propertyPhotos = (item: BaitlyTemplateProperty) => item.photoUrls?.length ? item.photoUrls : item.coverPhotoUrl || item.imageUrl ? [item.coverPhotoUrl || item.imageUrl!] : [];
  const photoGroups = collection.map((item) => propertyPhotos(item).filter((url) => preview || item.bookingEngineVisible || !url.includes('/api/properties/')));
  // Alternate properties so a large first gallery cannot hide the other selected addresses.
  const supplied = Array.from({ length: Math.max(0, ...photoGroups.map((group) => group.length)) }, (_, index) => photoGroups.flatMap((group) => group[index] ? [group[index]] : [])).flat();
  // Private admin photos belong only in the host thumbnail. Published pages use public marketing media.
  const usable = supplied;
  const direction = DIRECTIONS[def.id];
  const fallback = [direction === 'heritage' ? heritagePhoto : coastPhoto, suitePhoto, diningPhoto, coastPhoto, heritagePhoto].map(assetUrl);
  const photos = Array.from({ length: usable.length ? Math.min(12, Math.max(3, usable.length)) : fallback.length }, (_, index) => escape(photoUrl(usable[index % (usable.length || 1)], preview) || fallback[index % fallback.length]));
  const [title,intro] = TITLES[def.journeyId];
  const primaryPath = def.journeyId === 'confirmation' ? '/' : def.journeyId === 'express' || def.journeyId === 'inquiry' ? '/#reservation' : def.journeyId === 'single' ? '/reserver' : '/logements';
  const cta = def.journeyId === 'inquiry' ? 'Préparer ma demande' : def.journeyId === 'confirmation' ? 'Revenir à l’accueil' : 'Préparer mon séjour';
  const navLinks = [['/la-maison','La maison'],['/galerie','Galerie'],['/services','Services'],['/tarifs','Tarifs'],['/destination','Destination'],['/avis','Avis'],['/informations','Informations pratiques'],['/contact','Contact']];
  const brandLockup = `${baitlyTemplateLogoMarkup(`baitly-${def.id}`)}<span class="bt-brand__name">${brand}</span>`;
  const nav = `<header class="bt-header"><nav class="bt-container bt-nav" aria-label="Navigation principale"><a class="bt-brand" href="/">${brandLockup}</a><div class="bt-nav__links">${navLinks.slice(0,4).map(([href,label])=>`<a href="${href}">${label}</a>`).join('')}</div><div class="bt-nav__actions"><a class="bt-button" href="${primaryPath}">${cta}</a><details class="bt-nav__menu"><summary>Menu <span aria-hidden="true">☰</span></summary><div>${navLinks.map(([href,label])=>`<a href="${href}">${label}</a>`).join('')}</div></details></div></nav></header>`;
  const footer = `<footer class="bt-hotel-footer"><div class="bt-container"><div class="bt-footer-grid"><div><a class="bt-brand" href="/">${brandLockup}</a><p>${city}</p><p>Des espaces à découvrir.<br/>Du temps à s’accorder.</p></div><div><p class="bt-footer-label">Découvrir</p>${navLinks.slice(0,4).map(([href,label])=>`<a href="${href}">${label}</a>`).join('')}</div><div><p class="bt-footer-label">Votre séjour</p>${navLinks.slice(4).map(([href,label])=>`<a href="${href}">${label}</a>`).join('')}</div><div><p class="bt-footer-label">Une envie particulière ?</p><p>Préparez vos dates et votre séjour directement avec votre hôte.</p><a class="bt-text-link" href="/contact">Parlons de votre séjour ↗</a></div></div><div class="bt-footer-bottom"><span>${brand}</span><a href="/informations">Préparer mon arrivée</a><a href="/">Retour à l’accueil ↑</a></div></div></footer>`;
  const shell = (body: string, path: string) => `<main class="bt-site" data-baitly-logo-version="1" data-layout="${def.layout}" data-art-direction="${direction}" data-baitly-page="${path}" data-baitly-template="baitly-${def.id}" style="${escape(Object.entries(vars).map(([key,value])=>`${key}:${value}`).join(';'))}">${nav}${body}${footer}</main>`;
  const comp = (id: string) => { const c = baitlyComposite(id); return `<div class="cb-widget cz-composite">${c.html}</div>`; };
  const section = (titleText: string, content: string, id = 'reservation') => `<section id="${id}" class="bt-container bt-section"><div class="bt-reservation"><h2>${titleText}</h2>${content}</div></section>`;
  const signature = ['atlas','maison','retraite','rivage','destinations'].includes(def.id);
  const signatureTitles: Record<string, string> = { atlas: 'Le luxe de prendre le temps.', maison: 'Votre maison, ailleurs.', retraite: 'Un lieu à part.<br/>Des moments à vous.', rivage: 'Ailleurs commence ici.', destinations: 'Des adresses.<br/>Toutes vos envies.' };
  const hero = signature ? `<section class="bt-hotel-hero bt-hotel-hero--${direction}" data-baitly-reveal="fade" data-baitly-parallax="true"><img class="bt-hero__photo" src="${photos[0]}" alt="${brand}" fetchpriority="high"/><div class="bt-hotel-hero__copy"><p class="bt-kicker">${city}</p><h1>${signatureTitles[def.id]}</h1><p>${intro}</p><a class="bt-button" href="${primaryPath}">${cta}</a></div><div class="bt-hotel-hero__bottom"><span>${brand}</span><a href="#le-lieu">Découvrir le lieu ↓</a></div></section>` : `<section class="${def.hero === 'poster' ? '' : 'bt-container '}bt-hero bt-hero--${def.hero}" data-baitly-reveal="rise"><div class="bt-hero__copy"><p class="bt-kicker">${city}</p><h1>${title}</h1><p>${intro}</p>${def.journeyId === 'confirmation' ? '' : `<a class="bt-button" href="${primaryPath}">${cta}</a>`}</div>${def.hero === 'mosaic' ? `<div class="bt-hero__mosaic"><img src="${photos[0]}" alt="${brand}"/><img src="${photos[1]}" alt="Les espaces du séjour"/></div>` : `<img class="bt-hero__photo" src="${photos[0]}" alt="${brand}"/>`}</section>`;
  const steps = (items: string[]) => `<ol class="bt-container bt-steps">${items.map((label,index)=>`<li>${index+1}. ${label}</li>`).join('')}</ol>`;
  const confirmationPage = () => `<section class="bt-container bt-confirmation-page"><header class="bt-confirmation-page__heading"><p class="bt-kicker">${brand}</p><h1>Votre séjour, en clair.</h1></header><div class="bt-confirmation-page__layout">${baitlyComposite('confirmation-status').html}<aside class="bt-confirmation-help"><h2>Préparer votre arrivée</h2><p>Conservez la référence de chaque séjour. Les instructions d’arrivée vous seront communiquées par votre hôte.</p><a class="bt-text-link" href="/informations">Informations pratiques ↗</a><a class="bt-text-link" href="/contact">Contacter votre hôte ↗</a><a class="bt-text-link" href="/">Retour à l’accueil ↗</a></aside></div></section>`;
  const checkout = (titleText: string, content: string, stage: 'reserve' | 'cart' | 'payment' = 'reserve') => `<section id="reservation" class="bt-container bt-checkout"><header class="bt-checkout__header"><h1>${titleText}</h1><ol class="bt-checkout__steps"><li><a href="${def.journeyId === 'single' || def.journeyId === 'express' ? '/' : '/logements'}">01 · Le logement</a></li><li><a href="${def.journeyId === 'cart' ? '/sejour' : def.journeyId === 'express' ? '/#reservation' : '/reserver'}"${stage !== 'payment' ? ' aria-current="step"' : ''}>02 · ${def.journeyId === 'cart' ? 'Votre voyage' : 'Votre séjour'}</a></li><li>${def.journeyId === 'cart' ? `<a href="/paiement"${stage === 'payment' ? ' aria-current="step"' : ''}>03 · Coordonnées et règlement</a>` : '03 · Confirmation'}</li></ol></header>${content}</section>`;
  const vars: Record<string,string> = {
    '--bt-color-primary':def.color,'--bt-color-on-primary':'#fafcf8','--bt-color-background':def.background,
    '--bt-color-surface':def.surface,'--bt-color-text':def.ink,'--bt-color-text-muted':def.ink,
    '--bt-color-border':`${def.ink}30`,'--bt-font-body':sans,'--bt-font-heading':def.heading,
    '--bt-radius-md':def.layout === 'urban' || def.layout === 'letter' ? '2px' : '6px', '--bt-radius-lg':def.layout === 'urban' ? '0px' : '10px',
  };
  const css = `@font-face{font-family:"Baitly Hospitality";src:url("${assetUrl(hospitalityFont)}") format("truetype");font-weight:400 500;font-display:swap}@font-face{font-family:"Baitly Hospitality";src:url("${assetUrl(hospitalityBoldFont)}") format("truetype");font-weight:600 800;font-display:swap}\n.bt-site[data-baitly-template="baitly-${def.id}"]{${Object.entries(vars).map(([key,value])=>`${key}:${value}`).join(';')}}\n${siteCss}\n${WIDGET_SKIN_CSS}\n${BAITLY_JOURNEY_COMPOSITE_CSS}\n${hospitalityCss}\n${propertyDetailsCss}\n${BAITLY_TEMPLATE_LOGO_CSS}`;
  const pages: TemplatePage[] = [];
  const add = (path: string, titleText: string, body: string) => pages.push({ path, title:titleText, type:path === '/' ? 'HOME' : 'CUSTOM', html:shell(body,path), css, seoTitle:`${titleText} · ${property?.name || 'Séjours'}`, seoDescription: `${titleText} : découvrez ${property?.name || 'notre collection de séjours'}${property?.city ? ` à ${property.city}` : ''} et préparez votre séjour en direct.` });
  const hospitality = buildHospitalitySections({ brand: multiple ? escape(property?.name || 'Notre adresse') : brand, city, description, photos, property, primaryPath, escape });
  const collectionSection = collectionJourney && collection.length ? `<section class="bt-container bt-section bt-property-collection"><p class="bt-kicker">Nos adresses</p><h2>Choisissez votre prochain séjour.</h2>${collection.map((item) => {
    const cover = propertyPhotos(item).find((url) => preview || item.bookingEngineVisible || !url.includes('/api/properties/'));
    const image = escape(photoUrl(cover, preview) || fallback[0]);
    const facts = [item.maxGuests ? `${item.maxGuests} voyageurs` : '', item.bedroomCount ? `${item.bedroomCount} chambres` : '', item.bathroomCount ? `${item.bathroomCount} salles de bain` : '', item.squareMeters ? `${item.squareMeters} m²` : ''].filter(Boolean);
    return `<article class="bt-room-feature"><a class="bt-room-feature__photo" href="${propertyPath(item)}"><img src="${image}" alt="${escape(item.name || 'Logement')}" loading="lazy"/></a><div class="bt-room-feature__copy"><p class="bt-kicker">${escape(item.city || '')}</p><h3><a href="${propertyPath(item)}">${escape(item.name || 'Votre logement')}</a></h3>${item.description ? `<p>${escape(item.description)}</p>` : ''}${facts.length ? `<p class="bt-room-facts">${escape(facts.join(' · '))}</p>` : ''}<a class="bt-text-link" href="${propertyPath(item)}">Découvrir ce logement ↗</a></div></article>`;
  }).join('')}</section>` : '';
  const sequences: Record<HospitalityDirection, string> = {
    estate: `${hospitality.about}${hospitality.roomShowcase}${hospitality.experiences}${hospitality.gallery}${hospitality.reviews}${hospitality.faq}${hospitality.cta}`,
    villa: `${hospitality.about}${hospitality.amenities}${hospitality.gallery}${hospitality.rates}${hospitality.location}${hospitality.reviews}${hospitality.faq}${hospitality.cta}`,
    heritage: `${hospitality.about}${hospitality.gallery}${hospitality.experiences}${hospitality.roomShowcase}${hospitality.reviews}${hospitality.faq}${hospitality.cta}`,
    resort: `${hospitality.about}${hospitality.experiences}${hospitality.roomShowcase}${hospitality.gallery}${hospitality.rates}${hospitality.location}${hospitality.faq}${hospitality.cta}`,
    coastal: `${hospitality.about}${hospitality.gallery}${hospitality.roomShowcase}${hospitality.location}${hospitality.experiences}${hospitality.reviews}${hospitality.faq}${hospitality.cta}`,
  };

  if (def.journeyId === 'confirmation') {
    add('/','Votre séjour',confirmationPage());
    add('/confirmation','Confirmation',confirmationPage());
  } else if (def.journeyId === 'express') {
    add('/','Réserver',`${hero}${checkout('Votre séjour en quelques instants.',comp('express-reserve'))}${sequences[direction]}`);
  } else if (def.journeyId === 'inquiry') {
    add('/','Votre séjour sur mesure',`${hero}${section('Parlons de votre séjour',comp('inquiry-request'))}${sequences[direction]}`);
    add('/merci','Votre demande',`${steps(['Votre projet','Échange avec votre hôte'])}<section class="bt-container bt-section bt-story"><div class="bt-story__copy"><h1>Restons en contact.</h1><p>Après l’envoi de votre demande, votre hôte étudiera vos dates et vos besoins. Consultez votre messagerie pour poursuivre l’échange.</p><a class="bt-button" href="/">Découvrir à nouveau le lieu</a></div><img src="${photos[1]}" alt="${brand}"/></section>`);
  } else if (def.journeyId === 'single') {
    add('/','Le lieu',`${hero}${sequences[direction]}`);
    add('/reserver','Réserver',checkout('Préparez votre séjour.',comp('single-reserve')));
  } else {
    add('/','Accueil',`${hero}${section('Trouvez votre prochain séjour',comp(def.journeyId === 'extras' ? 'extras-search' : 'catalogue-search'))}${collectionSection}${sequences[direction]}`);
    const results = comp('catalogue-results').replace('data-clenzy-next="/reserver"', `data-clenzy-next="/logement" data-baitly-property-pages="${escape(JSON.stringify(propertyPages))}"`);
    add('/logements','Les logements',`${steps(['Vos dates','Votre logement',def.journeyId === 'cart' ? 'Votre panier' : 'Votre réservation'])}${section('Choisissez votre adresse',comp('catalogue-search'))}${section('Les logements',collectionJourney ? results : comp('catalogue-results'),'logements')}`);
    if (def.journeyId === 'cart') {
      // Results select a stay, then the basket sends the guest to a dedicated validated contact form.
      pages[1].html = pages[1].html.replaceAll('data-clenzy-next="/reserver"','data-clenzy-next="/sejour"');
      add('/sejour','Composer mon voyage',checkout('Composez votre voyage.',comp('cart-build'),'cart'));
      add('/paiement','Finaliser mon voyage',checkout('La dernière étape avant le départ.',comp('cart-checkout'),'payment'));
    } else if (def.journeyId === 'extras') {
      add('/reserver','Séjour et options',checkout('Votre séjour, à votre façon.',comp('extras-reserve')));
    } else {
      add('/reserver','Réserver',checkout('Votre prochaine adresse.',comp('single-reserve')));
    }
  }
  if (collectionJourney) {
    add('/logement', 'Votre logement', `<section class="bt-container bt-section"><a class="bt-text-link" href="/logements">Tous les logements</a>${comp('single-detail')}<a class="bt-button" href="${def.journeyId === 'cart' ? '/sejour' : '/reserver'}">Choisir mes dates</a></section>`);
    for (const item of collection.filter((entry, index, all) => propertyPages[String(Number(entry.id))] && all.findIndex((other) => Number(other.id) === Number(entry.id)) === index)) {
      const media = propertyPhotos(item).filter((url) => preview || item.bookingEngineVisible || !url.includes('/api/properties/')).map((url) => escape(photoUrl(url, preview) || fallback[0]));
      add(propertyPath(item), item.name || 'Votre logement', buildBaitlyPropertyDetail({ style: def.id, property: item, photos: media.length ? media : [fallback[0]], reservationPath: reservationPath(item), escape }));
      const page = pages[pages.length - 1];
      page.html = page.html.replace(`href="${primaryPath}">${cta}`, `href="${reservationPath(item)}">${cta}`);
    }
  }
  if (def.journeyId !== 'inquiry' && def.journeyId !== 'confirmation') add('/confirmation','Votre réservation',`${confirmationPage()}${def.journeyId === 'extras' ? section('Les services pour votre séjour','<section class="bt-journey"><div data-clenzy-widget="booking-addons"></div></section>','services') : ''}`);

  hospitality.pages.forEach((page) => add(page.path, page.title, page.body));
  if (!pages.some((page) => page.path === '/merci')) add('/merci','Votre demande', `<section class="bt-container bt-page-intro"><h1>Votre demande a trouvé sa place.</h1><p>Après l’envoi de votre message, votre hôte vous répondra pour préparer votre séjour. Cette demande ne constitue pas une réservation.</p><a class="bt-button" href="/">Revenir à l’accueil</a></section>`);

  return { id:`baitly-${def.id}`,version:BAITLY_TEMPLATE_VERSION,name:def.name,journeyId:def.journeyId,description:`${pages.length} pages · ${DIRECTION_LABELS[direction]}`,designVars:vars,theme:{primaryColor:def.color,fontFamily:sans,headingFontFamily:def.heading},pages };
}

/** Master models are code-owned. Every import materializes fresh page/theme objects for its client fork. */
export const BAITLY_JOURNEY_TEMPLATES: GalleryTemplate[] = DEFINITIONS.map((def)=>{
  const template = buildTemplate(def);
  template.pages.forEach(Object.freeze);
  Object.freeze(template.pages); Object.freeze(template.theme); Object.freeze(template.designVars);
  return Object.freeze(template);
});

/** Personalization is escaped before entering page HTML, including quoted photo attributes. */
export function materializeBaitlyJourneyTemplate(template: GalleryTemplate, property?: BaitlyTemplateProperty, preview = false, selectedProperties?: BaitlyTemplateProperty[]): GalleryTemplate {
  const definition = DEFINITIONS.find((item)=>`baitly-${item.id}` === template.id);
  return definition ? buildTemplate(definition,property,preview,selectedProperties) : template;
}
