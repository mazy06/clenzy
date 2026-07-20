// Template « Villa Palmeraie » — villa privée avec piscine, Palmeraie de Marrakech.
// Register : one-page lumineux façon location saisonnière premium (sans-serif contemporain,
// blanc chaud, bleu piscine, ocre doré). Contrat : DESIGN-BAITLY.md (RTL-safe §5 bis).

const IMG = {
  heroHome: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1920&q=75',
  heroSejours: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1920&q=70',
  heroExperiences: 'https://images.unsplash.com/photo-1518684079-3c830dcef090?auto=format&fit=crop&w=1920&q=70',
  heroContact: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1920&q=70',
  salon: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=70',
  chambre: 'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1000&q=70',
  piscine: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1200&q=70',
  jardin: 'https://images.unsplash.com/photo-1559508551-44bff1de756b?auto=format&fit=crop&w=1000&q=70',
  terrasse: 'https://images.unsplash.com/photo-1615529182904-14819c35db37?auto=format&fit=crop&w=1000&q=70',
  atlas: 'https://images.unsplash.com/photo-1539020140153-e479b8c22e70?auto=format&fit=crop&w=1200&q=70',
};

const NAV = `
<nav class="site-nav"><div class="site-wrap site-nav__in">
  <a class="site-brand" href="/">Villa Palmeraie</a>
  <div class="site-nav__links">
    <a href="/logements">Séjourner</a>
    <a href="/experiences">Expériences</a>
    <a href="/contact">Contact</a>
  </div>
  <a class="site-btn site-btn--nav" href="/logements">Vérifier les dates</a>
</div></nav>`;

const FOOTER = `
<footer class="site-footer"><div class="site-wrap">
  <div class="site-footer__grid">
    <div>
      <p class="site-footer__brand">Villa Palmeraie</p>
      <p class="site-footer__tagline">Villa privée avec piscine au cœur de la Palmeraie de Marrakech, gérée par une conciergerie dédiée.</p>
    </div>
    <div>
      <p class="site-footer__title">Explorer</p>
      <a href="/logements">Séjourner</a>
      <a href="/experiences">Expériences</a>
      <a href="/contact">Contact</a>
    </div>
    <div>
      <p class="site-footer__title">Bon à savoir</p>
      <p class="site-footer__note">Taxe de séjour collectée et reversée</p>
      <p class="site-footer__note">Enregistrement des voyageurs conforme</p>
      <p class="site-footer__note">Paiement sécurisé, prix en dirhams</p>
    </div>
  </div>
  <div class="site-footer__bottom">
    <span>© Villa Palmeraie · Palmeraie, Marrakech</span>
    <span>Conciergerie joignable 7j/7</span>
  </div>
</div></footer>`;

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700;800&family=Rubik:wght@400;500;600&display=swap');

.site-root{
  --bt-color-primary:#23698A; --bt-color-primary-hover:#1A5470; --bt-color-on-primary:#F4FAFD;
  --bt-color-accent:#C68F4B;
  --bt-color-bg:#FBFAF6; --bt-color-surface:#FEFDFA; --bt-color-surface-2:#F0EEE4;
  --bt-color-text:#22292E; --bt-color-text-muted:#667077; --bt-color-border:#E2DFD3; --bt-color-divider:#EBE9DE;
  --bt-font-heading:'Manrope','Rubik',sans-serif; --bt-font-body:'Rubik',sans-serif;
  --bt-text-xs:0.78rem; --bt-text-sm:0.9rem; --bt-text-md:1rem; --bt-text-lg:1.15rem;
  --bt-text-xl:1.45rem; --bt-text-2xl:2rem; --bt-text-3xl:3.2rem;
  --bt-weight-normal:400; --bt-weight-medium:500; --bt-weight-semibold:600; --bt-weight-bold:700; --bt-heading-weight:700;
  --bt-leading-tight:1.1; --bt-leading-normal:1.6; --bt-leading-relaxed:1.75;
  --bt-tracking-tight:-0.02em; --bt-tracking-normal:0; --bt-tracking-wide:0.12em;
  --bt-space-1:4px; --bt-space-2:8px; --bt-space-3:16px; --bt-space-4:24px; --bt-space-5:40px; --bt-space-6:64px;
  --bt-section-y:88px; --bt-container:1160px;
  --bt-radius-sm:6px; --bt-radius-md:12px; --bt-radius-lg:20px; --bt-radius-pill:999px;
  --bt-radius-button:12px; --bt-radius-card:16px; --bt-radius-input:10px;
  --bt-shadow-sm:0 1px 3px rgba(35,60,75,0.07); --bt-shadow-md:0 10px 28px rgba(35,60,75,0.10);
  --bt-shadow-lg:0 20px 52px rgba(35,60,75,0.15); --bt-shadow-card:0 12px 32px rgba(35,60,75,0.09);
  --bt-border-width:1px;
  --bt-button-padding-x:26px; --bt-button-padding-y:13px; --bt-button-transform:none; --bt-control-height:50px;
  --bt-duration:160ms; --bt-ease:cubic-bezier(0.22,1,0.36,1);
  background:var(--bt-color-bg); color:var(--bt-color-text);
  font-family:var(--bt-font-body); font-size:var(--bt-text-md); line-height:var(--bt-leading-normal);
  -webkit-font-smoothing:antialiased;
}
.site-root h1,.site-root h2,.site-root h3{
  font-family:var(--bt-font-heading); font-weight:var(--bt-heading-weight);
  line-height:var(--bt-leading-tight); letter-spacing:var(--bt-tracking-tight); text-wrap:balance;
}
.site-root h1{font-size:clamp(2.4rem,5.4vw,var(--bt-text-3xl))}
.site-root h2{font-size:clamp(1.6rem,3.2vw,var(--bt-text-2xl))}
.site-root h3{font-size:var(--bt-text-xl)}
.site-root p{margin:0}
.site-root img{max-width:100%;display:block}
.site-wrap{max-width:var(--bt-container); margin-inline:auto; padding-inline:var(--bt-space-4)}

