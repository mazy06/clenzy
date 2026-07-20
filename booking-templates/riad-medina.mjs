// Template « Riad Médina » — conciergerie de riads, médina de Marrakech.
// Register : quiet luxury éditorial (serif contemplatif, parchemin, terracotta, vert zellige).
// Contrat : DESIGN-BAITLY.md (tokens --bt-*, marqueurs data-clenzy-widget, RTL-safe §5 bis).

const IMG = {
  heroHome: 'https://images.unsplash.com/photo-1597211833712-5e41faa202ea?auto=format&fit=crop&w=1920&q=75',
  heroMaisons: 'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?auto=format&fit=crop&w=1920&q=70',
  heroApropos: 'https://images.unsplash.com/photo-1539020140153-e479b8c22e70?auto=format&fit=crop&w=1920&q=70',
  heroContact: 'https://images.unsplash.com/photo-1518684079-3c830dcef090?auto=format&fit=crop&w=1920&q=70',
  patio: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=70',
  chambre: 'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1200&q=70',
  table: 'https://images.unsplash.com/photo-1544984243-ec57ea16fe25?auto=format&fit=crop&w=1000&q=70',
  hammam: 'https://images.unsplash.com/photo-1531761535209-180857e963b9?auto=format&fit=crop&w=1000&q=70',
  toits: 'https://images.unsplash.com/photo-1548588681-adf41d474533?auto=format&fit=crop&w=1000&q=70',
  medina: 'https://images.unsplash.com/photo-1518684079-3c830dcef090?auto=format&fit=crop&w=1200&q=70',
};

const NAV = `
<nav class="site-nav"><div class="site-wrap site-nav__in">
  <a class="site-brand" href="/">Riad Médina</a>
  <div class="site-nav__links">
    <a href="/logements">Les maisons</a>
    <a href="/a-propos">La maison</a>
    <a href="/contact">Contact</a>
  </div>
  <a class="site-btn site-btn--nav" href="/logements">Réserver</a>
</div></nav>`;

const FOOTER = `
<footer class="site-footer"><div class="site-wrap">
  <div class="site-footer__grid">
    <div>
      <p class="site-footer__brand">Riad Médina</p>
      <p class="site-footer__tagline">Une collection de riads confidentiels au cœur de la médina de Marrakech, gérés avec le soin d’une maison de famille.</p>
    </div>
    <div>
      <p class="site-footer__title">Explorer</p>
      <a href="/logements">Les maisons</a>
      <a href="/a-propos">La maison</a>
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
    <span>© Riad Médina · Médina, Marrakech</span>
    <span>Assistance sur place 7j/7</span>
  </div>
</div></footer>`;

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Amiri:wght@400;700&family=Lato:wght@400;500;700&family=Tajawal:wght@400;500;700&display=swap');

