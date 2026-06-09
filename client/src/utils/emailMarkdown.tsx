import React from 'react';

/**
 * Rendu du mini-markdown des emails — miroir client d'`EmailWrapperService` (backend)
 * pour que les aperçus (éditeur de templates, historique des messages) ressemblent à
 * l'email réellement envoyé :
 *   - `**gras**` / `*gras*` → gras, `_italique_` → italique
 *   - double saut de ligne → paragraphe, saut simple → retour à la ligne
 *   - lignes commençant par "• ", "‣ ", "- ", "– " → liste à puces
 *
 * Deux formes :
 *   - `EmailMarkdownPreview` : composant React (nœuds, aucune injection HTML) — pour l'UI.
 *   - `renderEmailMarkdown` : chaîne HTML (entrée échappée) — pour les iframes `srcDoc`.
 */

const INLINE_TOKEN = /(\*\*[^*\n]+?\*\*|\*[^*\n]+?\*|_[^_\n]+?_)/g;

function stripBulletMarker(line: string): string | null {
  if (line.startsWith('• ') || line.startsWith('‣ ') || line.startsWith('- ') || line.startsWith('– ')) {
    return line.slice(2).trim();
  }
  if (line.startsWith('•')) return line.slice(1).trim();
  return null;
}

/** Découpe un paragraphe en blocs texte / liste (les puces consécutives sont regroupées). */
function splitBlocks(paragraph: string): Array<{ kind: 'text' | 'list'; lines: string[] }> {
  const blocks: Array<{ kind: 'text' | 'list'; lines: string[] }> = [];
  for (const rawLine of paragraph.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    const bullet = stripBulletMarker(line);
    const kind = bullet !== null ? 'list' : 'text';
    const value = bullet !== null ? bullet : line;
    const last = blocks[blocks.length - 1];
    if (last && last.kind === kind) last.lines.push(value);
    else blocks.push({ kind, lines: [value] });
  }
  return blocks;
}

// ─── Forme composant React (aucune chaîne HTML) ──────────────────────────────

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const match of text.matchAll(INLINE_TOKEN)) {
    const index = match.index ?? 0;
    if (index > last) nodes.push(text.slice(last, index));
    const token = match[0];
    if (token.startsWith('**')) {
      nodes.push(<strong key={`${keyPrefix}-b${i}`}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('*')) {
      nodes.push(<strong key={`${keyPrefix}-b${i}`}>{token.slice(1, -1)}</strong>);
    } else {
      nodes.push(<em key={`${keyPrefix}-i${i}`}>{token.slice(1, -1)}</em>);
    }
    last = index + token.length;
    i++;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function renderLines(lines: string[], keyPrefix: string): React.ReactNode[] {
  return lines.flatMap((line, idx) => {
    const inline = renderInline(line, `${keyPrefix}-l${idx}`);
    return idx > 0 ? [<br key={`${keyPrefix}-br${idx}`} />, ...inline] : inline;
  });
}

/** Aperçu React du corps d'un email (gras, puces, paragraphes — comme l'email envoyé). */
export function EmailMarkdownPreview({ text }: { text: string }) {
  if (!text) return null;
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return (
    <>
      {paragraphs.map((paragraph, p) =>
        splitBlocks(paragraph).map((block, b) =>
          block.kind === 'list' ? (
            <ul key={`p${p}-b${b}`} style={{ margin: '0 0 14px 0', paddingLeft: 22, lineHeight: 1.6 }}>
              {block.lines.map((item, li) => (
                <li key={li} style={{ margin: '0 0 4px 0' }}>{renderInline(item, `p${p}-b${b}-li${li}`)}</li>
              ))}
            </ul>
          ) : (
            <p key={`p${p}-b${b}`} style={{ margin: '0 0 12px 0', lineHeight: 1.6 }}>
              {renderLines(block.lines, `p${p}-b${b}`)}
            </p>
          )
        )
      )}
    </>
  );
}

// ─── Forme chaîne HTML (pour iframe srcDoc — entrée échappée) ────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Convertit le corps plain text + mini-markdown en HTML (entrée échappée) pour un iframe. */
export function renderEmailMarkdown(text: string): string {
  return renderMarkdownInternal(text, true);
}

/**
 * Variante pour un contenu DÉJÀ traité côté serveur (aperçu d'un message envoyé : les valeurs
 * interpolées sont déjà échappées par TemplateInterpolationService, et certaines variables
 * produisent volontairement du HTML, ex. bouton de paiement). Ne ré-échappe pas — à n'utiliser
 * QUE dans un iframe `sandbox=""` (scripts désactivés).
 */
export function renderServerEmailPreview(text: string): string {
  return renderMarkdownInternal(text, false);
}

function renderMarkdownInternal(text: string, escape: boolean): string {
  if (!text) return '';
  let html = escape ? escapeHtml(text) : text;

  // **gras** en premier pour que "**x**" ne devienne pas "*<strong>x</strong>*".
  html = html.replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*\n]+?)\*/g, '<strong>$1</strong>');
  html = html.replace(/_([^_\n]+?)_/g, '<em>$1</em>');

  return html
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((paragraph) => {
      let out = '';
      let text2: string[] = [];
      let items: string[] = [];
      const flushText = () => {
        if (text2.length) {
          out += `<p style="margin:0 0 12px 0;line-height:1.6;">${text2.join('<br>')}</p>`;
          text2 = [];
        }
      };
      const flushList = () => {
        if (items.length) {
          out += `<ul style="margin:0 0 14px 0;padding-left:22px;line-height:1.6;">${items
            .map((i) => `<li style="margin:0 0 4px 0;">${i}</li>`)
            .join('')}</ul>`;
          items = [];
        }
      };
      for (const rawLine of paragraph.split('\n')) {
        const line = rawLine.trim();
        const bullet = stripBulletMarker(line);
        if (bullet !== null) {
          flushText();
          items.push(bullet);
        } else {
          flushList();
          if (line) text2.push(line);
        }
      }
      flushText();
      flushList();
      return out;
    })
    .join('\n');
}