.site-nav{position:sticky; inset-block-start:0; z-index:40; background:rgba(251,250,246,0.94);
  border-block-end:var(--bt-border-width) solid var(--bt-color-divider)}
.site-nav__in{display:flex; align-items:center; gap:var(--bt-space-4); min-height:70px}
.site-brand{font-family:var(--bt-font-heading); font-size:var(--bt-text-lg); font-weight:var(--bt-weight-bold);
  color:var(--bt-color-text); text-decoration:none; letter-spacing:var(--bt-tracking-tight)}
.site-nav__links{display:flex; gap:var(--bt-space-4); margin-inline-start:auto}
.site-nav__links a{color:var(--bt-color-text-muted); text-decoration:none; font-size:var(--bt-text-sm);
  font-weight:var(--bt-weight-medium); transition:color var(--bt-duration) var(--bt-ease); cursor:pointer}
.site-nav__links a:hover{color:var(--bt-color-primary)}

.site-btn{display:inline-block; background:var(--bt-color-primary); color:var(--bt-color-on-primary);
  padding:var(--bt-button-padding-y) var(--bt-button-padding-x); border-radius:var(--bt-radius-button);
  border:var(--bt-border-width) solid transparent; font-size:var(--bt-text-sm); font-weight:var(--bt-weight-semibold);
  text-transform:var(--bt-button-transform); text-decoration:none; cursor:pointer;
  transition:background var(--bt-duration) var(--bt-ease), box-shadow var(--bt-duration) var(--bt-ease)}
.site-btn:hover{background:var(--bt-color-primary-hover); box-shadow:var(--bt-shadow-sm)}
.site-btn--ghost{background:transparent; color:var(--bt-color-text); border-color:var(--bt-color-border)}
.site-btn--ghost:hover{background:transparent; border-color:var(--bt-color-primary); color:var(--bt-color-primary); box-shadow:none}
.site-btn--nav{padding-block:10px; padding-inline:18px}

