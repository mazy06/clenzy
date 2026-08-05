import { useState } from 'react';
import { cn } from '../../../../utils/cn';
import { Alert, AlertDescription, Button, Input, Skeleton } from '../../../../components/ui';
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
          ? (
            <Alert variant="destructive">
              <AlertTriangle />
              <AlertDescription>{cfg.error}</AlertDescription>
            </Alert>
          )
          : [0, 1, 2].map((i) => <Skeleton key={i} className="h-[150px] mb-[15px] rounded-xl" />)}
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
        <Alert variant="destructive" className="mb-3.5">
          <AlertTriangle />
          <AlertDescription>{cfg.error}</AlertDescription>
        </Alert>
      )}

      <SettingCard title="Site hébergé" description="Une page de réservation prête à l'emploi, sans rien installer.">
        <div className="py-2 flex items-center gap-1.5 flex-wrap">
          <div className="inline-flex text-primary"><Globe size={18} strokeWidth={2} /></div>
          <div className="flex-1 min-w-[220px] [font-family:var(--font-mono,_monospace)] text-xs text-foreground whitespace-nowrap overflow-hidden text-ellipsis">
            {hostedUrl}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => copy('hosted', hostedUrl)} className="cursor-pointer">
            {copiedId === 'hosted' ? <Check size={14} strokeWidth={2.4} /> : <Copy size={14} strokeWidth={2} />}
            {copiedId === 'hosted' ? 'Copié' : 'Copier'}
          </Button>
          {/* Meme gabarit que les boutons voisins ; `disabled` est sans objet sur une ancre. */}
          <Button asChild variant="outline" size="sm">
            <a href={hostedUrl} target="_blank" rel="noopener noreferrer" className="no-underline cursor-pointer">
              <ExternalLink size={14} strokeWidth={2} /> Ouvrir
            </a>
          </Button>
        </div>
      </SettingCard>

      <SettingCard title="Widget intégrable" description="Collez ce code dans votre site pour afficher le moteur de réservation.">
        <div className="py-2">
          <CodeBlock icon={Code2} code={embedCode} copied={copiedId === 'embed'} onCopy={() => copy('embed', embedCode)} />
          <div className="text-2xs text-faint mt-2 mb-1">Ou en iframe :</div>
          <CodeBlock code={iframeCode} copied={copiedId === 'iframe'} onCopy={() => copy('iframe', iframeCode)} />
        </div>
      </SettingCard>

      <SettingCard title="SDK & API" description="Pour une intégration sur mesure dans votre application.">
        <SettingRow
          label="Clé API"
          helper="Authentifie vos requêtes. Régénérer invalide l'ancienne clé immédiatement."
          control={
            <div className="flex items-center gap-0.5 w-full">
              <Input
                value={apiKey}
                readOnly
                type={showKey ? 'text' : 'password'}
                className="flex-1 h-[34px] text-xs [font-family:var(--font-mono,_monospace)]"
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
              <div className="text-xs text-destructive-ink">L'ancienne clé cessera de fonctionner. Confirmer ?</div>
              <Button type="button" variant="destructive" size="sm" onClick={onRegenerate} disabled={busy} className="cursor-pointer">
                Oui, régénérer
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setRegenConfirm(false)} className="cursor-pointer">
                Annuler
              </Button>
            </>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={() => setRegenConfirm(true)} disabled={busy} className="cursor-pointer">
              <RefreshCw size={14} strokeWidth={2} /> Régénérer la clé
            </Button>
          )}
        </div>
      </SettingCard>
    </SettingsPage>
  );
}

function CodeBlock({ code, onCopy, copied, icon: Icon }: { code: string; onCopy: () => void; copied: boolean; icon?: typeof Code2 }) {
  return (
    <div className="relative">
      {Icon && <div className="absolute top-[10px] start-[10px] text-faint inline-flex"><Icon size={15} strokeWidth={2} /></div>}
      <pre className={cn('m-0 p-[9px] pe-[33px] text-[13px] leading-relaxed text-foreground bg-field border border-field-line rounded-lg overflow-x-auto whitespace-pre', Icon ? 'ps-[27px]' : 'ps-[9px]')} style={{ fontFamily: 'var(--font-mono, monospace)' }}>{code}</pre>
      {/* `end-2` et non `right-2` : le PMS bascule en RTL. */}
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        onClick={onCopy}
        aria-label="Copier"
        className={cn('absolute top-2 end-2 cursor-pointer', copied && 'text-success')}
      >
        {copied ? <Check size={15} strokeWidth={2.4} /> : <Copy size={15} strokeWidth={2} />}
      </Button>
    </div>
  );
}

function IconBtn({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <Button type="button" variant="outline" size="icon-sm" onClick={onClick} aria-label={label} className="shrink-0 cursor-pointer">
      {children}
    </Button>
  );
}
