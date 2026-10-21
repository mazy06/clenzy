/**
 * Livret d'accueil — design tokens « welcome book » (identité chaude, boutique-hôtel)
 *
 * Source unique des 7 thèmes du livret guest, partagée par la page guest
 * (`PublicGuide`) et l'aperçu live de la config (`WelcomeGuideAdmin`). Identité
 * délibérément indépendante du PMS (Cormorant Garamond + Hanken Grotesk, terracotta,
 * grands radius). Tout est scopé sous `.wb` pour ne jamais déborder sur l'app.
 *
 * Le thème s'applique en posant `data-theme="<id>"` sur le conteneur `.wb` :
 * palette, typographie et rayons changent sans modifier le contenu du livret.
 */

export type WelcomeBookThemeId =
  | 'atelier'
  | 'noir'
  | 'jardin'
  | 'azur'
  | 'corail'
  | 'brume'
  | 'minuit';

export interface WelcomeBookTheme {
  id: WelcomeBookThemeId;
  /** Nom affiché (fallback FR ; le sélecteur de config peut surcharger via i18n). */
  name: string;
  /** Sous-titre court (fallback FR). */
  desc: string;
  /** Échantillon pour le sélecteur (fond, surface, accent). */
  swatch: { bg: string; surface: string; accent: string };
}

export const WELCOME_BOOK_THEMES: WelcomeBookTheme[] = [
  { id: 'atelier', name: 'Atelier', desc: 'Crème & terracotta · hôtel-boutique', swatch: { bg: '#F6F2E9', surface: '#FCF9F2', accent: '#B35331' } },
  { id: 'noir', name: 'Noir', desc: 'Sombre & or · luxe discret', swatch: { bg: '#191813', surface: '#24221C', accent: '#D8A24A' } },
  { id: 'jardin', name: 'Jardin', desc: 'Verts naturels · maison de campagne', swatch: { bg: '#F0F3EC', surface: '#FAFBF6', accent: '#3E6B4A' } },
  { id: 'azur', name: 'Azur', desc: 'Bleu minéral · bord de mer', swatch: { bg: '#F1F5F7', surface: '#FAFCFD', accent: '#2E6E8E' } },
  { id: 'corail', name: 'Corail', desc: 'Pêche vif · lumineux & contemporain', swatch: { bg: '#FCF3EF', surface: '#FFF8F3', accent: '#B54730' } },
  { id: 'brume', name: 'Brume', desc: 'Mauve doux · minimal apaisé', swatch: { bg: '#F3F2F5', surface: '#FAF9FC', accent: '#7A6A95' } },
  { id: 'minuit', name: 'Minuit', desc: 'Bleu nuit & ciel · sombre raffiné', swatch: { bg: '#0F1622', surface: '#1F2B3D', accent: '#6BA3D6' } },
];

const THEME_IDS = new Set(WELCOME_BOOK_THEMES.map((t) => t.id));

/** Normalise un identifiant de thème (fallback `atelier` si inconnu/null). */
export function normalizeTheme(theme: string | null | undefined): WelcomeBookThemeId {
  return theme && THEME_IDS.has(theme as WelcomeBookThemeId) ? (theme as WelcomeBookThemeId) : 'atelier';
}

/** Couleur d'accent d'un thème (pastille de la liste admin, etc.). */
export function themeAccent(theme: string | null | undefined): string {
  const t = WELCOME_BOOK_THEMES.find((x) => x.id === normalizeTheme(theme));
  return t ? t.swatch.accent : '#B35331';
}

/**
 * CSS scopé `.wb` (variables + helpers). Porté du design handoff Baitly
 * (`ui_kits/welcome-book/wb-ui.jsx`). Injecté une seule fois par page.
 */
