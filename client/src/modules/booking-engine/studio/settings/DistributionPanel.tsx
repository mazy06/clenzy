import { useState } from 'react';
import { Box, ButtonBase, InputBase, Skeleton } from '@mui/material';
import { Copy, Check, ExternalLink, Eye, EyeOff, RefreshCw, AlertTriangle, Globe, Code2, Terminal } from 'lucide-react';
import type { StudioConfigState } from '../useStudioConfig';
import { SettingsPage, SettingCard, SettingRow, ToggleControl } from './settingsControls';

/**
 * Section « Diffusion » du Studio (F5) — trois modes réels de mise en ligne :
 * site hébergé (URL publique), widget intégrable (snippet SDK), et accès SDK / API (clé).
 * Tous les artefacts dérivent de la config réelle (apiKey, enabled) ; clé gérée via le hook.
 */

export interface DistributionPanelProps {
  cfg: StudioConfigState;
}

export default function DistributionPanel({ cfg }: DistributionPanelProps) {
  const { config } = cfg;
  const [showKey, setShowKey] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [regenConfirm, setRegenConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  if (cfg.loading || !config) {
    return (
      <Box sx={{ maxWidth: 720, mx: 'auto', px: 4, py: 4 }}>
        {cfg.error
          ? <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 2, borderRadius: 'var(--radius-md)', bgcolor: 'var(--err-soft)', color: 'var(--err)', fontSize: 'var(--text-sm)' }}><AlertTriangle size={18} /> {cfg.error}</Box>
          : [0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={150} sx={{ mb: 2.5, borderRadius: 'var(--radius-lg)', bgcolor: 'var(--hover)' }} />)}
      </Box>
    );
  }

  const origin = window.location.origin;
  const apiKey = config.apiKey;
  const hostedUrl = `${origin}/booking/${apiKey}`;
  const embedCode = `<!-- Baitly Booking Engine -->
<div id="clenzy-booking-engine" data-api-key="${apiKey}"></div>
<script src="${origin}/sdk/booking-engine.js" async></script>`;
  const iframeCode = `<iframe
  src="${hostedUrl}"
  width="100%" height="800" frameborder="0"
  allow="payment" style="border:none;border-radius:8px;">
</iframe>`;
  const sdkCode = `import { ClenzyBooking } from '@clenzy/booking-sdk';

const booking = new ClenzyBooking({
  org: 'votre-organisation',
  apiKey: '${apiKey}',
});
const properties = await booking.getProperties();`;

  const copy = (id: string, text: string) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1800);
    }).catch(() => { /* clipboard indisponible */ });
  };

  const onToggle = (enabled: boolean) => {
    setBusy(true);
    cfg.setEnabled(enabled).catch(() => { /* erreur exposée par le hook */ }).finally(() => setBusy(false));
  };

  const onRegenerate = () => {
    setRegenConfirm(false);
    setBusy(true);
    cfg.regenerateKey().catch(() => { /* erreur exposée par le hook */ }).finally(() => setBusy(false));
  };

  return (
    <SettingsPage title="Diffusion" description="Mettez votre booking engine en ligne : page hébergée, widget ou intégration sur mesure.">
      <SettingCard title="Statut" description="Tant qu'il est désactivé, le booking engine ne répond pas aux requêtes publiques.">
        <SettingRow
          label="Booking engine actif"
          helper={config.enabled ? 'En ligne et accessible.' : 'Hors ligne.'}
          control={<ToggleControl checked={config.enabled} onChange={onToggle} />}
        />
      </SettingCard>

      {cfg.error && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5, p: 1.5, borderRadius: 'var(--radius-md)', bgcolor: 'var(--err-soft)', color: 'var(--err)', fontSize: 'var(--text-sm)' }}>
          <AlertTriangle size={16} /> {cfg.error}
        </Box>
      )}

      <SettingCard title="Site hébergé" description="Une page de réservation prête à l'emploi, sans rien installer.">
        <Box sx={{ py: 1.5, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'inline-flex', color: 'var(--accent)' }}><Globe size={18} strokeWidth={2} /></Box>
          <Box sx={{ flex: 1, minWidth: 220, fontFamily: 'var(--font-mono, monospace)', fontSize: 'var(--text-sm)', color: 'var(--body)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {hostedUrl}
          </Box>
          <ButtonBase onClick={() => copy('hosted', hostedUrl)} sx={miniBtnSx}>
            {copiedId === 'hosted' ? <Check size={14} strokeWidth={2.4} /> : <Copy size={14} strokeWidth={2} />}
            {copiedId === 'hosted' ? 'Copié' : 'Copier'}
          </ButtonBase>
          <Box component="a" href={hostedUrl} target="_blank" rel="noopener noreferrer" sx={{ ...miniBtnSx, textDecoration: 'none' }}>
            <ExternalLink size={14} strokeWidth={2} /> Ouvrir
          </Box>
        </Box>
      </SettingCard>

      <SettingCard title="Widget intégrable" description="Collez ce code dans votre site pour afficher le moteur de réservation.">
        <Box sx={{ py: 1.5 }}>
          <CodeBlock icon={Code2} code={embedCode} copied={copiedId === 'embed'} onCopy={() => copy('embed', embedCode)} />
          <Box sx={{ fontSize: 'var(--text-2xs)', color: 'var(--faint)', mt: 1.5, mb: 0.75 }}>Ou en iframe :</Box>
          <CodeBlock code={iframeCode} copied={copiedId === 'iframe'} onCopy={() => copy('iframe', iframeCode)} />
        </Box>
      </SettingCard>

      <SettingCard title="SDK & API" description="Pour une intégration sur mesure dans votre application.">
        <SettingRow
          label="Clé API"
          helper="Authentifie vos requêtes. Régénérer invalide l'ancienne clé immédiatement."
          control={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, width: '100%' }}>
              <InputBase
                value={apiKey}
                readOnly
                type={showKey ? 'text' : 'password'}
                sx={{ flex: 1, px: 1.25, py: 0.5, fontFamily: 'var(--font-mono, monospace)', fontSize: 'var(--text-sm)', color: 'var(--ink)', bgcolor: 'var(--field)', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)' }}
              />
              <IconBtn label={showKey ? 'Masquer' : 'Afficher'} onClick={() => setShowKey((s) => !s)}>
                {showKey ? <EyeOff size={15} strokeWidth={2} /> : <Eye size={15} strokeWidth={2} />}
              </IconBtn>
              <IconBtn label="Copier la clé" onClick={() => copy('key', apiKey)}>
                {copiedId === 'key' ? <Check size={15} strokeWidth={2.4} /> : <Copy size={15} strokeWidth={2} />}
              </IconBtn>
            </Box>
          }
        />
        <Box sx={{ py: 1.5 }}>
          <CodeBlock icon={Terminal} code={sdkCode} copied={copiedId === 'sdk'} onCopy={() => copy('sdk', sdkCode)} />
        </Box>
        <Box sx={{ pb: 1.75, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          {regenConfirm ? (
            <>
              <Box sx={{ fontSize: 'var(--text-sm)', color: 'var(--err)' }}>L'ancienne clé cessera de fonctionner. Confirmer ?</Box>
              <ButtonBase onClick={onRegenerate} disabled={busy} sx={{ ...miniBtnSx, color: 'var(--err)', borderColor: 'var(--err)' }}>Oui, régénérer</ButtonBase>
              <ButtonBase onClick={() => setRegenConfirm(false)} sx={miniBtnSx}>Annuler</ButtonBase>
            </>
          ) : (
            <ButtonBase onClick={() => setRegenConfirm(true)} disabled={busy} sx={miniBtnSx}>
              <RefreshCw size={14} strokeWidth={2} /> Régénérer la clé
            </ButtonBase>
          )}
        </Box>
      </SettingCard>
    </SettingsPage>
  );
}

function CodeBlock({ code, onCopy, copied, icon: Icon }: { code: string; onCopy: () => void; copied: boolean; icon?: typeof Code2 }) {
  return (
    <Box sx={{ position: 'relative' }}>
      {Icon && <Box sx={{ position: 'absolute', top: 10, left: 10, color: 'var(--faint)', display: 'inline-flex' }}><Icon size={15} strokeWidth={2} /></Box>}
      <Box component="pre" sx={{
        m: 0, p: 1.5, pl: Icon ? 4.5 : 1.5, pr: 5.5, fontFamily: 'var(--font-mono, monospace)', fontSize: 13, lineHeight: 1.6,
        color: 'var(--ink)', bgcolor: 'var(--field)', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)',
        overflowX: 'auto', whiteSpace: 'pre',
      }}>{code}</Box>
      <ButtonBase onClick={onCopy} aria-label="Copier" sx={{
        position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: 'var(--radius-sm)',
        color: copied ? 'var(--ok)' : 'var(--muted)', bgcolor: 'var(--card)', border: '1px solid var(--line)', cursor: 'pointer',
        '&:hover': { color: 'var(--ink)', borderColor: 'var(--accent)' },
        '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: 2 },
      }}>
        {copied ? <Check size={15} strokeWidth={2.4} /> : <Copy size={15} strokeWidth={2} />}
      </ButtonBase>
    </Box>
  );
}

function IconBtn({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <ButtonBase onClick={onClick} aria-label={label} sx={{
      width: 34, height: 34, flexShrink: 0, borderRadius: 'var(--radius-md)', color: 'var(--muted)', cursor: 'pointer',
      border: '1px solid var(--line)', bgcolor: 'var(--card)',
      '&:hover': { color: 'var(--ink)', borderColor: 'var(--accent)' },
      '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: 2 },
    }}>
      {children}
    </ButtonBase>
  );
}

const miniBtnSx = {
  display: 'inline-flex', alignItems: 'center', gap: 0.5, height: 34, px: 1.5,
  borderRadius: 'var(--radius-md)', border: '1px solid var(--line)', bgcolor: 'var(--card)', color: 'var(--body)',
  fontWeight: 'var(--fw-medium)', fontSize: 'var(--text-sm)', cursor: 'pointer',
  transition: 'border-color var(--duration-fast) var(--ease-out), color var(--duration-fast) var(--ease-out)',
  '&:hover': { borderColor: 'var(--accent)', color: 'var(--ink)' },
  '&.Mui-disabled': { opacity: 0.5 },
  '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: 2 },
} as const;
