import { useRef, useState, type KeyboardEvent } from 'react';
import { Box, ButtonBase } from '@mui/material';
import { keyframes } from '@mui/system';
import { Globe, Loader2 } from 'lucide-react';
import type { Editor } from 'grapesjs';
import { siteImportApi } from '../../../../services/api/siteImportApi';
import type { BookingEngineConfig } from '../../../../services/api/bookingEngineApi';
import { loadHtmlIntoEditor } from './loadIntoEditor';

/**
 * Onglet « Depuis une URL » de l'Importer.
 *
 * Migre la logique de l'ancienne commande d'import URL (modale GrapesJS en DOM brut, désormais retirée)
 * vers un composant React aligné sur le design system du Studio. Comportement :
 *   1. valide l'URL côté client (HTTPS only — l'anti-SSRF réel est côté serveur, cf. règle sécurité #5) ;
 *   2. POST /api/sites/{siteId}/import-url via `siteImportApi` : le SERVEUR fetch le HTML/CSS (jamais le
 *      navigateur : CORS + SSRF) et renvoie `{ html, css }` ;
 *   3. injecte via `loadHtmlIntoEditor` (ré-assaini avant `setComponents` + `Css.addRules`) ;
 *   4. `onDone()` (ferme le panneau) en cas de succès.
 *
 * ⚠️ NON VÉRIFIÉ AU NAVIGATEUR (login Keycloak requis) : enchaînement réseau → injection à valider.
 */
export interface ImportFromUrlProps {
  /** Éditeur GrapesJS cible (injection du contenu importé). */
  editor: Editor;
  /** Config courante du widget (résolution du site cible : scope org + ownership). */
  config: BookingEngineConfig | null;
  /** Appelé après un import réussi (ferme le panneau). */
  onDone: () => void;
}

/**
 * Valide une URL saisie : non vide, parsable et en HTTPS uniquement. (La défense profonde — blocage
 * RFC 1918, résolution DNS, taille — reste côté serveur.)
 */
/** Rotation continue de l'indicateur de chargement (respecte `prefers-reduced-motion` via le navigateur). */
const spin = keyframes`from { transform: rotate(0deg); } to { transform: rotate(360deg); }`;

function isValidHttpsUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  try {
    return new URL(trimmed).protocol === 'https:';
  } catch {
    return false;
  }
}

export default function ImportFromUrl({ editor, config, onDone }: ImportFromUrlProps) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Annule l'import en cours si l'utilisateur change d'onglet / ferme avant la réponse.
  const abortRef = useRef<AbortController | null>(null);

  const runImport = () => {
    if (loading) return;
    if (!isValidHttpsUrl(url)) {
      setError('Saisissez une URL valide commençant par https://');
      return;
    }
    setError(null);
    setLoading(true);
    const abort = new AbortController();
    abortRef.current = abort;
    siteImportApi
      .importFromUrl({ url: url.trim(), configId: config?.id }, abort.signal)
      .then(({ html, css }) => {
        loadHtmlIntoEditor(editor, { html: html ?? '', css: css ?? '' });
        onDone();
      })
      .catch((err: unknown) => {
        if (abort.signal.aborted) return; // changement d'onglet / fermeture : silencieux
        const message =
          err && typeof err === 'object' && 'message' in err && typeof err.message === 'string'
            ? err.message
            : "Échec de l'import. Vérifiez l'URL et réessayez.";
        setError(message);
        setLoading(false);
      });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      runImport();
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={{ fontSize: 'var(--text-sm)', color: 'var(--muted)', lineHeight: 1.5 }}>
        Le contenu (HTML + styles) est récupéré par le serveur puis assaini avant d'être chargé dans
        l'éditeur. Le canevas actuel sera remplacé.
      </Box>

      <Box sx={{ position: 'relative' }}>
        <Box component="span" sx={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--faint)', display: 'inline-flex', pointerEvents: 'none' }}>
          <Globe size={16} strokeWidth={2} />
        </Box>
        <Box
          component="input"
          type="url"
          value={url}
          disabled={loading}
          placeholder="https://exemple.com/ma-page"
          autoComplete="off"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUrl(e.target.value)}
          onKeyDown={onKeyDown}
          sx={{
            width: '100%', height: 42, pl: 4.5, pr: 1.5, fontSize: 'var(--text-md)', color: 'var(--ink)',
            bgcolor: 'var(--field)', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)',
            outline: 'none', '&:focus': { borderColor: 'var(--accent)' }, '&:disabled': { opacity: 0.6 },
          }}
        />
      </Box>

      {error ? <Box sx={{ fontSize: 'var(--text-sm)', color: 'var(--err, #c0392b)' }} role="alert">{error}</Box> : null}

      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <ButtonBase
          onClick={runImport}
          disabled={loading || !url.trim()}
          sx={{
            display: 'inline-flex', alignItems: 'center', gap: 0.75, px: 2.5, height: 40,
            borderRadius: 'var(--radius-md)', bgcolor: 'var(--accent)', color: 'var(--on-accent)',
            fontWeight: 'var(--fw-semibold)', fontSize: 'var(--text-md)', cursor: 'pointer',
            '&.Mui-disabled': { opacity: 0.5 }, '&:hover': { bgcolor: 'var(--accent-deep, var(--accent))' },
          }}
        >
          {loading ? <Box sx={{ display: 'inline-flex', animation: `${spin} 0.8s linear infinite` }}><Loader2 size={15} strokeWidth={2} /></Box> : null}
          {loading ? 'Import en cours…' : 'Importer'}
        </ButtonBase>
      </Box>
    </Box>
  );
}
