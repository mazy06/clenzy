import { describe, it, expect } from 'vitest';
import { sanitizeHtml, sanitizeCss } from '../sanitizeHtml';

/**
 * Vecteurs XSS ciblés sur l'assainisseur regex (sans dépendance npm). Ces tests décrivent le
 * CONTRAT de sécurité minimal attendu avant injection dans le DOM / GrapesJS. Un vecteur encore
 * exploitable après assainissement = bug (et nécessiterait DOMPurify pour une couverture stricte).
 *
 * Méthode d'assertion : on REPARSE le HTML assaini via `DOMParser` (arbre DOM réel, sans `innerHTML`)
 * et on vérifie qu'AUCUN nœud actif dangereux (script/iframe/object) ni handler `on*` ne survit, en
 * plus de l'inspection de la chaîne. DOMParser n'exécute pas le JS injecté mais reconstruit l'arbre
 * tel que le navigateur le verrait (`setComponents` reparse également le HTML) : meilleur proxy local.
 */

function parse(safe: string): Document {
  return new DOMParser().parseFromString(safe, 'text/html');
}

describe('sanitizeHtml — contenu légitime préservé', () => {
  it('conserve le HTML structurel ordinaire', () => {
    const input = '<section><h1>Titre</h1><p>Bonjour <strong>monde</strong></p></section>';
    expect(sanitizeHtml(input)).toBe(input);
  });

  it('conserve les liens http(s) et ancres', () => {
    const input = '<a href="https://example.com/page?x=1">lien</a><a href="#anchor">interne</a>';
    expect(sanitizeHtml(input)).toBe(input);
  });

  it('conserve les images data:image légitimes (inline)', () => {
    const input = '<img src="data:image/png;base64,iVBORw0KGgo=" alt="px" />';
    expect(sanitizeHtml(input)).toContain('data:image/png');
  });

  it('conserve les attributs style légitimes', () => {
    const input = '<div style="color:#6B8A9A;padding:8px;background:url(/img/bg.png)">x</div>';
    expect(sanitizeHtml(input)).toBe(input);
  });

  it('renvoie une chaîne vide pour une entrée vide / null', () => {
    expect(sanitizeHtml('')).toBe('');
    expect(sanitizeHtml(null as unknown as string)).toBe('');
    expect(sanitizeHtml(undefined as unknown as string)).toBe('');
  });
});

describe('sanitizeHtml — balises exécutables / d\'intégration', () => {
  it('retire <script> et son contenu', () => {
    const safe = sanitizeHtml('<p>ok</p><script>alert(1)</script>');
    expect(safe).not.toMatch(/<script/i);
    expect(safe).not.toContain('alert(1)');
    expect(parse(safe).querySelector('script')).toBeNull();
  });

  it('retire <script> avec attributs et espaces irréguliers', () => {
    const safe = sanitizeHtml('<SCRIPT  type="text/javascript" >evil()</SCRIPT >');
    expect(safe).not.toMatch(/<script/i);
    expect(parse(safe).querySelector('script')).toBeNull();
  });

  it('retire <iframe> (avec et sans fermeture)', () => {
    expect(parse(sanitizeHtml('<iframe src="https://evil"></iframe>')).querySelector('iframe')).toBeNull();
    expect(parse(sanitizeHtml('<iframe src="https://evil">')).querySelector('iframe')).toBeNull();
  });

  it('retire <object> et <embed>', () => {
    const doc = parse(sanitizeHtml('<object data="x.swf"></object><embed src="y.swf">'));
    expect(doc.querySelector('object')).toBeNull();
    expect(doc.querySelector('embed')).toBeNull();
  });
});

describe('sanitizeHtml — handlers d\'événements', () => {
  it('retire onclick / onerror / onload', () => {
    const safe = sanitizeHtml('<img src="x" onerror="alert(1)"><div onclick="steal()">x</div>');
    expect(safe).not.toMatch(/onerror=/i);
    expect(safe).not.toMatch(/onclick=/i);
    const img = parse(safe).querySelector('img');
    expect(img?.getAttribute('onerror')).toBeNull();
  });

  it('retire un handler avec valeur non quotée', () => {
    const safe = sanitizeHtml('<body onload=alert(1)>');
    expect(safe).not.toMatch(/onload/i);
  });
});

