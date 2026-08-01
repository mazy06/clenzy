import React from 'react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Typography } from '@mui/material';
import { isArabicHeavy, arabicTextSx, arabicDirProp } from '../../../utils/textDirection';

interface AssistantMarkdownProps {
  /** Texte markdown produit par le LLM. */
  text: string;
}

/** Style commun des liens (internes + externes) — accent + soulignement doux. */
const LINK_CLASS =
  'text-[var(--accent)] font-semibold no-underline border-b border-solid ' +
  'border-b-[color-mix(in_srgb,var(--accent)_35%,transparent)] ' +
  'transition-[border-color] duration-150 hover:border-b-[var(--accent)] motion-reduce:transition-none';

/**
 * Renderer markdown pour le texte des messages assistant.
 *
 * <p>Compose les elements MUI au lieu des HTML par defaut pour heriter du
 * theme (typo, tokens Signature, espacement). Particularite : les liens
 * relatifs ({@code /xxx}) sont rendus comme {@code <Link>} React Router pour
 * une navigation SPA sans full reload — c'est ce qui permet au LLM de
 * proposer "[Settings IA](/settings?tab=ai)" et que le clic atterrisse
 * directement sur la bonne page.</p>
 *
 * <p>Les liens absolus (http://) s'ouvrent dans un nouvel onglet avec
 * {@code rel="noopener noreferrer"} pour la securite.</p>
 */
export const AssistantMarkdown: React.FC<AssistantMarkdownProps> = ({ text }) => {
  // Memo des components MUI pour eviter de les recreer a chaque render
  const components: Components = React.useMemo(() => ({
    // Paragraphes : corps 13px aligne avec la bulle assistant
    p: ({ children }) => (
      <Typography
        component="p"
        sx={{
          fontSize: 13,
          lineHeight: 1.6,
          color: 'var(--body)',
          mb: 1,
          '&:last-child': { mb: 0 },
        }}
      >
        {children}
      </Typography>
    ),

    // Liens : Router pour les routes internes, target="_blank" pour les externes
    a: ({ href, children }) => {
      if (!href) return <>{children}</>;
      const isInternal = href.startsWith('/');
      if (isInternal) {
        return (
          <RouterLink to={href} className={LINK_CLASS}>
            {children}
          </RouterLink>
        );
      }
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={LINK_CLASS}
        >
          {children}
        </a>
      );
    },

    // Listes : tight, bullets discrets
    // `ps-` (logique) et non `pl-` : les classes Tailwind ne passent pas par le
    // plugin RTL d'Emotion qui retournait le `pl` du sx d'origine en arabe.
    ul: ({ children }) => (
      <ul className="ps-[15px] my-1.5 [&_li]:mb-[1.5px]">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="ps-[15px] my-1.5 [&_li]:mb-[1.5px]">
        {children}
      </ol>
    ),
    li: ({ children }) => (
      <li className="text-[13px] leading-[1.55] text-[var(--body)]">
        {children}
      </li>
    ),

    // Emphase
    strong: ({ children }) => (
      <strong className="font-semibold text-[var(--ink)]">
        {children}
      </strong>
    ),
    em: ({ children }) => (
      <em className="italic">{children}</em>
    ),

    // Code inline : fond champ dé-bleui
    code: ({ children }) => (
      <code className="px-0.5 py-0 rounded-[5px] bg-[var(--field)] border border-[var(--line)] font-mono text-[0.85em]">
        {children}
      </code>
    ),

    // Headings : display, poids et taille adaptes au flow inline
    h1: ({ children }) => (
      <h2 className="font-[var(--font-display)] text-[16px] font-semibold mt-2 mb-0.5 text-[var(--ink)]">{children}</h2>
    ),
    h2: ({ children }) => (
      <h3 className="font-[var(--font-display)] text-[14.5px] font-semibold mt-2 mb-0.5 text-[var(--ink)]">{children}</h3>
    ),
    h3: ({ children }) => (
      <h4 className="text-[13.5px] font-semibold mt-2 mb-0.5 text-[var(--ink)]">{children}</h4>
    ),

    // Blockquote (citation)
    blockquote: ({ children }) => (
      <div className="my-1.5 ps-2 py-0.5 rounded-[6px] bg-[var(--hover)]">
        {children}
      </div>
    ),
  }), []);

  // Adaptation typographique RTL : si le contenu est majoritairement arabe,
  // wrap dans un container dir="rtl" + sx augmente (+18% fontSize, line-height
  // 1.85, font-family priorisant Tahoma/Geeza Pro). Sinon LTR par defaut.
  const arabic = isArabicHeavy(text);
  if (arabic) {
    return (
      <Box dir="rtl" sx={{ ...arabicTextSx, textAlign: 'right' }}>
        <ReactMarkdown components={components}>{text}</ReactMarkdown>
      </Box>
    );
  }
  // Texte avec quelques mots arabes au milieu (ex: nom propre) : pas de wrap
  // global, mais le navigateur applique l'isolation bidirectionnelle unicode
  // automatiquement sur les caracteres arabes detectes.
  return (
    <div dir={arabicDirProp(text)}>
      <ReactMarkdown components={components}>{text}</ReactMarkdown>
    </div>
  );
};
