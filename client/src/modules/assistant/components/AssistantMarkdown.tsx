import React from 'react';
import { cn } from '../../../utils/cn';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import { Link as RouterLink } from 'react-router-dom';
import { isArabicHeavy, arabicTextSx, arabicDirProp } from '../../../utils/textDirection';

interface AssistantMarkdownProps {
  /** Texte markdown produit par le LLM. */
  text: string;
}

/** Style commun des liens (internes + externes) — accent + soulignement doux. */
const LINK_CLASS =
  'font-medium text-primary no-underline border-b border-solid border-primary/35 ' +
  'transition-[border-color] duration-150 hover:border-primary motion-reduce:transition-none';

/**
 * Renderer markdown pour le texte des messages assistant.
 *
 * <p>Compose des balises HTML habillees par les tokens Signature (typo,
 * couleurs, espacement). Particularite : les liens
 * relatifs ({@code /xxx}) sont rendus comme {@code <Link>} React Router pour
 * une navigation SPA sans full reload — c'est ce qui permet au LLM de
 * proposer "[Settings IA](/settings?tab=ai)" et que le clic atterrisse
 * directement sur la bonne page.</p>
 *
 * <p>Les liens absolus (http://) s'ouvrent dans un nouvel onglet avec
 * {@code rel="noopener noreferrer"} pour la securite.</p>
 */
export const AssistantMarkdown: React.FC<AssistantMarkdownProps> = ({ text }) => {
  // Memo des renderers pour eviter de les recreer a chaque render
  const components: Components = React.useMemo(() => ({
    // Paragraphes : la taille vient de la bulle (.cn-message = text-sm)
    p: ({ children }) => (
      <p className="mb-1.5 leading-relaxed last:mb-0">
        {children}
      </p>
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
      <li className="leading-relaxed">
        {children}
      </li>
    ),

    // Emphase
    strong: ({ children }) => (
      <strong className="font-semibold text-foreground">
        {children}
      </strong>
    ),
    em: ({ children }) => (
      <em className="italic">{children}</em>
    ),

    // Code inline
    code: ({ children }) => (
      <code className="rounded border border-border bg-muted px-0.5 font-mono text-[0.85em]">
        {children}
      </code>
    ),

    // Titres : adaptes au flux inline d'une bulle
    h1: ({ children }) => (
      <h2 className="mt-2 mb-0.5 text-base font-semibold text-foreground">{children}</h2>
    ),
    h2: ({ children }) => (
      <h3 className="mt-2 mb-0.5 text-sm font-semibold text-foreground">{children}</h3>
    ),
    h3: ({ children }) => (
      <h4 className="mt-2 mb-0.5 text-sm font-semibold text-foreground">{children}</h4>
    ),

    // Citation
    blockquote: ({ children }) => (
      <div className="my-1.5 rounded-md bg-muted px-2 py-1 italic">
        {children}
      </div>
    ),
  }), []);

  // Adaptation typographique RTL : si le contenu est majoritairement arabe,
  // wrap dans un container dir="rtl" + taille augmentee (fontSize, line-height,
  // font-family priorisant Tajawal/Tahoma/Geeza Pro). Sinon LTR par defaut.
  // `arabicTextSx` est un objet CSS plat : il s'applique tel quel en style inline.
  const arabic = isArabicHeavy(text);
  if (arabic) {
    return (
      <div dir="rtl" style={{ ...arabicTextSx, textAlign: 'right' }}>
        <ReactMarkdown components={components}>{text}</ReactMarkdown>
      </div>
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