describe('sanitizeHtml — schémas d\'URL dangereux', () => {
  it('neutralise href="javascript:…"', () => {
    const safe = sanitizeHtml('<a href="javascript:alert(1)">x</a>');
    expect(safe).not.toMatch(/javascript:/i);
    expect(parse(safe).querySelector('a')?.getAttribute('href')).not.toMatch(/javascript:/i);
  });

  it('neutralise src="vbscript:…"', () => {
    const safe = sanitizeHtml('<img src="vbscript:msgbox(1)">');
    expect(safe).not.toMatch(/vbscript:/i);
  });

  it('neutralise data: non-image (data:text/html)', () => {
    const safe = sanitizeHtml('<a href="data:text/html,<script>alert(1)</script>">x</a>');
    expect(safe).not.toMatch(/data:text\/html/i);
  });

  it('neutralise javascript: avec espaces / casse mixte', () => {
    const safe = sanitizeHtml('<a href="  JaVaScRiPt:alert(1)">x</a>');
    expect(safe).not.toMatch(/javascript:/i);
  });
});

// ─── Vecteurs de durcissement (au-delà du regex naïf) ──────────────────────────────────────────

describe('sanitizeHtml — durcissement : entités HTML encodées', () => {
  it('ne ré-forme pas une balise <script> via entités numériques après reparse', () => {
    // Vecteur : &#60;script&#62; → si décodé naïvement et réinjecté, une balise active naîtrait.
    const safe = sanitizeHtml('&#60;script&#62;alert(1)&#60;/script&#62;');
    expect(parse(safe).querySelector('script')).toBeNull();
  });

  it('ne ré-forme pas javascript: via entités encodées dans un href', () => {
    // &#106;avascript: == javascript: une fois décodé par le navigateur dans un href.
    const safe = sanitizeHtml('<a href="&#106;avascript:alert(1)">x</a>');
    const href = parse(safe).querySelector('a')?.getAttribute('href') ?? '';
    expect(href.toLowerCase()).not.toMatch(/javascript:/);
  });

  it('ne ré-forme pas javascript: via &#x6a; (hex) dans un href', () => {
    const safe = sanitizeHtml('<a href="&#x6a;avascript:alert(1)">x</a>');
    const href = parse(safe).querySelector('a')?.getAttribute('href') ?? '';
    expect(href.toLowerCase()).not.toMatch(/javascript:/);
  });

  it('ne ré-forme pas javascript: via tabulation intégrée (jav\\tascript:)', () => {
    const safe = sanitizeHtml('<a href="jav\tascript:alert(1)">x</a>');
    const href = parse(safe).querySelector('a')?.getAttribute('href') ?? '';
    expect(href.toLowerCase().replace(/\s/g, '')).not.toMatch(/javascript:/);
  });
});

describe('sanitizeHtml — durcissement : attribut style', () => {
  it('neutralise style="…expression(…)…" (IE legacy)', () => {
    const safe = sanitizeHtml('<div style="width:expression(alert(1))">x</div>');
    expect(safe.toLowerCase()).not.toMatch(/expression\s*\(/);
  });

  it('neutralise style="background:url(javascript:…)"', () => {
    const safe = sanitizeHtml('<div style="background:url(javascript:alert(1))">x</div>');
    expect(safe.toLowerCase()).not.toMatch(/javascript:/);
  });
});

// ─── sanitizeCss ────────────────────────────────────────────────────────────────────────────

describe('sanitizeCss', () => {
  it('conserve le CSS légitime', () => {
    const css = '.btn{color:#fff;padding:8px}';
    expect(sanitizeCss(css)).toBe(css);
  });

  it('casse une balise </style> sortie de contexte', () => {
    const safe = sanitizeCss('.x{} </style><script>alert(1)</script>');
    expect(safe).not.toMatch(/<\/?style/i);
  });

  it('neutralise expression(...)', () => {
    expect(sanitizeCss('.x{width:expression(alert(1))}').toLowerCase()).not.toMatch(/expression\s*\(/);
  });

  it('neutralise url(javascript:…) et url(vbscript:…)', () => {
    expect(sanitizeCss('.x{background:url(javascript:alert(1))}').toLowerCase()).not.toMatch(/javascript:/);
    expect(sanitizeCss('.x{background:url(vbscript:alert(1))}').toLowerCase()).not.toMatch(/vbscript:/);
  });

  it('neutralise url("data:text/html,…") dans le CSS', () => {
    const safe = sanitizeCss('.x{background:url("data:text/html,<script>")}');
    expect(safe.toLowerCase()).not.toMatch(/data:text\/html/);
  });

  it('renvoie une chaîne vide pour une entrée vide', () => {
    expect(sanitizeCss('')).toBe('');
    expect(sanitizeCss(null as unknown as string)).toBe('');
  });
});