.site-root{
  --bt-color-primary:#A4552F; --bt-color-primary-hover:#8A4523; --bt-color-on-primary:#FDF7EE;
  --bt-color-accent:#34655C;
  --bt-color-bg:#FAF5EE; --bt-color-surface:#FFFCF7; --bt-color-surface-2:#F1E7D8;
  --bt-color-text:#2E2620; --bt-color-text-muted:#7A6C5C; --bt-color-border:#E5D9C7; --bt-color-divider:#EFE5D5;
  --bt-font-heading:'Cormorant Garamond','Amiri',serif; --bt-font-body:'Lato','Tajawal',sans-serif;
  --bt-text-xs:0.78rem; --bt-text-sm:0.9rem; --bt-text-md:1rem; --bt-text-lg:1.15rem;
  --bt-text-xl:1.5rem; --bt-text-2xl:2.1rem; --bt-text-3xl:3.1rem;
  --bt-weight-normal:400; --bt-weight-medium:500; --bt-weight-semibold:600; --bt-weight-bold:700; --bt-heading-weight:600;
  --bt-leading-tight:1.12; --bt-leading-normal:1.6; --bt-leading-relaxed:1.8;
  --bt-tracking-tight:-0.01em; --bt-tracking-normal:0; --bt-tracking-wide:0.16em;
  --bt-space-1:4px; --bt-space-2:8px; --bt-space-3:16px; --bt-space-4:24px; --bt-space-5:40px; --bt-space-6:64px;
  --bt-section-y:96px; --bt-container:1140px;
  --bt-radius-sm:3px; --bt-radius-md:10px; --bt-radius-lg:16px; --bt-radius-pill:999px;
  --bt-radius-button:3px; --bt-radius-card:12px; --bt-radius-input:6px;
  --bt-shadow-sm:0 1px 2px rgba(60,42,24,0.06); --bt-shadow-md:0 8px 24px rgba(60,42,24,0.09);
  --bt-shadow-lg:0 18px 48px rgba(60,42,24,0.14); --bt-shadow-card:0 10px 30px rgba(60,42,24,0.08);
  --bt-border-width:1px;
  --bt-button-padding-x:28px; --bt-button-padding-y:14px; --bt-button-transform:uppercase; --bt-control-height:48px;
  --bt-duration:180ms; --bt-ease:cubic-bezier(0.22,1,0.36,1);
  background:var(--bt-color-bg); color:var(--bt-color-text);
  font-family:var(--bt-font-body); font-size:var(--bt-text-md); line-height:var(--bt-leading-normal);
  -webkit-font-smoothing:antialiased;
}
.site-root h1,.site-root h2,.site-root h3{
  font-family:var(--bt-font-heading); font-weight:var(--bt-heading-weight);
  line-height:var(--bt-leading-tight); letter-spacing:var(--bt-tracking-tight); text-wrap:balance;
}
.site-root h1{font-size:clamp(2.3rem,5vw,var(--bt-text-3xl))}
.site-root h2{font-size:clamp(1.7rem,3.4vw,var(--bt-text-2xl))}
.site-root h3{font-size:var(--bt-text-xl)}
.site-root p{margin:0}
.site-root img{max-width:100%;display:block}
.site-wrap{max-width:var(--bt-container); margin-inline:auto; padding-inline:var(--bt-space-4)}

.site-nav{position:sticky; inset-block-start:0; z-index:40; background:rgba(250,245,238,0.94);
  border-block-end:var(--bt-border-width) solid var(--bt-color-divider)}
.site-nav__in{display:flex; align-items:center; gap:var(--bt-space-4); min-height:72px}
.site-brand{font-family:var(--bt-font-heading); font-size:var(--bt-text-lg); font-weight:var(--bt-weight-bold);
  letter-spacing:var(--bt-tracking-wide); text-transform:uppercase; color:var(--bt-color-text); text-decoration:none}
.site-nav__links{display:flex; gap:var(--bt-space-4); margin-inline-start:auto}
.site-nav__links a{color:var(--bt-color-text-muted); text-decoration:none; font-size:var(--bt-text-sm);
  letter-spacing:0.04em; transition:color var(--bt-duration) var(--bt-ease); cursor:pointer}
.site-nav__links a:hover{color:var(--bt-color-primary)}

.site-btn{display:inline-block; background:var(--bt-color-primary); color:var(--bt-color-on-primary);
  padding:var(--bt-button-padding-y) var(--bt-button-padding-x); border-radius:var(--bt-radius-button);
  border:var(--bt-border-width) solid transparent; font-size:var(--bt-text-sm); font-weight:var(--bt-weight-semibold);
  letter-spacing:var(--bt-tracking-wide); text-transform:var(--bt-button-transform); text-decoration:none;
  cursor:pointer; transition:background var(--bt-duration) var(--bt-ease), border-color var(--bt-duration) var(--bt-ease)}
