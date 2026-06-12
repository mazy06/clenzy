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
const linkSx = {
  color: 'var(--accent)',
  fontWeight: 600,
  textDecoration: 'none',
  borderBottom: '1px solid color-mix(in srgb, var(--accent) 35%, transparent)',
  transition: 'border-color .15s',
  '&:hover': { borderBottomColor: 'var(--accent)' },
  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
} as const;

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
          <Box component={RouterLink} to={href} sx={linkSx}>
            {children}
          </Box>
        );
      }
      return (
        <Box
          component="a"
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          sx={linkSx}
        >
          {children}
        </Box>
      );
    },

    // Listes : tight, bullets discrets
    ul: ({ children }) => (
      <Box component="ul" sx={{
        pl: 2.5, my: 1,
        '& li': { mb: 0.25 },
      }}>
        {children}
      </Box>
    ),
    ol: ({ children }) => (
      <Box component="ol" sx={{
        pl: 2.5, my: 1,
        '& li': { mb: 0.25 },
      }}>
        {children}
      </Box>
    ),
    li: ({ children }) => (
      <Box component="li" sx={{
        fontSize: 13,
        lineHeight: 1.55,
        color: 'var(--body)',
      }}>
        {children}
      </Box>
    ),

    // Emphase
    strong: ({ children }) => (
      <Box component="strong" sx={{ fontWeight: 600, color: 'var(--ink)' }}>
        {children}
      </Box>
    ),
    em: ({ children }) => (
      <Box component="em" sx={{ fontStyle: 'italic' }}>{children}</Box>
    ),

    // Code inline : fond champ dé-bleui
    code: ({ children }) => (
      <Box component="code" sx={{
        px: 0.5, py: 0.125,
        borderRadius: '5px',
        bgcolor: 'var(--field)',
        border: '1px solid var(--line)',
        fontFamily: 'monospace',
        fontSize: '0.85em',
      }}>
        {children}
      </Box>
    ),

    // Headings : display, poids et taille adaptes au flow inline
    h1: ({ children }) => (
      <Typography component="h2" sx={{
        fontFamily: 'var(--font-display)',
        fontSize: 16, fontWeight: 600, mt: 1.5, mb: 0.5,
        color: 'var(--ink)',
      }}>{children}</Typography>
    ),
    h2: ({ children }) => (
      <Typography component="h3" sx={{
        fontFamily: 'var(--font-display)',
        fontSize: 14.5, fontWeight: 600, mt: 1.5, mb: 0.5,
        color: 'var(--ink)',
      }}>{children}</Typography>
    ),
    h3: ({ children }) => (
      <Typography component="h4" sx={{
        fontSize: 13.5, fontWeight: 600, mt: 1.25, mb: 0.25,
        color: 'var(--ink)',
      }}>{children}</Typography>
    ),

    // Blockquote (citation)
    blockquote: ({ children }) => (
      <Box sx={{
        my: 1,
        pl: 1.5,
        py: 0.5,
        borderRadius: '6px',
        bgcolor: 'var(--hover)',
      }}>
        {children}
      </Box>
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
    <Box dir={arabicDirProp(text)}>
      <ReactMarkdown components={components}>{text}</ReactMarkdown>
    </Box>
  );
};
