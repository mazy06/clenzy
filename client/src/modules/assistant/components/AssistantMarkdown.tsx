import React from 'react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Typography, useTheme, alpha } from '@mui/material';

interface AssistantMarkdownProps {
  /** Texte markdown produit par le LLM. */
  text: string;
}

/**
 * Renderer markdown pour le texte des messages assistant.
 *
 * <p>Compose les elements MUI au lieu des HTML par defaut pour heriter du
 * theme (typo responsive, palette, espacement). Particularite : les liens
 * relatifs ({@code /xxx}) sont rendus comme {@code <Link>} React Router pour
 * une navigation SPA sans full reload — c'est ce qui permet au LLM de
 * proposer "[Settings IA](/settings?tab=ai)" et que le clic atterrisse
 * directement sur la bonne page.</p>
 *
 * <p>Les liens absolus (http://) s'ouvrent dans un nouvel onglet avec
 * {@code rel="noopener noreferrer"} pour la securite.</p>
 */
export const AssistantMarkdown: React.FC<AssistantMarkdownProps> = ({ text }) => {
  const theme = useTheme();

  // Memo des components MUI pour eviter de les recreer a chaque render
  const components: Components = React.useMemo(() => ({
    // Paragraphes : variante body1 alignee avec le reste de la bulle assistant
    p: ({ children }) => (
      <Typography
        component="p"
        sx={{
          fontSize: '0.9375rem',
          lineHeight: 1.65,
          color: theme.palette.text.primary,
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
          <RouterLink
            to={href}
            style={{
              color: theme.palette.primary.main,
              fontWeight: 500,
              textDecoration: 'none',
              borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.35)}`,
              transition: 'border-color 180ms ease-out',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderBottomColor = theme.palette.primary.main;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderBottomColor = alpha(theme.palette.primary.main, 0.35);
            }}
          >
            {children}
          </RouterLink>
        );
      }
      return (
        <Box
          component="a"
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          sx={{
            color: theme.palette.primary.main,
            fontWeight: 500,
            textDecoration: 'none',
            borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.35)}`,
            transition: 'border-color 180ms ease-out',
            '&:hover': { borderBottomColor: theme.palette.primary.main },
          }}
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
        fontSize: '0.9375rem',
        lineHeight: 1.55,
        color: theme.palette.text.primary,
      }}>
        {children}
      </Box>
    ),

    // Emphase
    strong: ({ children }) => (
      <Box component="strong" sx={{ fontWeight: 600, color: theme.palette.text.primary }}>
        {children}
      </Box>
    ),
    em: ({ children }) => (
      <Box component="em" sx={{ fontStyle: 'italic' }}>{children}</Box>
    ),

    // Code inline : background tonal subtil
    code: ({ children }) => (
      <Box component="code" sx={{
        px: 0.5, py: 0.125,
        borderRadius: 0.5,
        bgcolor: alpha(theme.palette.text.primary, 0.06),
        fontFamily: 'monospace',
        fontSize: '0.85em',
      }}>
        {children}
      </Box>
    ),

    // Headings : poids et taille adaptes au flow inline
    h1: ({ children }) => (
      <Typography component="h2" sx={{
        fontSize: '1.05rem', fontWeight: 700, mt: 1.5, mb: 0.5,
        color: theme.palette.text.primary,
      }}>{children}</Typography>
    ),
    h2: ({ children }) => (
      <Typography component="h3" sx={{
        fontSize: '1rem', fontWeight: 700, mt: 1.5, mb: 0.5,
        color: theme.palette.text.primary,
      }}>{children}</Typography>
    ),
    h3: ({ children }) => (
      <Typography component="h4" sx={{
        fontSize: '0.95rem', fontWeight: 600, mt: 1.25, mb: 0.25,
        color: theme.palette.text.primary,
      }}>{children}</Typography>
    ),

    // Blockquote (citation)
    blockquote: ({ children }) => (
      <Box sx={{
        my: 1,
        pl: 1.5,
        py: 0.5,
        borderRadius: 0.5,
        bgcolor: alpha(theme.palette.text.primary, 0.035),
      }}>
        {children}
      </Box>
    ),
  }), [theme]);

  return <ReactMarkdown components={components}>{text}</ReactMarkdown>;
};
