import { type ImportedHtml, type TemplateImporter, newReport, escapeHtml } from './TemplateImporter';

/**
 * Adaptateur Markdown → HTML.
 *
 * Détecté AVANT le fallback HTML (cf. `registry`), car du Markdown est aussi du « texte » que
 * l'adaptateur HTML universel accepterait. Petit convertisseur maison (aucune dépendance npm) :
 *   `# … ######`           → `<h1> … <h6>`
 *   `---` / `***` / `___`  → `<hr>`
 *   `- ` / `* ` / `+ `     → `<ul><li>…</li></ul>`
 *   `1. ` / `2. `…         → `<ol><li>…</li></ol>`
 *   `> …`                  → `<blockquote>…</blockquote>`
 *   paragraphes (lignes)   → `<p>…</p>`
 * Inline : `**gras**`/`__gras__`, `*ital*`/`_ital_`, `[texte](url)`, `![alt](src)`, `` `code` ``.
 *
 * Le texte est échappé (`escapeHtml`) AVANT l'application des balises inline (qui réinjectent un
 * markup contrôlé) : pas d'injection possible depuis le contenu utilisateur. Ne jette jamais.
 */

// ─── Détection du format ──────────────────────────────────────────────────────────────────────

/** Image markdown isolée sur une ligne : `![alt](src)`. */
const IMAGE_LINE_RE = /^!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)$/;
/** Marqueur de titre ATX : une à six `#` suivies d'une espace. */
const HEADING_RE = /^(#{1,6})\s+(.*)$/;
/** Marqueur de liste à puces : `- `, `* ` ou `+ ` en début de ligne. */
const UL_RE = /^\s*[-*+]\s+(.*)$/;
/** Marqueur de liste ordonnée : `1. `, `2) `… en début de ligne. */
const OL_RE = /^\s*\d+[.)]\s+(.*)$/;
/** Citation : `> …`. */
const QUOTE_RE = /^\s*>\s?(.*)$/;
/** Règle horizontale : `---`, `***` ou `___` (≥ 3 caractères), seule sur la ligne. */
const HR_RE = /^\s*([-*_])\1{2,}\s*$/;
/** Emphase forte `**gras**` ou `__gras__`. */
const BOLD_RE = /(\*\*|__)(?=\S)[\s\S]+?\1/;
/** Lien markdown `[texte](url)`. */
const LINK_RE = /\[[^\]]*\]\([^)\s]+\)/;

/**
 * Vrai si l'entrée ressemble à du Markdown : PAS de balises HTML de structure dominantes ET présence
 * d'au moins un marqueur de syntaxe Markdown. Le HTML, le JSON et les délimiteurs Gutenberg ont des
 * adaptateurs dédiés prioritaires : on s'efface dès qu'une de ces structures domine.
 */
function detectMarkdown(input: string): boolean {
  const trimmed = (input ?? '').trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return false; // JSON → adaptateurs dédiés.
  if (trimmed.includes('<!-- wp:')) return false; // Gutenberg → adaptateur dédié.
  if (hasDominantHtml(trimmed)) return false; // HTML de structure → adaptateur HTML.
  return trimmed.split(/\r?\n/).some(isMarkdownLine) || BOLD_RE.test(trimmed) || LINK_RE.test(trimmed);
}

/** Vrai si une ligne porte un marqueur Markdown structurel (titre, liste, image, citation). */
function isMarkdownLine(line: string): boolean {
  return (
    HEADING_RE.test(line) ||
    UL_RE.test(line) ||
    OL_RE.test(line) ||
    QUOTE_RE.test(line) ||
    IMAGE_LINE_RE.test(line.trim())
  );
}

/**
 * Vrai si l'entrée est dominée par des balises HTML de structure (≥ 2 balises de bloc). Une poignée
 * d'images/liens Markdown contenant accessoirement un `<br>` ne doit pas basculer en HTML.
 */
function hasDominantHtml(input: string): boolean {
  const blockTags = input.match(
    /<\/?(div|section|article|main|header|footer|nav|table|ul|ol|h[1-6])\b[^>]*>/gi,
  );
  return (blockTags?.length ?? 0) >= 2;
}

// ─── Conversion inline (échappée d'abord, puis balisée) ─────────────────────────────────────────

/**
 * Convertit le markup inline d'une ligne DÉJÀ échappée vers du HTML. L'échappement préalable garantit
 * qu'aucune balise utilisateur ne survit ; on réinjecte ici un markup contrôlé (gras, italique, lien,
 * image, code). L'ordre images → liens évite que `![alt](src)` soit capté comme un lien.
 */