const WELCOME_BOOK_CSS = `
.wb{
  --bg:#F6F2E9; --surface:#FCF9F2; --raised:#FFFDF9;
  --ink:#2A241E; --ink-soft:#6A5F52; --ink-faint:#746757;
  --terra:#B35331; --terra-deep:#9E4527; --terra-soft:#E7C7B4; --terra-bg:#F5E3D7;
  --gold:#BD9038; --olive:#6E7A56;
  --line:#E8DCC8; --line-soft:#F0E7D7;
  --serif:"Cormorant Garamond",Georgia,serif;
  --sans:"Hanken Grotesk",system-ui,sans-serif;
  --book-card-radius:22px; --book-button-radius:16px; --on-terra:#FFF6EF;
  --sh-sm:0 1px 2px rgba(74,52,32,.06);
  --sh-md:0 8px 24px -14px rgba(74,52,32,.22);
  --sh-lg:0 22px 50px -22px rgba(74,52,32,.30);
  position:relative; width:100%; height:100%; background:var(--bg); color:var(--ink);
  font-family:var(--sans); -webkit-font-smoothing:antialiased;
  display:flex; flex-direction:column; overflow:hidden;
}
.wb *{ box-sizing:border-box; }

/* Livret en arabe : ni Cormorant Garamond ni Hanken Grotesk n'ont de glyphes
   arabes dessines. Sans cette bascule, le navigateur retombe sur la police
   systeme — et comme les deux jetons retombent independamment, le titre et le
   corps du meme ecran n'avaient pas le meme dessin. Un seul jeton en arabe,
   le meme que l'application (Tajawal). */
.wb[dir="rtl"]{
  --serif:'Tajawal','Tahoma','Geeza Pro','Arabic Typesetting','Traditional Arabic',sans-serif;
  --sans:var(--serif);
}

.wb[data-theme="noir"]{
  --bg:#191813; --surface:#24221C; --raised:#2D2A22;
  --ink:#F4ECDE; --ink-soft:#BCB09C; --ink-faint:#AC9F8C;
  --terra:#D8A24A; --terra-deep:#E3B86C; --terra-soft:#4C3E27; --terra-bg:#2D2416;
  --gold:#E3B86C; --olive:#9AA06A;
  --line:#3F392C; --line-soft:#302B22;
  --serif:Georgia,'Times New Roman',serif;
  --book-card-radius:8px; --book-button-radius:8px; --on-terra:#211B14;
}
.wb[data-theme="jardin"]{
  --bg:#F0F3EC; --surface:#FAFBF6; --raised:#FCFDF8;
  --ink:#212B1E; --ink-soft:#55614F; --ink-faint:#606D57;
  --terra:#3E6B4A; --terra-deep:#2F5238; --terra-soft:#C6D6C2; --terra-bg:#DBE8D5;
  --gold:#A98C3E; --olive:#3E6B4A;
  --line:#D6E2CD; --line-soft:#E4ECDD;
  --serif:Georgia,serif; --book-card-radius:26px; --book-button-radius:20px;
}
.wb[data-theme="azur"]{
  --bg:#F1F5F7; --surface:#FAFCFD; --raised:#FDFEFF;
  --ink:#1D2A33; --ink-soft:#54626D; --ink-faint:#596C7A;
  --terra:#2E6E8E; --terra-deep:#21566F; --terra-soft:#BBD4E1; --terra-bg:#DBE8EF;
  --gold:#B8902F; --olive:#2E6E8E;
  --line:#D8E2E8; --line-soft:#E6EDF1;
  --serif:var(--sans); --book-card-radius:12px; --book-button-radius:10px;
}
.wb[data-theme="corail"]{
  --bg:#FCF3EF; --surface:#FFF8F3; --raised:#FFFBF8;
  --ink:#3A2A24; --ink-soft:#7A6258; --ink-faint:#84685D;
  --terra:#B54730; --terra-deep:#A43E29; --terra-soft:#F6C9B6; --terra-bg:#FBE0D5;
  --gold:#C98A3C; --olive:#8C7A4E;
  --line:#F2DDD2; --line-soft:#F8E9E1;
  --serif:var(--sans); --book-card-radius:18px; --book-button-radius:18px;
}
.wb[data-theme="brume"]{
  --bg:#F3F2F5; --surface:#FAF9FC; --raised:#FCFBFD;
  --ink:#2C2833; --ink-soft:#5E5868; --ink-faint:#6B6278;
  --terra:#7A6A95; --terra-deep:#5E5078; --terra-soft:#D6CEE0; --terra-bg:#E4DEEC;
  --gold:#A98C3E; --olive:#6E7A56;
  --line:#DED9E6; --line-soft:#E8E4EE;
  --serif:var(--sans); --book-card-radius:10px; --book-button-radius:10px;
}
.wb[data-theme="minuit"]{
  --bg:#0F1622; --surface:#182232; --raised:#1F2B3D;
  --ink:#E9EEF6; --ink-soft:#A8B4C6; --ink-faint:#96A5BC;
  --terra:#6BA3D6; --terra-deep:#8FBEE6; --terra-soft:#2A3A52; --terra-bg:#16202F;
  --gold:#8FBEE6; --olive:#7FA38C;
  --line:#243248; --line-soft:#1B2536;
  --serif:var(--sans); --book-card-radius:14px; --book-button-radius:12px; --on-terra:#0F1622;
}
/* Les palettes ne doivent jamais remplacer la police arabe du livret. */
.wb[dir="rtl"][data-theme]{ --serif:'Tajawal','Tahoma','Geeza Pro',sans-serif; --sans:var(--serif); }
.wb ::-webkit-scrollbar{ width:0; height:0; }

.wb__scroll{ flex:1; overflow-y:auto; overflow-x:hidden; -webkit-overflow-scrolling:touch; }
.wb__scroll::-webkit-scrollbar{ display:none; }

.wb-serif{ font-family:var(--serif); font-weight:600; letter-spacing:.005em; }
.wb-eyebrow{ font-size:11px; font-weight:700; letter-spacing:.18em; text-transform:uppercase; color:var(--terra-deep); }
.wb-h1{ font-family:var(--serif); font-weight:600; font-size:34px; line-height:1.05; letter-spacing:.005em; }
.wb-h2{ font-family:var(--serif); font-weight:600; font-size:25px; line-height:1.1; }
.wb-lead{ font-size:15px; line-height:1.55; color:var(--ink-soft); }
.wb-label{ font-size:11px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; color:var(--ink-faint); }

.wb-card{ background:var(--surface); border:1px solid var(--line); border-radius:var(--book-card-radius); }
.wb-pressable{ transition:transform .12s cubic-bezier(.4,0,.2,1); -webkit-tap-highlight-color:transparent; cursor:pointer; }
.wb-pressable:active{ transform:scale(.975); }

.wb-chip{ display:inline-flex; align-items:center; gap:7px; padding:8px 14px; border-radius:999px; font-size:13px; font-weight:600;
  background:var(--raised); border:1px solid var(--line); color:var(--ink); cursor:pointer; }

.wb-btn{ display:inline-flex; align-items:center; justify-content:center; gap:8px; border:none; cursor:pointer;
  font-family:var(--sans); font-weight:700; font-size:15px; border-radius:var(--book-button-radius); padding:14px 20px;
  background:var(--terra); color:var(--on-terra); transition:transform .12s, background-color .2s, box-shadow .2s; -webkit-tap-highlight-color:transparent; }
.wb-btn:active{ transform:scale(.975); }
.wb-btn:hover{ background:var(--terra-deep); }
.wb-btn--ghost{ background:transparent; color:var(--terra-deep); border:1.5px solid var(--terra-soft); }
.wb-btn--ghost:hover{ background:var(--terra-bg); }
.wb-btn--soft{ background:var(--terra-bg); color:var(--terra-deep); }
.wb-btn--soft:hover{ background:var(--terra-soft); }
.wb-btn--block{ width:100%; }
.wb button:focus-visible,.wb a:focus-visible{ outline:2px solid var(--terra-deep); outline-offset:3px; }

@keyframes wb-rise{ from{ transform:translateY(14px); } to{ transform:none; } }
.wb-rise{ animation:wb-rise .5s cubic-bezier(.16,1,.3,1); }
@keyframes wb-fade{ from{opacity:0} to{opacity:1} }
@keyframes wb-sheet-in{ from{ transform:translateY(42px);} to{ transform:none; } }
@keyframes wb-bubble-in{ from{ transform:translateY(7px);} to{ transform:none; } }
.wb-bubble{ animation:wb-bubble-in .32s cubic-bezier(.16,1,.3,1); }

@media (prefers-reduced-motion: reduce){
  .wb *{ animation-duration:.01ms !important; transition-duration:.01ms !important; }
}
`;

/** Injecte le CSS scopé `.wb` une seule fois (idempotent par `id`). */
export function injectWelcomeBookCss(): void {
  if (typeof document === 'undefined' || document.getElementById('wb-css')) return;
  const el = document.createElement('style');
  el.id = 'wb-css';
  el.textContent = WELCOME_BOOK_CSS;
  document.head.appendChild(el);
}
