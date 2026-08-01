import { useState } from 'react';
import { cn } from '../../../../utils/cn';
import { ButtonBase, InputBase, Skeleton } from '@mui/material';
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
      <div className="max-w-[720px] mx-auto px-6 py-6">
        {cfg.error
          ? <div className="flex items-center gap-1.5 p-3 rounded-[var(--radius-md)] bg-[var(--err-soft)] text-[var(--err)] text-[var(--text-sm)]"><AlertTriangle size={18} /> {cfg.error}</div>
          : [0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={150} sx={{ mb: 2.5, borderRadius: 'var(--radius-lg)', bgcolor: 'var(--hover)' }} />)}
      </div>
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
        <div className="flex items-center gap-1.5 mb-3.5 p-2 rounded-[var(--radius-md)] bg-[var(--err-soft)] text-[var(--err)] text-[var(--text-sm)]">
          <AlertTriangle size={16} /> {cfg.error}
        </div>
      )}

      <SettingCard title="Site hébergé" description="Une page de réservation prête à l'emploi, sans rien installer.">
        <div className="py-2 flex items-center gap-1.5 flex-wrap">
          <div className="inline-flex text-[var(--accent)]"><Globe size={18} strokeWidth={2} /></div>
          <div className="flex-1 min-w-[220px] [font-family:var(--font-mono,_monospace)] text-[var(--text-sm)] text-[var(--body)] whitespace-nowrap overflow-hidden text-ellipsis">
            {hostedUrl}
          </div>
          <ButtonBase onClick={() => copy('hosted', hostedUrl)} sx={miniBtnSx}>
            {copiedId === 'hosted' ? <Check size={14} strokeWidth={2.4} /> : <Copy size={14} strokeWidth={2} />}
            {copiedId === 'hosted' ? 'Copié' : 'Copier'}
          </ButtonBase>
          {/* Equivalent classes de `miniBtnSx` (que gardent les ButtonBase voisins) ;
              `&.Mui-disabled` est sans objet sur une ancre. */}
          <a
            href={hostedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-[3px] h-[34px] px-[9px] rounded-[var(--radius-md)] border border-solid border-[var(--line)] bg-[var(--card)] text-[var(--body)] font-[family-name:var(--fw-medium)] text-[var(--text-sm)] cursor-pointer no-underline transition-[border-color,color] duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:border-[var(--accent)] hover:text-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-2"
          >
            <ExternalLink size={14} strokeWidth={2} /> Ouvrir
          </a>
        </div>
      </SettingCard>

      <SettingCard title="Widget intégrable" description="Collez ce code dans votre site pour afficher le moteur de réservation.">
        <div className="py-2">
          <CodeBlock icon={Code2} code={embedCode} copied={copiedId === 'embed'} onCopy={() => copy('embed', embedCode)} />
          <div className="text-[var(--text-2xs)] text-[var(--faint)] mt-2 mb-1">Ou en iframe :</div>
          <CodeBlock code={iframeCode} copied={copiedId === 'iframe'} onCopy={() => copy('iframe', iframeCode)} />
        </div>
      </SettingCard>

      <SettingCard title="SDK & API" description="Pour une intégration sur mesure dans votre application.">
        <SettingRow
          label="Clé API"
          helper="Authentifie vos requêtes. Régénérer invalide l'ancienne clé immédiatement."
          control={
            <div className="flex items-center gap-0.5 w-full">
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
            </div>
          }
        />
        <div className="py-2">
          <CodeBlock icon={Terminal} code={sdkCode} copied={copiedId === 'sdk'} onCopy={() => copy('sdk', sdkCode)} />
        </div>
        <div className="pb-2.5 flex items-center gap-2 flex-wrap">
          {regenConfirm ? (
            <>
              <div className="text-[var(--text-sm)] text-[var(--err)]">L'ancienne clé cessera de fonctionner. Confirmer ?</div>
              <ButtonBase onClick={onRegenerate} disabled={busy} sx={{ ...miniBtnSx, color: 'var(--err)', borderColor: 'var(--err)' }}>Oui, régénérer</ButtonBase>
              <ButtonBase onClick={() => setRegenConfirm(false)} sx={miniBtnSx}>Annuler</ButtonBase>
            </>
          ) : (
            <ButtonBase onClick={() => setRegenConfirm(true)} disabled={busy} sx={miniBtnSx}>
              <RefreshCw size={14} strokeWidth={2} /> Régénérer la clé
            </ButtonBase>
          )}
        </div>
      </SettingCard>
    </SettingsPage>
  );
}

function CodeBlock({ code, onCopy, copied, icon: Icon }: { code: string; onCopy: () => void; copied: boolean; icon?: typeof Code2 }) {
  return (
    <div className="relative">
      {Icon && <div className="absolute top-[10px] start-[10px] text-[var(--faint)] inline-flex"><Icon size={15} strokeWidth={2} /></div>}
      <pre className={cn('m-0 p-[9px] pe-[33px] text-[13px] leading-[1.6] text-[var(--ink)] bg-[var(--field)] border border-solid border-[var(--line)] rounded-[var(--radius-md)] overflow-x-auto whitespace-pre', Icon ? 'ps-[27px]' : 'ps-[9px]')} style={{ fontFamily: 'var(--font-mono, monospace)' }}>{code}</pre>
      <ButtonBase onClick={onCopy} aria-label="Copier" sx={{
        position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: 'var(--radius-sm)',
        color: copied ? 'var(--ok)' : 'var(--muted)', bgcolor: 'var(--card)', border: '1px solid var(--line)', cursor: 'pointer',
        '&:hover': { color: 'var(--ink)', borderColor: 'var(--accent)' },
        '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: 2 },
      }}>
        {copied ? <Check size={15} strokeWidth={2.4} /> : <Copy size={15} strokeWidth={2} />}
      </ButtonBase>
    </div>
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