function inlineMarkdown(escaped: string): string {
  let out = escaped;
  // Images `![alt](src)` (avant les liens). L'alt et l'URL sont déjà échappés.
  out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;[^)]*&quot;)?\)/g, (_m, alt, src) => {
    return `<img src="${src}" alt="${alt}" />`;
  });
  // Liens `[texte](url)`.
  out = out.replace(/\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;[^)]*&quot;)?\)/g, (_m, text, href) => {
    return `<a href="${href}">${text}</a>`;
  });
  // Code inline `` `code` ``.
  out = out.replace(/`([^`]+)`/g, (_m, code) => `<code>${code}</code>`);
  // Gras `**…**` / `__…__`.
  out = out.replace(/(\*\*|__)(?=\S)([\s\S]+?)\1/g, (_m, _d, inner) => `<strong>${inner}</strong>`);
  // Italique `*…*` / `_…_`.
  out = out.replace(/(^|[^*])\*(?!\s)([^*]+?)\*(?!\*)/g, (_m, pre, inner) => `${pre}<em>${inner}</em>`);
  out = out.replace(/(^|[^_])_(?!\s)([^_]+?)_(?!_)/g, (_m, pre, inner) => `${pre}<em>${inner}</em>`);
  return out;
}

/** Échappe une ligne brute puis lui applique le markup inline. */
function lineToHtml(raw: string): string {
  return inlineMarkdown(escapeHtml(raw));
}

// ─── Convertisseur ligne à ligne (par blocs) ─────────────────────────────────────────────────────

/**
 * Convertit un texte Markdown en HTML, ligne à ligne. Accumule les listes/citations/paragraphes
 * contigus puis les referme (« flush ») sur changement de contexte ou ligne vide.
 */
function markdownToHtml(input: string): string {
  const lines = input.split(/\r?\n/);
  const out: string[] = [];

  let ulBuffer: string[] = [];
  let olBuffer: string[] = [];
  let quoteBuffer: string[] = [];
  let paraBuffer: string[] = [];

  const flushUl = (): void => {
    if (ulBuffer.length === 0) return;
    out.push(`<ul>${ulBuffer.map((li) => `<li>${li}</li>`).join('')}</ul>`);
    ulBuffer = [];
  };
  const flushOl = (): void => {
    if (olBuffer.length === 0) return;
    out.push(`<ol>${olBuffer.map((li) => `<li>${li}</li>`).join('')}</ol>`);
    olBuffer = [];
  };
  const flushQuote = (): void => {
    if (quoteBuffer.length === 0) return;
    out.push(`<blockquote>${quoteBuffer.map((p) => `<p>${p}</p>`).join('')}</blockquote>`);
    quoteBuffer = [];
  };
  const flushPara = (): void => {
    if (paraBuffer.length === 0) return;
    out.push(`<p>${paraBuffer.join('<br />')}</p>`);
    paraBuffer = [];
  };
  /** Referme tous les blocs en cours (frontière forte : titre, hr, image, ligne vide). */
  const flushAll = (): void => {
    flushUl();
    flushOl();
    flushQuote();
    flushPara();
  };

  for (const line of lines) {
    // Image seule sur une ligne → bloc image (figure légère).
    const imageMatch = line.trim().match(IMAGE_LINE_RE);
    if (imageMatch) {
      flushAll();
      out.push(`<img src="${escapeHtml(imageMatch[1])}" alt="" />`);
      continue;
    }

    // Règle horizontale.
    if (HR_RE.test(line)) {
      flushAll();
      out.push('<hr />');
      continue;
    }

    // Titre ATX.
    const headingMatch = line.match(HEADING_RE);
    if (headingMatch) {
      flushAll();
      const level = headingMatch[1].length;
      out.push(`<h${level}>${lineToHtml(headingMatch[2].trim())}</h${level}>`);
      continue;
    }

    // Liste à puces.
    const ulMatch = line.match(UL_RE);
    if (ulMatch) {
      flushOl();
      flushQuote();
      flushPara();
      ulBuffer.push(lineToHtml(ulMatch[1].trim()));
      continue;
    }

    // Liste ordonnée.
    const olMatch = line.match(OL_RE);
    if (olMatch) {
      flushUl();
      flushQuote();
      flushPara();
      olBuffer.push(lineToHtml(olMatch[1].trim()));
      continue;
    }

    // Citation.
    const quoteMatch = line.match(QUOTE_RE);
    if (quoteMatch && /^\s*>/.test(line)) {
      flushUl();
      flushOl();
      flushPara();
      quoteBuffer.push(lineToHtml(quoteMatch[1].trim()));
      continue;
    }

    // Ligne vide : frontière de paragraphe.
    if (line.trim() === '') {
      flushAll();
      continue;
    }

    // Ligne de texte ordinaire : accumulée dans le paragraphe courant.
    flushUl();
    flushOl();
    flushQuote();
    paraBuffer.push(lineToHtml(line.trim()));
  }

  flushAll();
  return out.join('\n');
}

const markdownImporter: TemplateImporter = {
  id: 'markdown',
  label: 'Markdown',
  detect: detectMarkdown,
  toHtml(input: string): ImportedHtml {
    const report = newReport('markdown');
    const source = input ?? '';
    if (!source.trim()) {
      report.warnings.push('Entrée Markdown vide.');
      return { html: '', report };
    }
    const html = markdownToHtml(source);
    if (!html.trim()) {
      report.warnings.push('Aucun contenu Markdown exploitable.');
    }
    report.notes = 'Markdown converti en HTML ; le style provient du thème du canvas (pas de CSS dédié).';
    return { html, report };
  },
};

export default markdownImporter;