.site-btn:hover{background:var(--bt-color-primary-hover)}
.site-btn--ghost{background:transparent; color:var(--bt-color-text); border-color:var(--bt-color-border)}
.site-btn--ghost:hover{background:transparent; border-color:var(--bt-color-primary); color:var(--bt-color-primary)}
.site-btn--nav{padding-block:10px; padding-inline:20px}
.site-btn--light{background:transparent; color:#FBF4E9; border-color:rgba(251,244,233,0.6)}
.site-btn--light:hover{background:rgba(251,244,233,0.12); border-color:#FBF4E9}

.site-hero{position:relative; min-height:82vh; display:flex; align-items:flex-end;
  background-size:cover; background-position:center; background-color:#3B2E22}
.site-hero::before{content:''; position:absolute; inset:0;
  background:linear-gradient(180deg, rgba(30,22,15,0.18) 0%, rgba(30,22,15,0.62) 100%)}
.site-hero .site-wrap{position:relative; z-index:1; padding-block:88px; color:#FBF4E9; width:100%}
.site-hero h1{color:#FBF4E9; max-width:15ch}
.site-hero .site-eyebrow{color:#E8D8BC}
.site-hero__lead{max-width:52ch; margin-block-start:var(--bt-space-3); font-size:var(--bt-text-lg);
  line-height:var(--bt-leading-relaxed); color:rgba(251,244,233,0.92)}
.site-hero__actions{display:flex; gap:var(--bt-space-3); margin-block-start:var(--bt-space-4); flex-wrap:wrap}
.site-hero__booking{margin-block-start:var(--bt-space-5); max-width:880px}
.site-hero__note{margin-block-start:var(--bt-space-2); font-size:var(--bt-text-xs);
  letter-spacing:0.06em; color:rgba(251,244,233,0.75)}
.site-hero--compact{min-height:46vh}
.site-hero--medina{background-image:url('${IMG.heroHome}')}
.site-hero--maisons{background-image:url('${IMG.heroMaisons}')}
.site-hero--apropos{background-image:url('${IMG.heroApropos}')}
.site-hero--contact{background-image:url('${IMG.heroContact}')}

.site-section{padding-block:var(--bt-section-y)}
.site-section--tint{background:var(--bt-color-surface-2)}
.site-section__head{max-width:680px; margin-block-end:var(--bt-space-5)}
.site-eyebrow{font-size:var(--bt-text-xs); letter-spacing:var(--bt-tracking-wide); text-transform:uppercase;
  color:var(--bt-color-accent); font-weight:var(--bt-weight-bold); margin-block-end:var(--bt-space-2)}
.site-lead{color:var(--bt-color-text-muted); font-size:var(--bt-text-lg);
  line-height:var(--bt-leading-relaxed); margin-block-start:var(--bt-space-3)}

.site-split{display:grid; grid-template-columns:1.05fr 0.95fr; gap:var(--bt-space-6); align-items:center}
.site-split__body p + p{margin-block-start:var(--bt-space-3)}
.site-split__body .site-lead{margin-block-start:var(--bt-space-3)}
.site-figure{border-radius:var(--bt-radius-lg); overflow:hidden; box-shadow:var(--bt-shadow-card);
  aspect-ratio:4/3; background:var(--bt-color-surface-2)}
.site-figure--tall{aspect-ratio:3/4}
.site-figure img{width:100%; height:100%; object-fit:cover}

.site-rows{border-block-end:var(--bt-border-width) solid var(--bt-color-divider)}
.site-row{display:grid; grid-template-columns:64px 1fr 300px; gap:var(--bt-space-5); align-items:center;
  padding-block:var(--bt-space-5); border-block-start:var(--bt-border-width) solid var(--bt-color-divider)}
.site-row__num{font-family:var(--bt-font-heading); font-size:var(--bt-text-xl);
  color:var(--bt-color-accent); font-variant-numeric:tabular-nums}
.site-row__body h3{margin-block-end:var(--bt-space-2)}
.site-row__body p{color:var(--bt-color-text-muted); max-width:56ch}
.site-row__img{aspect-ratio:16/10; border-radius:var(--bt-radius-md); overflow:hidden}
.site-row__img img{width:100%; height:100%; object-fit:cover}

.site-services{display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); column-gap:var(--bt-space-6)}
.site-service{padding-block:var(--bt-space-4); border-block-end:var(--bt-border-width) solid var(--bt-color-divider)}
.site-service h3{font-family:var(--bt-font-body); font-size:var(--bt-text-md);
  font-weight:var(--bt-weight-semibold); margin-block-end:var(--bt-space-1)}
.site-service p{color:var(--bt-color-text-muted); font-size:var(--bt-text-sm)}

.site-quote{max-width:760px; margin-inline:auto; text-align:center; font-family:var(--bt-font-heading);
  font-size:clamp(1.3rem,2.6vw,var(--bt-text-xl)); line-height:1.5; font-style:italic}
.site-quote__by{font-family:var(--bt-font-body); font-style:normal; font-size:var(--bt-text-xs);
  color:var(--bt-color-text-muted); margin-block-start:var(--bt-space-3);
  letter-spacing:var(--bt-tracking-wide); text-transform:uppercase}

.site-assure{display:flex; flex-wrap:wrap; gap:var(--bt-space-3) var(--bt-space-5); justify-content:center;
  padding-block:var(--bt-space-4); border-block:var(--bt-border-width) solid var(--bt-color-divider);
  font-size:var(--bt-text-sm); color:var(--bt-color-text-muted); text-align:center}
.site-assure strong{color:var(--bt-color-text); font-weight:var(--bt-weight-semibold)}

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
.site-info h3{font-family:var(--bt-font-body); font-size:var(--bt-text-md);
  font-weight:var(--bt-weight-semibold); margin-block-end:var(--bt-space-2)}
.site-info p{color:var(--bt-color-text-muted); font-size:var(--bt-text-sm)}
.site-info p + p{margin-block-start:var(--bt-space-1)}

.site-footer{background:#241B12; color:#D8CBB8; margin-block-start:var(--bt-space-6);
  padding-block:var(--bt-space-6) var(--bt-space-4)}
.site-footer__grid{display:grid; grid-template-columns:2fr 1fr 1.2fr; gap:var(--bt-space-5)}
.site-footer__brand{font-family:var(--bt-font-heading); font-size:var(--bt-text-lg);
  letter-spacing:var(--bt-tracking-wide); text-transform:uppercase; color:#F4EAD8; margin-block-end:var(--bt-space-2)}
.site-footer__tagline{font-size:var(--bt-text-sm); line-height:var(--bt-leading-relaxed); max-width:38ch}
.site-footer__title{font-size:var(--bt-text-xs); letter-spacing:var(--bt-tracking-wide); text-transform:uppercase;
  color:#A6957C; margin-block-end:var(--bt-space-3); font-weight:var(--bt-weight-semibold)}
.site-footer a{display:block; color:#D8CBB8; text-decoration:none; font-size:var(--bt-text-sm);
  padding-block:var(--bt-space-1); transition:color var(--bt-duration) var(--bt-ease); cursor:pointer}
.site-footer a:hover{color:#F4EAD8}
.site-footer__note{font-size:var(--bt-text-sm); padding-block:var(--bt-space-1)}
.site-footer__bottom{margin-block-start:var(--bt-space-5); padding-block-start:var(--bt-space-3);
  border-block-start:1px solid rgba(216,203,184,0.22); font-size:var(--bt-text-xs);
  display:flex; justify-content:space-between; flex-wrap:wrap; gap:var(--bt-space-2)}

.site-cta-block{text-align:center; max-width:680px; margin-inline:auto; margin-block-start:var(--bt-space-6)}
.site-actions{margin-block-start:var(--bt-space-4)}
.site-section__head--flush{margin-block-end:0}
.site-section--top-flush{padding-block-start:var(--bt-space-4)}

.site-root a:focus-visible,.site-root button:focus-visible{outline:2px solid var(--bt-color-accent); outline-offset:3px}
.site-num{font-variant-numeric:tabular-nums}

@media (max-width:960px){
  .site-split{grid-template-columns:1fr; gap:var(--bt-space-5)}
  .site-row{grid-template-columns:48px 1fr}
  .site-row__img{grid-column:2; margin-block-start:var(--bt-space-3)}
  .site-filters{grid-template-columns:repeat(2,minmax(0,1fr))}
  .site-footer__grid{grid-template-columns:1fr 1fr}
  .site-info-grid{grid-template-columns:1fr}
}
@media (max-width:640px){
  .site-root{--bt-section-y:64px}
  .site-nav__links{display:none}
  .site-hero{min-height:70vh}
  .site-services{grid-template-columns:1fr}
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
<section class="site-hero site-hero--medina">
  <div class="site-wrap">
    <p class="site-eyebrow">Médina de Marrakech</p>
    <h1>Derrière une porte de cèdre, le calme d’un patio</h1>
    <p class="site-hero__lead">Une collection de riads confidentiels, gérés avec le soin d’une maison de famille. Séjours, table d’hôtes et conciergerie, au cœur de la médina.</p>
    <div class="site-hero__booking">
      <div data-clenzy-widget="search" data-clenzy-next="/logements"></div>
      <p class="site-hero__note">Prix en dirhams · paiement sécurisé · confirmation immédiate</p>
    </div>
  </div>
</section>

<section class="site-section"><div class="site-wrap">
  <div class="site-split">
    <div class="site-split__body">
      <p class="site-eyebrow">L’esprit des lieux</p>
      <h2>L’hospitalité marocaine, sans ostentation</h2>
      <p class="site-lead">Chaque maison a été choisie pour son patio, sa lumière et son silence. Nous les entretenons comme des demeures de famille : artisanat de la médina, linge soigné, thé à la menthe à l’arrivée.</p>
      <p class="site-lead">Notre équipe vit ici. Elle vous accueille, vous guide et s’efface quand vous souhaitez être seuls.</p>
    </div>
    <div class="site-figure site-figure--tall"><img src="${IMG.patio}" alt="Patio d’un riad, bassin et arcades"></div>
  </div>
</div></section>

<section class="site-section site-section--tint"><div class="site-wrap">
  <div class="site-section__head">
    <p class="site-eyebrow">Les maisons</p>
    <h2>Choisissez votre riad</h2>
    <p class="site-lead">Des maisons de deux à huit chambres, toutes dans la médina, chacune avec son caractère. Les disponibilités et les prix s’affichent en temps réel.</p>
  </div>
  <div data-clenzy-widget="results" data-clenzy-props='{"columns":3,"showPrice":true}' data-clenzy-next="/logement"></div>
</div></section>

<section class="site-section"><div class="site-wrap">
  <div class="site-section__head">
    <p class="site-eyebrow">La vie au riad</p>
    <h2>Trois rituels qui font la maison</h2>
  </div>
  <div class="site-rows">
    <div class="site-row">
      <span class="site-row__num">01</span>
      <div class="site-row__body">
        <h3>La table d’hôtes</h3>
        <p>Tajines mijotés, légumes du souk, pâtisseries maison. Le dîner se réserve le matin même auprès de la gouvernante, et se sert sous les arcades ou sur le toit.</p>
      </div>
      <div class="site-row__img"><img src="${IMG.table}" alt="Table dressée pour le dîner"></div>
    </div>
    <div class="site-row">
      <span class="site-row__num">02</span>
      <div class="site-row__body">
        <h3>Hammam et soins</h3>
        <p>Savon noir, gant de kessa, huile d’argan. Un rituel traditionnel à vivre au riad ou dans les meilleurs hammams de la médina, réservés par nos soins.</p>
      </div>
      <div class="site-row__img"><img src="${IMG.hammam}" alt="Hammam traditionnel"></div>
    </div>
    <div class="site-row">
      <span class="site-row__num">03</span>
      <div class="site-row__body">
        <h3>Les toits, au coucher du soleil</h3>
        <p>Le thé se prend en terrasse, quand la ville rosit et que l’appel du soir traverse les toits. C’est le moment que nos voyageurs n’oublient pas.</p>
      </div>
      <div class="site-row__img"><img src="${IMG.toits}" alt="Terrasse sur les toits de la médina"></div>
    </div>
  </div>
</div></section>

<section class="site-section site-section--tint"><div class="site-wrap">
  <div class="site-section__head">
    <p class="site-eyebrow">La conciergerie</p>
    <h2>Tout est déjà pensé</h2>
    <p class="site-lead">Avant, pendant et après votre séjour, une seule équipe s’occupe de tout.</p>
  </div>
  <div class="site-services">
    <div class="site-service"><h3>Transfert depuis l’aéroport</h3><p>Accueil personnalisé à Marrakech-Ménara et accompagnement jusqu’à la porte du riad, bagages portés dans la médina.</p></div>
    <div class="site-service"><h3>Chef à domicile</h3><p>Cuisine marocaine ou repas sur mesure, préparés au riad par notre cuisinière.</p></div>
    <div class="site-service"><h3>Excursions</h3><p>Atlas, vallée de l’Ourika, Essaouira ou désert d’Agafay : itinéraires éprouvés, chauffeurs de confiance.</p></div>
    <div class="site-service"><h3>Ménage quotidien et linge</h3><p>Les chambres sont refaites chaque jour, le linge changé avec discrétion.</p></div>
    <div class="site-service"><h3>Réservations en ville</h3><p>Restaurants, hammams, artisans : nous réservons et nous vous guidons.</p></div>
    <div class="site-service"><h3>Assistance 7j/7</h3><p>Une personne joignable à toute heure pendant votre séjour.</p></div>
  </div>
</div></section>

<section class="site-section"><div class="site-wrap">
  <div class="site-split">
    <div class="site-figure"><img src="${IMG.medina}" alt="Ruelle de la médina de Marrakech"></div>
    <div class="site-split__body">
      <p class="site-eyebrow">S’y rendre</p>
      <h2>À quelques pas de Jemaa el-Fna</h2>
      <p class="site-lead">Nos maisons sont à moins de dix minutes à pied de la place, dans des derbs calmes. L’aéroport de Marrakech-Ménara est à une vingtaine de minutes en voiture.</p>
      <p class="site-lead">D’octobre à avril, la lumière est douce et la ville respire : c’est la plus belle saison pour la médina.</p>
    </div>
  </div>
</div></section>

<section class="site-section site-section--tint"><div class="site-wrap">
  <blockquote class="site-quote">
    « Nous sommes arrivés voyageurs, nous sommes repartis amis de la maison. »
    <p class="site-quote__by">Livre d’or du riad</p>
  </blockquote>
</div></section>

<section class="site-section"><div class="site-wrap">
  <div class="site-assure">
    <span><strong>Taxe de séjour</strong> collectée et reversée</span>
    <span><strong>Enregistrement des voyageurs</strong> conforme à la réglementation</span>
    <span><strong>Annulation flexible</strong> selon conditions</span>
    <span><strong>Assistance sur place</strong> 7j/7</span>
  </div>
  <div class="site-cta-block">
    <h2>Vos dates, votre maison</h2>
    <p class="site-lead">Vérifiez les disponibilités et réservez en quelques minutes.</p>
    <p class="site-actions"><a class="site-btn" href="/logements">Voir les maisons</a></p>
  </div>
</div></section>
${FOOTER}
</div>`;

const LOGEMENTS_HTML = `
<div class="site-root">
${NAV}
<section class="site-hero site-hero--compact site-hero--maisons">
  <div class="site-wrap">
    <p class="site-eyebrow">Les maisons</p>
    <h1>Chaque riad a son caractère</h1>
    <p class="site-hero__lead">Patios plantés, bassins, terrasses : choisissez la maison qui vous ressemble, aux dates qui vous conviennent.</p>
  </div>
</section>

<section class="site-section"><div class="site-wrap">
  <div class="site-filters">
    <div><p class="site-filter__label">Vos dates</p><div data-clenzy-widget="dates"></div></div>
    <div><p class="site-filter__label">Voyageurs</p><div data-clenzy-widget="guests"></div></div>
    <div><p class="site-filter__label">Budget par nuit</p><div data-clenzy-widget="price"></div></div>
    <div><p class="site-filter__label">Devise</p><div data-clenzy-widget="currency"></div></div>
  </div>
  <div data-clenzy-widget="results" data-clenzy-props='{"columns":3,"showPrice":true}' data-clenzy-next="/logement"></div>
</div></section>

<section class="site-section site-section--tint"><div class="site-wrap">
  <div class="site-section__head site-section__head--flush">
    <p class="site-eyebrow">Notre engagement</p>
    <h2>Comment nous choisissons nos maisons</h2>
    <p class="site-lead">Un riad rejoint la collection s’il réunit trois choses : un patio qui respire, un derb paisible et une équipe de maison fidèle. Nous refusons davantage de maisons que nous n’en acceptons, pour garder à chacune l’attention qu’elle mérite.</p>
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
    <p class="site-eyebrow">Séjour sur mesure</p>
    <h2>Composez votre séjour</h2>
    <p class="site-lead">Transfert, dîners, hammam, excursions : ajoutez ce qu’il vous faut, notre équipe s’occupe du reste.</p>
  </div>
  <div data-clenzy-widget="upsells"></div>
</div></section>

<section class="site-section"><div class="site-wrap">
  <div class="site-section__head">
    <p class="site-eyebrow">Toujours inclus</p>
    <h2>Ce que comprend chaque séjour</h2>
  </div>
  <div class="site-services">
    <div class="site-service"><h3>Accueil personnalisé</h3><p>Arrivée accompagnée dans la médina, thé de bienvenue, conseils de quartier.</p></div>
    <div class="site-service"><h3>Ménage quotidien</h3><p>Chambres refaites chaque jour, linge de maison soigné.</p></div>
    <div class="site-service"><h3>Petit-déjeuner marocain</h3><p>Msemen, amlou, fruits de saison et café, servis au patio ou en terrasse.</p></div>
    <div class="site-service"><h3>Conciergerie 7j/7</h3><p>Une personne joignable à toute heure pendant votre séjour.</p></div>
  </div>
</div></section>
${FOOTER}
</div>`;

const APROPOS_HTML = `
<div class="site-root">
${NAV}
<section class="site-hero site-hero--compact site-hero--apropos">
  <div class="site-wrap">
    <p class="site-eyebrow">La maison</p>
    <h1>Une conciergerie née dans la médina</h1>
  </div>
</section>

<section class="site-section"><div class="site-wrap">
  <div class="site-split">
    <div class="site-split__body">
      <p class="site-eyebrow">Notre histoire</p>
      <h2>Des maisons transmises, pas seulement louées</h2>
      <p class="site-lead">Tout a commencé par un riad de famille, restauré patiemment avec les artisans du quartier : zellige, tadelakt, bois de cèdre. Puis des voisins nous ont confié leurs maisons, avec la même exigence.</p>
      <p class="site-lead">Aujourd’hui, nous gérons une collection choisie de riads dans la médina, avec les équipes qui les connaissent depuis toujours.</p>
    </div>
    <div class="site-figure site-figure--tall"><img src="${IMG.chambre}" alt="Chambre d’un riad de la collection"></div>
  </div>
</div></section>

<section class="site-section site-section--tint"><div class="site-wrap">
  <div class="site-section__head">
    <p class="site-eyebrow">Nos principes</p>
    <h2>Trois exigences, aucune exception</h2>
  </div>
  <div class="site-rows">
    <div class="site-row">
      <span class="site-row__num">01</span>
      <div class="site-row__body"><h3>La discrétion</h3><p>Une maison d’hôtes réussie se remarque à peine : service présent, jamais pesant.</p></div>
    </div>
    <div class="site-row">
      <span class="site-row__num">02</span>
      <div class="site-row__body"><h3>L’exigence</h3><p>Linge, ménage, entretien : le niveau d’une grande maison, la chaleur d’une maison de famille.</p></div>
    </div>
    <div class="site-row">
      <span class="site-row__num">03</span>
      <div class="site-row__body"><h3>La transmission</h3><p>Artisans, cuisinières, guides : nous travaillons avec la médina, pas seulement dedans.</p></div>
    </div>
  </div>
</div></section>

<section class="site-section"><div class="site-wrap">
  <div class="site-section__head">
    <p class="site-eyebrow">En toute conformité</p>
    <h2>Un séjour en règle, sans que vous y pensiez</h2>
    <p class="site-lead">Enregistrement des voyageurs conforme à la réglementation marocaine, taxe de séjour collectée et reversée, factures en bonne et due forme : la conciergerie s’occupe des formalités.</p>
    <p class="site-actions"><a class="site-btn site-btn--ghost" href="/contact">Nous écrire</a></p>
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
    <h1>Parlons de votre séjour</h1>
    <p class="site-hero__lead">Une question sur une maison, une demande particulière, un événement à organiser : écrivez-nous, nous répondons vite.</p>
  </div>
</section>

<section class="site-section"><div class="site-wrap">
  <div class="site-info-grid">
    <div class="site-info">
      <h3>Écrivez-nous</h3>
      <p>contact@riad-medina.example</p>
      <p>Réponse sous 24 heures, en français, en anglais ou en arabe.</p>
    </div>
    <div class="site-info">
      <h3>Appelez-nous</h3>
      <p class="site-num">+212 5 24 00 00 00</p>
      <p>Tous les jours, de 9 h à 20 h (heure de Marrakech). WhatsApp bienvenu.</p>
    </div>
    <div class="site-info">
      <h3>Où nous trouver</h3>
      <p>Médina de Marrakech, à quelques pas de Jemaa el-Fna.</p>
      <p>L’adresse exacte de votre riad vous est envoyée à la réservation, avec un plan d’accès.</p>
    </div>
    <div class="site-info">
      <h3>Avant votre arrivée</h3>
      <p>Transfert depuis l’aéroport de Marrakech-Ménara sur demande.</p>
      <p>Un membre de l’équipe vous attend à l’entrée du derb et vous accompagne jusqu’à la porte.</p>
    </div>
  </div>
  <div class="site-cta-block">
    <h2>Prêts à pousser la porte ?</h2>
    <p class="site-actions"><a class="site-btn" href="/logements">Voir les disponibilités</a></p>
  </div>
</div></section>
${FOOTER}
</div>`;

export default {
  meta: {
    name: 'Riad Médina',
    slug: 'riad-medina',
    category: 'conciergerie',
    archetype: 'editorial',
    theme: 'medina',
    defaultLocale: 'fr',
    thumbnailUrl: IMG.heroHome,
    description: 'Quiet luxury éditorial pour conciergerie de riads en médina : serif contemplatif, parchemin et terracotta, table d’hôtes et hammam.',
  },
  designVars: {
    '--bt-color-primary': '#A4552F', '--bt-color-primary-hover': '#8A4523', '--bt-color-on-primary': '#FDF7EE',
    '--bt-color-accent': '#34655C',
    '--bt-color-bg': '#FAF5EE', '--bt-color-surface': '#FFFCF7', '--bt-color-surface-2': '#F1E7D8',
    '--bt-color-text': '#2E2620', '--bt-color-text-muted': '#7A6C5C', '--bt-color-border': '#E5D9C7', '--bt-color-divider': '#EFE5D5',
    '--bt-font-heading': "'Cormorant Garamond','Amiri',serif", '--bt-font-body': "'Lato','Tajawal',sans-serif",
    '--bt-text-xs': '0.78rem', '--bt-text-sm': '0.9rem', '--bt-text-md': '1rem', '--bt-text-lg': '1.15rem',
    '--bt-text-xl': '1.5rem', '--bt-text-2xl': '2.1rem', '--bt-text-3xl': '3.1rem',
    '--bt-weight-normal': '400', '--bt-weight-medium': '500', '--bt-weight-semibold': '600', '--bt-weight-bold': '700',
    '--bt-heading-weight': '600',
    '--bt-leading-tight': '1.12', '--bt-leading-normal': '1.6', '--bt-leading-relaxed': '1.8',
    '--bt-tracking-tight': '-0.01em', '--bt-tracking-normal': '0', '--bt-tracking-wide': '0.16em',
    '--bt-space-1': '4px', '--bt-space-2': '8px', '--bt-space-3': '16px', '--bt-space-4': '24px', '--bt-space-5': '40px', '--bt-space-6': '64px',
    '--bt-section-y': '96px', '--bt-container': '1140px',
    '--bt-radius-sm': '3px', '--bt-radius-md': '10px', '--bt-radius-lg': '16px', '--bt-radius-pill': '999px',
    '--bt-radius-button': '3px', '--bt-radius-card': '12px', '--bt-radius-input': '6px',
    '--bt-shadow-sm': '0 1px 2px rgba(60,42,24,0.06)', '--bt-shadow-md': '0 8px 24px rgba(60,42,24,0.09)',
    '--bt-shadow-lg': '0 18px 48px rgba(60,42,24,0.14)', '--bt-shadow-card': '0 10px 30px rgba(60,42,24,0.08)',
    '--bt-border-width': '1px',
    '--bt-button-padding-x': '28px', '--bt-button-padding-y': '14px', '--bt-button-transform': 'uppercase',
    '--bt-control-height': '48px',
    '--bt-duration': '180ms', '--bt-ease': 'cubic-bezier(0.22,1,0.36,1)',
  },
  css: CSS,
  pages: [
    {
      path: '/', type: 'HOME', title: 'Accueil',
      seoTitle: 'Riad Médina · Riads de charme à Marrakech',
      seoDescription: 'Collection de riads confidentiels au cœur de la médina de Marrakech. Table d’hôtes, hammam, conciergerie 7j/7. Réservation directe.',
      html: HOME_HTML,
    },
    {
      path: '/logements', type: 'PROPERTY_LIST', title: 'Les maisons',
      seoTitle: 'Les maisons · Riad Médina Marrakech',
      seoDescription: 'Choisissez votre riad dans la médina de Marrakech : disponibilités et prix en temps réel, réservation directe et sécurisée.',
      html: LOGEMENTS_HTML,
    },
    {
      path: '/logement', type: 'PROPERTY_DETAIL', title: 'La maison',
      seoTitle: 'Votre riad · Riad Médina Marrakech',
      seoDescription: 'Chambres, patio, terrasse et services inclus : découvrez la maison et composez votre séjour sur mesure dans la médina.',
      html: LOGEMENT_HTML,
    },
    {
      path: '/a-propos', type: 'CUSTOM', title: 'La maison',
      seoTitle: 'Notre histoire · Riad Médina Marrakech',
      seoDescription: 'Une conciergerie née dans la médina : maisons restaurées avec les artisans du quartier, équipes fidèles, hospitalité marocaine.',
      html: APROPOS_HTML,
    },
    {
      path: '/contact', type: 'CUSTOM', title: 'Contact',
      seoTitle: 'Contact · Riad Médina Marrakech',
      seoDescription: 'Une question, une demande particulière ? Écrivez-nous : réponse sous 24 h, en français, en anglais ou en arabe.',
      html: CONTACT_HTML,
    },
  ],
};