.site-hero{position:relative; min-height:86vh; display:flex; align-items:flex-end;
  background-size:cover; background-position:center; background-color:#1E3A47}
.site-hero::before{content:''; position:absolute; inset:0;
  background:linear-gradient(180deg, rgba(16,32,40,0.12) 0%, rgba(16,32,40,0.58) 100%)}
.site-hero .site-wrap{position:relative; z-index:1; padding-block:80px; color:#F7FBFC; width:100%}
.site-hero h1{color:#F7FBFC; max-width:16ch}
.site-hero .site-eyebrow{color:#E9D9BC}
.site-hero__lead{max-width:54ch; margin-block-start:var(--bt-space-3); font-size:var(--bt-text-lg);
  line-height:var(--bt-leading-relaxed); color:rgba(247,251,252,0.92)}
.site-hero__booking{margin-block-start:var(--bt-space-5); max-width:900px}
.site-hero__note{margin-block-start:var(--bt-space-2); font-size:var(--bt-text-xs);
  letter-spacing:0.05em; color:rgba(247,251,252,0.75)}
.site-hero--compact{min-height:46vh}
.site-hero--palmeraie{background-image:url('${IMG.heroHome}')}
.site-hero--sejours{background-image:url('${IMG.heroSejours}')}
.site-hero--experiences{background-image:url('${IMG.heroExperiences}')}
.site-hero--contact{background-image:url('${IMG.heroContact}')}

.site-section{padding-block:var(--bt-section-y)}
.site-section--tint{background:var(--bt-color-surface-2)}
.site-section__head{max-width:660px; margin-block-end:var(--bt-space-5)}
.site-section__head--flush{margin-block-end:0}
.site-section--top-flush{padding-block-start:var(--bt-space-4)}
.site-eyebrow{font-size:var(--bt-text-xs); letter-spacing:var(--bt-tracking-wide); text-transform:uppercase;
  color:var(--bt-color-accent); font-weight:var(--bt-weight-bold); margin-block-end:var(--bt-space-2)}
.site-lead{color:var(--bt-color-text-muted); font-size:var(--bt-text-lg);
  line-height:var(--bt-leading-relaxed); margin-block-start:var(--bt-space-3)}

.site-strip{display:flex; flex-wrap:wrap; gap:var(--bt-space-2) var(--bt-space-5); justify-content:center;
  padding-block:var(--bt-space-4); border-block-end:var(--bt-border-width) solid var(--bt-color-divider);
  font-size:var(--bt-text-sm); font-weight:var(--bt-weight-medium); color:var(--bt-color-text-muted)}

.site-split{display:grid; grid-template-columns:1.05fr 0.95fr; gap:var(--bt-space-6); align-items:center}
.site-split__body p + p{margin-block-start:var(--bt-space-3)}
.site-figure{border-radius:var(--bt-radius-lg); overflow:hidden; box-shadow:var(--bt-shadow-card);
  aspect-ratio:4/3; background:var(--bt-color-surface-2)}
.site-figure--tall{aspect-ratio:3/4}
.site-figure img{width:100%; height:100%; object-fit:cover}

.site-gallery{display:grid; grid-template-columns:1.6fr 1fr; grid-template-rows:1fr 1fr;
  gap:var(--bt-space-3); margin-block-start:var(--bt-space-5)}
.site-gallery__main{grid-row:1 / span 2; border-radius:var(--bt-radius-lg); overflow:hidden; box-shadow:var(--bt-shadow-card)}
.site-gallery__side{border-radius:var(--bt-radius-md); overflow:hidden; box-shadow:var(--bt-shadow-sm)}
.site-gallery img{width:100%; height:100%; object-fit:cover}

.site-amenities{display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); column-gap:var(--bt-space-6)}
.site-amenity{padding-block:var(--bt-space-4); border-block-end:var(--bt-border-width) solid var(--bt-color-divider)}
.site-amenity h3{font-size:var(--bt-text-md); font-weight:var(--bt-weight-semibold); margin-block-end:var(--bt-space-1)}
.site-amenity p{color:var(--bt-color-text-muted); font-size:var(--bt-text-sm)}

.site-quotes{display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:var(--bt-space-5)}
.site-quote-card{background:var(--bt-color-surface); border:var(--bt-border-width) solid var(--bt-color-border);
  border-radius:var(--bt-radius-card); padding:var(--bt-space-5); box-shadow:var(--bt-shadow-sm);
  font-size:var(--bt-text-lg); line-height:var(--bt-leading-relaxed)}
.site-quote-card__by{margin-block-start:var(--bt-space-3); font-size:var(--bt-text-xs);
  letter-spacing:var(--bt-tracking-wide); text-transform:uppercase; color:var(--bt-color-text-muted)}

.site-faq{max-width:760px}
.site-faq__item{padding-block:var(--bt-space-4); border-block-end:var(--bt-border-width) solid var(--bt-color-divider)}
.site-faq__item h3{font-size:var(--bt-text-md); font-weight:var(--bt-weight-semibold); margin-block-end:var(--bt-space-2)}
.site-faq__item p{color:var(--bt-color-text-muted); font-size:var(--bt-text-sm); line-height:var(--bt-leading-relaxed)}

.site-rows{border-block-end:var(--bt-border-width) solid var(--bt-color-divider)}
.site-row{display:grid; grid-template-columns:64px 1fr 300px; gap:var(--bt-space-5); align-items:center;
  padding-block:var(--bt-space-5); border-block-start:var(--bt-border-width) solid var(--bt-color-divider)}
.site-row__num{font-family:var(--bt-font-heading); font-size:var(--bt-text-xl);
  color:var(--bt-color-accent); font-variant-numeric:tabular-nums; font-weight:var(--bt-weight-bold)}
.site-row__body h3{margin-block-end:var(--bt-space-2)}
.site-row__body p{color:var(--bt-color-text-muted); max-width:56ch}
.site-row__img{aspect-ratio:16/10; border-radius:var(--bt-radius-md); overflow:hidden}
.site-row__img img{width:100%; height:100%; object-fit:cover}

.site-filters{display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:var(--bt-space-3);
  align-items:start; padding:var(--bt-space-4); background:var(--bt-color-surface);
  border:var(--bt-border-width) solid var(--bt-color-border); border-radius:var(--bt-radius-lg);
  box-shadow:var(--bt-shadow-sm); margin-block-end:var(--bt-space-5)}
.site-filter__label{font-size:var(--bt-text-xs); letter-spacing:var(--bt-tracking-wide);
  text-transform:uppercase; color:var(--bt-color-text-muted); margin-block-end:var(--bt-space-2);
  font-weight:var(--bt-weight-semibold)}

.site-crumb{display:inline-block; margin-block:var(--bt-space-4) 0; color:var(--bt-color-text-muted);
  text-decoration:none; font-size:var(--bt-text-sm); transition:color var(--bt-duration) var(--bt-ease); cursor:pointer}
.site-crumb:hover{color:var(--bt-color-primary)}

.site-info-grid{display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:var(--bt-space-5)}
.site-info{background:var(--bt-color-surface); border:var(--bt-border-width) solid var(--bt-color-border);
  border-radius:var(--bt-radius-card); padding:var(--bt-space-4); box-shadow:var(--bt-shadow-sm)}
.site-info h3{font-size:var(--bt-text-md); font-weight:var(--bt-weight-semibold); margin-block-end:var(--bt-space-2)}
.site-info p{color:var(--bt-color-text-muted); font-size:var(--bt-text-sm)}
.site-info p + p{margin-block-start:var(--bt-space-1)}

.site-cta-block{text-align:center; max-width:680px; margin-inline:auto; margin-block-start:var(--bt-space-6)}
.site-actions{margin-block-start:var(--bt-space-4)}

.site-footer{background:#1C2B33; color:#C4CFD4; margin-block-start:var(--bt-space-6);
  padding-block:var(--bt-space-6) var(--bt-space-4)}
.site-footer__grid{display:grid; grid-template-columns:2fr 1fr 1.2fr; gap:var(--bt-space-5)}
.site-footer__brand{font-family:var(--bt-font-heading); font-size:var(--bt-text-lg);
  font-weight:var(--bt-weight-bold); color:#F0F5F7; margin-block-end:var(--bt-space-2)}
.site-footer__tagline{font-size:var(--bt-text-sm); line-height:var(--bt-leading-relaxed); max-width:38ch}
.site-footer__title{font-size:var(--bt-text-xs); letter-spacing:var(--bt-tracking-wide); text-transform:uppercase;
  color:#8FA3AC; margin-block-end:var(--bt-space-3); font-weight:var(--bt-weight-semibold)}
.site-footer a{display:block; color:#C4CFD4; text-decoration:none; font-size:var(--bt-text-sm);
  padding-block:var(--bt-space-1); transition:color var(--bt-duration) var(--bt-ease); cursor:pointer}
.site-footer a:hover{color:#F0F5F7}
.site-footer__note{font-size:var(--bt-text-sm); padding-block:var(--bt-space-1)}
.site-footer__bottom{margin-block-start:var(--bt-space-5); padding-block-start:var(--bt-space-3);
  border-block-start:1px solid rgba(196,207,212,0.22); font-size:var(--bt-text-xs);
  display:flex; justify-content:space-between; flex-wrap:wrap; gap:var(--bt-space-2)}

.site-root a:focus-visible,.site-root button:focus-visible{outline:2px solid var(--bt-color-accent); outline-offset:3px}
.site-num{font-variant-numeric:tabular-nums}

@media (max-width:960px){
  .site-split{grid-template-columns:1fr; gap:var(--bt-space-5)}
  .site-gallery{grid-template-columns:1fr; grid-template-rows:auto}
  .site-gallery__main{grid-row:auto}
  .site-row{grid-template-columns:48px 1fr}
  .site-row__img{grid-column:2; margin-block-start:var(--bt-space-3)}
  .site-filters{grid-template-columns:repeat(2,minmax(0,1fr))}
  .site-quotes{grid-template-columns:1fr}
  .site-footer__grid{grid-template-columns:1fr 1fr}
  .site-info-grid{grid-template-columns:1fr}
}
@media (max-width:640px){
  .site-root{--bt-section-y:60px}
  .site-nav__links{display:none}
  .site-hero{min-height:72vh}
  .site-amenities{grid-template-columns:1fr}
  .site-filters{grid-template-columns:1fr}
  .site-footer__grid{grid-template-columns:1fr}
}
@media (prefers-reduced-motion:reduce){
  .site-root *{transition:none !important; animation:none !important}
}
`;

const HOME_HTML = `
<div class="site-root">
${NAV}
<section class="site-hero site-hero--palmeraie">
  <div class="site-wrap">
    <p class="site-eyebrow">La Palmeraie · Marrakech</p>
    <h1>Une villa, des palmiers, le silence</h1>
    <p class="site-hero__lead">Villa privée avec piscine au cœur de la Palmeraie de Marrakech. Personnel de maison attentionné, conciergerie dédiée, et la médina à vingt minutes.</p>
    <div class="site-hero__booking">
      <div data-clenzy-widget="search" data-clenzy-next="/logements"></div>
      <p class="site-hero__note">Prix en dirhams · paiement sécurisé · réponse immédiate</p>
    </div>
  </div>
</section>

<div class="site-wrap">
  <div class="site-strip">
    <span>Piscine privée</span>
    <span>Personnel de maison</span>
    <span>Petit-déjeuner servi</span>
    <span>Jardin de palmiers</span>
    <span>Transferts sur demande</span>
  </div>
</div>

<section class="site-section"><div class="site-wrap">
  <div class="site-split">
    <div class="site-split__body">
      <p class="site-eyebrow">La maison</p>
      <h2>Une maison dans les palmiers, pensée pour ne rien faire</h2>
      <p class="site-lead">Ici, les journées s’organisent autour de la piscine, des repas au jardin et des siestes à l’ombre. La maison est grande, lumineuse, ouverte sur la palmeraie, et l’équipe veille à ce que vous n’ayez à penser à rien.</p>
      <p class="site-lead">Le soir, l’Atlas se découpe au loin et la table se dresse en terrasse.</p>
    </div>
    <div class="site-figure site-figure--tall"><img src="${IMG.salon}" alt="Salon lumineux de la villa"></div>
  </div>
  <div class="site-gallery">
    <div class="site-gallery__main"><img src="${IMG.piscine}" alt="Piscine privée de la villa"></div>
    <div class="site-gallery__side"><img src="${IMG.chambre}" alt="Chambre de la villa"></div>
    <div class="site-gallery__side"><img src="${IMG.jardin}" alt="Jardin de palmiers"></div>
  </div>
</div></section>

<section class="site-section site-section--tint"><div class="site-wrap">
  <div class="site-section__head">
    <p class="site-eyebrow">Le confort</p>
    <h2>Tout ce qu’il faut, rien de superflu</h2>
  </div>
  <div class="site-amenities">
    <div class="site-amenity"><h3>Piscine privée</h3><p>Au calme absolu, entourée de palmiers, transats et parasols.</p></div>
    <div class="site-amenity"><h3>Personnel de maison</h3><p>Gouvernante et jardinier au quotidien, cuisinière sur demande.</p></div>
    <div class="site-amenity"><h3>Cuisine équipée</h3><p>Grande cuisine ouverte, et le marché livré à la villa si vous le souhaitez.</p></div>
    <div class="site-amenity"><h3>Wifi fibre</h3><p>Débit confortable dans toute la maison, coins ombragés pour travailler au calme.</p></div>
    <div class="site-amenity"><h3>Climatisation et cheminée</h3><p>Fraîcheur l’été, feu de bois les soirs d’hiver.</p></div>
    <div class="site-amenity"><h3>Rooftop</h3><p>Terrasse sur le toit, coucher de soleil sur la palmeraie et l’Atlas.</p></div>
  </div>
</div></section>

<section class="site-section"><div class="site-wrap">
  <div class="site-split">
    <div class="site-figure"><img src="${IMG.atlas}" alt="Marrakech et l’Atlas au loin"></div>
    <div class="site-split__body">
      <p class="site-eyebrow">S’y rendre</p>
      <h2>Loin du bruit, près de tout</h2>
      <p class="site-lead">L’aéroport de Marrakech-Ménara est à une vingtaine de minutes, la médina et Jemaa el-Fna à un quart d’heure. Les golfs de la Palmeraie sont à quelques minutes de la villa.</p>
      <p class="site-lead">Nous organisons vos transferts et mettons un chauffeur à votre disposition sur demande.</p>
    </div>
  </div>
</div></section>

<section class="site-section site-section--tint"><div class="site-wrap">
  <div class="site-section__head">
    <p class="site-eyebrow">Ils ont séjourné ici</p>
    <h2>Ce que les voyageurs retiennent</h2>
  </div>
  <div class="site-quotes">
    <div class="site-quote-card">
      « La maison est encore plus belle qu’en photo, et l’équipe d’une gentillesse rare. Les petits-déjeuners au bord de la piscine resteront notre meilleur souvenir. »
      <p class="site-quote-card__by">Livre d’or de la villa</p>
    </div>
    <div class="site-quote-card">
      « Tout était organisé avant même qu’on le demande : transfert, dîner d’anniversaire, excursion dans l’Atlas. On a juste eu à profiter. »
      <p class="site-quote-card__by">Livre d’or de la villa</p>
    </div>
  </div>
</div></section>

<section class="site-section"><div class="site-wrap">
  <div class="site-section__head">
    <p class="site-eyebrow">Questions fréquentes</p>
    <h2>Avant de réserver</h2>
  </div>
  <div class="site-faq">
    <div class="site-faq__item">
      <h3>À quelle heure peut-on arriver et repartir ?</h3>
      <p>L’arrivée se fait en général en milieu d’après-midi et le départ en fin de matinée. Dites-nous vos horaires de vol : quand la maison le permet, nous nous adaptons.</p>
    </div>
    <div class="site-faq__item">
      <h3>La villa convient-elle aux enfants ?</h3>
      <p>Oui. Lits bébé et chaises hautes sur demande. La piscine n’est pas clôturée : les enfants restent sous la surveillance des parents.</p>
    </div>
    <div class="site-faq__item">
      <h3>Comment se passent les repas ?</h3>
      <p>Le petit-déjeuner est servi chaque matin. Pour les déjeuners et dîners, notre cuisinière prépare une cuisine marocaine de saison, sur simple demande la veille.</p>
    </div>
    <div class="site-faq__item">
      <h3>La taxe de séjour est-elle incluse ?</h3>
      <p>Elle est collectée avec votre réservation et reversée : vous n’avez aucune démarche à faire sur place.</p>
    </div>
    <div class="site-faq__item">
      <h3>Peut-on annuler ?</h3>
      <p>Les conditions d’annulation sont affichées avant le paiement, selon la saison et la durée du séjour.</p>
    </div>
  </div>
  <div class="site-cta-block">
    <h2>La palmeraie vous attend</h2>
    <p class="site-lead">Vérifiez les disponibilités de la villa à vos dates.</p>
    <p class="site-actions"><a class="site-btn" href="/logements">Vérifier les dates</a></p>
  </div>
</div></section>
${FOOTER}
</div>`;

const LOGEMENTS_HTML = `
<div class="site-root">
${NAV}
<section class="site-hero site-hero--compact site-hero--sejours">
  <div class="site-wrap">
    <p class="site-eyebrow">Séjourner</p>
    <h1>La villa et les maisons sœurs</h1>
    <p class="site-hero__lead">La conciergerie gère quelques adresses choisies dans la Palmeraie. Sélectionnez vos dates : les disponibilités et les prix s’affichent en temps réel.</p>
  </div>
</section>

<section class="site-section"><div class="site-wrap">
  <div class="site-filters">
    <div><p class="site-filter__label">Vos dates</p><div data-clenzy-widget="dates"></div></div>
    <div><p class="site-filter__label">Voyageurs</p><div data-clenzy-widget="guests"></div></div>
    <div><p class="site-filter__label">Budget par nuit</p><div data-clenzy-widget="price"></div></div>
    <div><p class="site-filter__label">Devise</p><div data-clenzy-widget="currency"></div></div>
  </div>
  <div data-clenzy-widget="results" data-clenzy-props='{"columns":2,"showPrice":true}' data-clenzy-next="/logement"></div>
</div></section>

<section class="site-section site-section--tint"><div class="site-wrap">
  <div class="site-section__head site-section__head--flush">
    <p class="site-eyebrow">Notre promesse</p>
    <h2>Le même soin, dans chaque maison</h2>
    <p class="site-lead">Chaque villa est préparée par la même équipe, avec le même niveau d’exigence : linge soigné, maison impeccable, accueil personnalisé et conciergerie joignable 7j/7 pendant tout votre séjour.</p>
  </div>
</div></section>
${FOOTER}
</div>`;

const LOGEMENT_HTML = `
<div class="site-root">
${NAV}
<div class="site-wrap">
  <a class="site-crumb" href="/logements">← Toutes les maisons</a>
</div>
<section class="site-section site-section--top-flush"><div class="site-wrap">
  <div data-clenzy-widget="property" data-clenzy-return="/logements"></div>
</div></section>

<section class="site-section site-section--tint"><div class="site-wrap">
  <div class="site-section__head">
    <p class="site-eyebrow">Sur mesure</p>
    <h2>Ajoutez ce qui rendra le séjour parfait</h2>
    <p class="site-lead">Chef à domicile, montgolfière à l’aube, hammam à la villa : composez votre séjour, la conciergerie orchestre tout.</p>
  </div>
  <div data-clenzy-widget="upsells"></div>
</div></section>

<section class="site-section"><div class="site-wrap">
  <div class="site-section__head">
    <p class="site-eyebrow">Toujours inclus</p>
    <h2>Ce que comprend chaque séjour</h2>
  </div>
  <div class="site-amenities">
    <div class="site-amenity"><h3>Accueil à la villa</h3><p>Un membre de l’équipe vous attend, vous installe et vous fait visiter la maison.</p></div>
    <div class="site-amenity"><h3>Petit-déjeuner</h3><p>Servi chaque matin au jardin ou en terrasse.</p></div>
    <div class="site-amenity"><h3>Entretien quotidien</h3><p>Ménage, piscine et jardin, en toute discrétion.</p></div>
    <div class="site-amenity"><h3>Conciergerie 7j/7</h3><p>Une personne dédiée, joignable à toute heure pendant votre séjour.</p></div>
  </div>
</div></section>
${FOOTER}
</div>`;

const EXPERIENCES_HTML = `
<div class="site-root">
${NAV}
<section class="site-hero site-hero--compact site-hero--experiences">
  <div class="site-wrap">
    <p class="site-eyebrow">Expériences</p>
    <h1>Marrakech, à votre rythme</h1>
    <p class="site-hero__lead">Des expériences choisies et organisées par la conciergerie, depuis la villa. Réservables pendant votre séjour ou à l’avance.</p>
  </div>
</section>

<section class="site-section"><div class="site-wrap">
  <div class="site-rows">
    <div class="site-row">
      <span class="site-row__num">01</span>
      <div class="site-row__body">
        <h3>Montgolfière à l’aube</h3>
        <p>Décollage au lever du jour au nord de Marrakech, la palmeraie et l’Atlas sous la nacelle, petit-déjeuner berbère à l’atterrissage. Retour à la villa avant la chaleur.</p>
      </div>
      <div class="site-row__img"><img src="${IMG.terrasse}" alt="Lever de soleil sur la palmeraie"></div>
    </div>
    <div class="site-row">
      <span class="site-row__num">02</span>
      <div class="site-row__body">
        <h3>Dîner dans le désert d’Agafay</h3>
        <p>À une heure de la villa, un camp au milieu des pierres et des étoiles : thé au coucher du soleil, dîner aux chandelles, retour avec chauffeur.</p>
      </div>
      <div class="site-row__img"><img src="${IMG.heroContact}" alt="Désert d’Agafay au crépuscule"></div>
    </div>
    <div class="site-row">
      <span class="site-row__num">03</span>
      <div class="site-row__body">
        <h3>Hammam et soins à la villa</h3>
        <p>Praticiennes à domicile : savon noir, gommage au gant de kessa, massage à l’huile d’argan, à l’ombre du jardin.</p>
      </div>
      <div class="site-row__img"><img src="${IMG.chambre}" alt="Moment de détente à la villa"></div>
    </div>
    <div class="site-row">
      <span class="site-row__num">04</span>
      <div class="site-row__body">
        <h3>Golf dans la Palmeraie</h3>
        <p>Départs réservés sur les parcours voisins, clubs de location et voiturier organisés par la conciergerie.</p>
      </div>
      <div class="site-row__img"><img src="${IMG.jardin}" alt="Green au milieu des palmiers"></div>
    </div>
    <div class="site-row">
      <span class="site-row__num">05</span>
      <div class="site-row__body">
        <h3>Atelier cuisine marocaine</h3>
        <p>Un matin au marché avec notre cuisinière, puis tajine et pâtisseries préparés ensemble à la villa. Le déjeuner est votre diplôme.</p>
      </div>
      <div class="site-row__img"><img src="${IMG.salon}" alt="Cuisine de la villa"></div>
    </div>
  </div>
  <div class="site-cta-block">
    <h2>Une envie particulière ?</h2>
    <p class="site-lead">Anniversaire, demande en mariage, shooting photo : parlez-nous de votre projet.</p>
    <p class="site-actions"><a class="site-btn site-btn--ghost" href="/contact">Écrire à la conciergerie</a></p>
  </div>
</div></section>
${FOOTER}
</div>`;

const CONTACT_HTML = `
<div class="site-root">
${NAV}
<section class="site-hero site-hero--compact site-hero--contact">
  <div class="site-wrap">
    <p class="site-eyebrow">Contact</p>
    <h1>La conciergerie vous répond</h1>
    <p class="site-hero__lead">Dates, enfants, événements, demandes particulières : écrivez-nous, nous répondons vite et en trois langues.</p>
  </div>
</section>

<section class="site-section"><div class="site-wrap">
  <div class="site-info-grid">
    <div class="site-info">
      <h3>Écrivez-nous</h3>
      <p>contact@villa-palmeraie.example</p>
      <p>Réponse sous 24 heures, en français, en anglais ou en arabe.</p>
    </div>
    <div class="site-info">
      <h3>Appelez-nous</h3>
      <p class="site-num">+212 5 24 00 00 00</p>
      <p>Tous les jours, de 9 h à 20 h (heure de Marrakech). WhatsApp bienvenu.</p>
    </div>
    <div class="site-info">
      <h3>Où se trouve la villa</h3>
      <p>Palmeraie de Marrakech, à un quart d’heure de la médina.</p>
      <p>L’adresse exacte et le plan d’accès vous sont envoyés à la réservation.</p>
    </div>
    <div class="site-info">
      <h3>Votre arrivée</h3>
      <p>Transfert privé depuis l’aéroport de Marrakech-Ménara sur demande.</p>
      <p>La maison est prête à votre heure, la gouvernante vous accueille.</p>
    </div>
  </div>
  <div class="site-cta-block">
    <h2>Vos dates sont peut-être libres</h2>
    <p class="site-actions"><a class="site-btn" href="/logements">Vérifier les disponibilités</a></p>
  </div>
</div></section>
${FOOTER}
</div>`;

export default {
  meta: {
    name: 'Villa Palmeraie',
    slug: 'villa-palmeraie',
    category: 'conciergerie',
    archetype: 'overlay',
    theme: 'palmeraie',
    defaultLocale: 'fr',
    thumbnailUrl: IMG.heroHome,
    description: 'One-page lumineux pour villa privée avec piscine : blanc chaud, bleu piscine, expériences conciergerie et FAQ, façon location saisonnière premium.',
  },
  designVars: {
    '--bt-color-primary': '#23698A', '--bt-color-primary-hover': '#1A5470', '--bt-color-on-primary': '#F4FAFD',
    '--bt-color-accent': '#C68F4B',
    '--bt-color-bg': '#FBFAF6', '--bt-color-surface': '#FEFDFA', '--bt-color-surface-2': '#F0EEE4',
    '--bt-color-text': '#22292E', '--bt-color-text-muted': '#667077', '--bt-color-border': '#E2DFD3', '--bt-color-divider': '#EBE9DE',
    '--bt-font-heading': "'Manrope','Rubik',sans-serif", '--bt-font-body': "'Rubik',sans-serif",
    '--bt-text-xs': '0.78rem', '--bt-text-sm': '0.9rem', '--bt-text-md': '1rem', '--bt-text-lg': '1.15rem',
    '--bt-text-xl': '1.45rem', '--bt-text-2xl': '2rem', '--bt-text-3xl': '3.2rem',
    '--bt-weight-normal': '400', '--bt-weight-medium': '500', '--bt-weight-semibold': '600', '--bt-weight-bold': '700',
    '--bt-heading-weight': '700',
    '--bt-leading-tight': '1.1', '--bt-leading-normal': '1.6', '--bt-leading-relaxed': '1.75',
    '--bt-tracking-tight': '-0.02em', '--bt-tracking-normal': '0', '--bt-tracking-wide': '0.12em',
    '--bt-space-1': '4px', '--bt-space-2': '8px', '--bt-space-3': '16px', '--bt-space-4': '24px', '--bt-space-5': '40px', '--bt-space-6': '64px',
    '--bt-section-y': '88px', '--bt-container': '1160px',
    '--bt-radius-sm': '6px', '--bt-radius-md': '12px', '--bt-radius-lg': '20px', '--bt-radius-pill': '999px',
    '--bt-radius-button': '12px', '--bt-radius-card': '16px', '--bt-radius-input': '10px',
    '--bt-shadow-sm': '0 1px 3px rgba(35,60,75,0.07)', '--bt-shadow-md': '0 10px 28px rgba(35,60,75,0.10)',
    '--bt-shadow-lg': '0 20px 52px rgba(35,60,75,0.15)', '--bt-shadow-card': '0 12px 32px rgba(35,60,75,0.09)',
    '--bt-border-width': '1px',
    '--bt-button-padding-x': '26px', '--bt-button-padding-y': '13px', '--bt-button-transform': 'none',
    '--bt-control-height': '50px',
    '--bt-duration': '160ms', '--bt-ease': 'cubic-bezier(0.22,1,0.36,1)',
  },
  css: CSS,
  pages: [
    {
      path: '/', type: 'HOME', title: 'Accueil',
      seoTitle: 'Villa Palmeraie · Villa avec piscine à Marrakech',
      seoDescription: 'Villa privée avec piscine dans la Palmeraie de Marrakech : personnel de maison, conciergerie dédiée, réservation directe et sécurisée.',
      html: HOME_HTML,
    },
    {
      path: '/logements', type: 'PROPERTY_LIST', title: 'Séjourner',
      seoTitle: 'Séjourner · Villa Palmeraie Marrakech',
      seoDescription: 'La villa et les maisons sœurs de la Palmeraie : disponibilités et prix en temps réel, réservation directe.',
      html: LOGEMENTS_HTML,
    },
    {
      path: '/logement', type: 'PROPERTY_DETAIL', title: 'La villa',
      seoTitle: 'La villa · Villa Palmeraie Marrakech',
      seoDescription: 'Chambres, piscine, services inclus et extras sur mesure : découvrez la villa et composez votre séjour dans la Palmeraie.',
      html: LOGEMENT_HTML,
    },
    {
      path: '/experiences', type: 'CUSTOM', title: 'Expériences',
      seoTitle: 'Expériences · Villa Palmeraie Marrakech',
      seoDescription: 'Montgolfière à l’aube, dîner dans le désert d’Agafay, hammam à la villa, golf : des expériences organisées par la conciergerie.',
      html: EXPERIENCES_HTML,
    },
    {
      path: '/contact', type: 'CUSTOM', title: 'Contact',
      seoTitle: 'Contact · Villa Palmeraie Marrakech',
      seoDescription: 'Écrivez à la conciergerie : réponse sous 24 h, en français, en anglais ou en arabe. Transferts et demandes particulières bienvenus.',
      html: CONTACT_HTML,
    },
  ],
};
