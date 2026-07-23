import * as React from 'react';
import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

/**
 * Baitly UI — Toaster (copie du registry shadcn/ui new-york-v4, base Sonner).
 * Adaptations locales : le thème est lu depuis <html data-theme> (système
 * Baitly existant) au lieu de next-themes ; tokens --bui-*.
 *
 * À monter UNE fois par app (près de la racine), puis appeler
 * `toast(...)` depuis n'importe où (`import { toast } from 'sonner'`).
 */

function useDocumentTheme(): 'light' | 'dark' {
  const [theme, setTheme] = React.useState<'light' | 'dark'>(() =>
    document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
  );

  React.useEffect(() => {
    const observer = new MutationObserver(() => {
      setTheme(
        document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
      );
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, []);

  return theme;
}

const Toaster = ({ ...props }: ToasterProps) => {
  const theme = useDocumentTheme();

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          '--normal-bg': 'var(--bui-popover)',
          '--normal-text': 'var(--bui-foreground)',
          '--normal-border': 'var(--bui-border)',
          '--border-radius': '0.625rem',
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
