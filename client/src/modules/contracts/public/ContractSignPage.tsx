import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '../../../components/ui';
import { Info, TriangleAlert } from 'lucide-react';
import { Spinner } from '../../../components/ui';
import { Card } from '../../../components/ui';
import { Button } from '../../../components/ui';
import { Field, FieldLabel, Input } from '../../../components/ui';
import { Checkbox } from '../../../components/ui';
import { useParams } from 'react-router-dom';
import { cn } from '../../../utils/cn';
import { Handshake, CheckCircle, Download, Warning } from '../../../icons';
import { API_CONFIG } from '../../../config/api';
import { SIGN_LABELS, detectSignLang, type SignLabels } from './signLabels';

// Même résolution que le reste de l'app (VITE_API_BASE_URL) : dev = localhost:8084,
// prod = https://app.clenzy.fr. PAS VITE_API_URL, qui n'est défini nulle part.
const API_BASE = `${API_CONFIG.BASE_URL}${API_CONFIG.BASE_PATH}`;

/** Payload public renvoyé par GET /api/public/contract-signature/{token}. */
interface SignView {
  status: 'PENDING' | 'SIGNED' | 'EXPIRED' | 'CANCELLED';
  contractNumber: string;
  contractType: string | null;
  propertyName: string;
  ownerName: string;
  commissionRate: number | null;
  startDate: string | null;
  endDate: string | null;
  paymentModel: string | null;
  /** Mandat déclaratif : AGENCY | OWNER. Ce que le propriétaire délègue — ou garde. */
  policeDeclarationBy: string | null;
  touristTaxBy: string | null;
  licenceHeldBy: string | null;
  documentAvailable: boolean;
  signedAt: string | null;
  signedByName: string | null;
  expiresAt: string | null;
  consentText: string;
}

type PageState = 'loading' | 'ready' | 'notfound' | 'error';

// Page publique : palette Baitly UI (baitly-ui.css importé global).
// Défaut visiteur = thème clair.

// Report du `<Paper variant="outlined">` : surface carte, filet, rayon lg.
// Padding MUI p={{ xs: 2, md: 3 }} = 12 px / 18 px, md MUI = 900 px.
const PANEL_CLASS =
  'rounded-lg border border-solid border-border bg-card p-3 min-[900px]:p-[18px]';

async function fetchView(token: string): Promise<SignView | null> {
  const response = await fetch(`${API_BASE}/public/contract-signature/${token}`, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('fetch_failed');
  return response.json();
}

/**
 * Page publique de consultation + signature électronique du mandat de gestion
 * (/sign/:token). Sans auth : fetch natif sur /api/public/** (pattern PublicGuide).
 */
const ContractSignPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const lang = useMemo(detectSignLang, []);
  const L: SignLabels = SIGN_LABELS[lang];

  const [state, setState] = useState<PageState>('loading');
  const [view, setView] = useState<SignView | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [justSigned, setJustSigned] = useState(false);

  // Formulaire de signature
  const [signerName, setSignerName] = useState('');
  const [consent, setConsent] = useState(false);
  const [signing, setSigning] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);

  const loadDocument = useCallback(async (tk: string) => {
    try {
      const response = await fetch(`${API_BASE}/public/contract-signature/${tk}/document`);
      if (!response.ok) return;
      const blob = await response.blob();
      setPdfUrl((prev) => {
        if (prev) window.URL.revokeObjectURL(prev);
        return window.URL.createObjectURL(blob);
      });
    } catch {
      // Document indisponible : la page reste utilisable (état documentAvailable).
    }
  }, []);

  useEffect(() => {
    if (!token) { setState('notfound'); return; }
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchView(token);
        if (cancelled) return;
        if (!data) { setState('notfound'); return; }
        setView(data);
        setState('ready');
        if (data.documentAvailable) void loadDocument(token);
      } catch {
        if (!cancelled) setState('error');
      }
    })();
    return () => { cancelled = true; };
  }, [token, loadDocument]);

  // Libère l'object URL du PDF au démontage.
  useEffect(() => () => { if (pdfUrl) window.URL.revokeObjectURL(pdfUrl); }, [pdfUrl]);

  const handleSign = async () => {
    if (!token || signing) return;
    setSigning(true);
    setSignError(null);
    try {
      const response = await fetch(`${API_BASE}/public/contract-signature/${token}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signerName: signerName.trim(), consent }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setSignError(body?.error || L.signError);
        // 409/410 : l'état a changé entre-temps → recharge la vue.
        if (response.status === 409 || response.status === 410) {
          const refreshed = await fetchView(token).catch(() => null);
          if (refreshed) setView(refreshed);
        }
        return;
      }
      const updated: SignView = await response.json();
      setView(updated);
      setJustSigned(true);
      // Recharge le PDF : il contient désormais la page certificat.
      void loadDocument(token);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setSignError(L.signError);
    } finally {
      setSigning(false);
    }
  };

  const formValid = signerName.trim().length >= 3 && consent;

  // ─── Rendu ─────────────────────────────────────────────────────────────────

  return (
    // md MUI = 900px ; py 3/6 = 18px/36px et px 2 = 12px (theme.spacing vaut 6).
    <div
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      className="min-h-screen flex justify-center bg-background px-3 py-[18px] min-[900px]:py-9"
    >
      <div className="w-full max-w-[760px] flex flex-col gap-4">
        {/* ── En-tête marque ── */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center size-9 rounded-lg bg-primary text-primary-foreground shrink-0">
            <Handshake size={20} strokeWidth={1.75} />
          </span>
          <div>
            <p className="font-[family-name:var(--font-display)] text-base font-semibold leading-[1.2] text-foreground">
              Baitly
            </p>
            <p className="text-xs text-muted-foreground">
              {L.brandTagline}
            </p>
          </div>
        </div>

        {state === 'loading' && (
          <Card className="gap-0 py-0 border-border p-9 text-center">
            <Spinner className="size-7 mx-auto text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">
              {L.loadingText}
            </p>
          </Card>
        )}

        {(state === 'notfound' || state === 'error') && (
          <StatusCard
            icon={<Warning className="size-5" strokeWidth={1.75} />}
            variant="warning"
            title={state === 'notfound' ? L.notFoundTitle : L.errorTitle}
            text={state === 'notfound' ? L.notFoundText : L.errorText}
          />
        )}

        {state === 'ready' && view && (
          <>
            {/* ── Bandeau d'état (expiré / annulé / signé / succès) ── */}
            {view.status === 'EXPIRED' && (
              <StatusCard icon={<Warning className="size-5" strokeWidth={1.75} />} variant="warning"
                title={L.expiredTitle} text={L.expiredText} />
            )}
            {view.status === 'CANCELLED' && (
              <StatusCard icon={<Warning className="size-5" strokeWidth={1.75} />} variant="destructive"
                title={L.cancelledTitle} text={L.cancelledText} />
            )}
            {view.status === 'SIGNED' && (
              <StatusCard
                icon={<CheckCircle className="size-5" strokeWidth={1.75} />}
                variant="success"
                title={justSigned ? L.successTitle : L.signedTitle}
                text={justSigned
                  ? L.successText
                  : L.signedText
                      .replace('{date}', view.signedAt ?? '—')
                      .replace('{name}', view.signedByName ?? '—')}
              />
            )}

            {/* ── Titre + récapitulatif (toujours visibles si contrat lisible) ── */}
            <div>
              <p className="font-[family-name:var(--font-display)] text-[1.375rem] font-semibold text-foreground text-balance">
                {L.title} <span className="text-[1.05rem] font-mono text-primary">{view.contractNumber}</span>
              </p>
              {view.status === 'PENDING' && (
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {L.subtitle}
                </p>
              )}
            </div>

            <div className={PANEL_CLASS}>
              <SectionLabel>{L.summaryTitle}</SectionLabel>
              <div className="grid grid-cols-[1fr] min-[600px]:grid-cols-[1fr_1fr] gap-x-[18px]">
                <SummaryRow label={L.property} value={view.propertyName || '—'} />
                <SummaryRow label={L.owner} value={view.ownerName || '—'} />
                <SummaryRow
                  label={L.contractType}
                  value={(view.contractType && L.contractTypes[view.contractType]) || view.contractType || '—'}
                />
                <SummaryRow
                  label={L.commission}
                  value={view.commissionRate != null ? `${Math.round(view.commissionRate * 100)} %` : '—'}
                  tabular
                />
                <SummaryRow
                  label={L.period}
                  value={`${view.startDate ?? '—'} → ${view.endDate ?? L.periodOpenEnded}`}
                  tabular
                />
                <SummaryRow
                  label={L.collection}
                  value={(view.paymentModel && L.paymentModels[view.paymentModel]) || view.paymentModel || '—'}
                />
              </div>
            </div>

            {/* ── Obligations réglementaires ──
                 Le mandat de gestion délègue l'exploitation ; celles-ci disent
                 qui DÉCLARE. Elles s'affichent avant la signature parce que
                 c'est ce que le propriétaire autorise — un champ qu'il n'aurait
                 pas lu ne l'engagerait pas. */}
            <div className={PANEL_CLASS}>
              <SectionLabel>{L.obligationsTitle}</SectionLabel>
              <div className="grid grid-cols-[1fr] min-[600px]:grid-cols-[1fr_1fr] gap-x-[18px]">
                <SummaryRow
                  label={L.policeDeclaration}
                  value={(view.policeDeclarationBy && L.obligationBearers[view.policeDeclarationBy])
                    || L.obligationBearers.AGENCY}
                />
                <SummaryRow
                  label={L.touristTax}
                  value={(view.touristTaxBy && L.obligationBearers[view.touristTaxBy])
                    || L.obligationBearers.AGENCY}
                />
                <SummaryRow
                  label={L.licence}
                  value={(view.licenceHeldBy && L.obligationBearers[view.licenceHeldBy])
                    || L.obligationBearers.AGENCY}
                />
              </div>
            </div>

            {/* ── Document ── */}
            {(view.status === 'PENDING' || view.status === 'SIGNED') && (
              <div className={PANEL_CLASS}>
                <div className="flex items-center justify-between mb-2">
                  <SectionLabel className="mb-0">{L.documentTitle}</SectionLabel>
                  {pdfUrl && (
                    <Button asChild variant="ghost" size="sm">
                      <a href={pdfUrl} download={`Mandat_${view.contractNumber}.pdf`}>
                        <Download size={15} strokeWidth={1.75} />
                        {L.download}
                      </a>
                    </Button>
                  )}
                </div>
                {pdfUrl ? (
                  <iframe className="w-full h-[380px] min-[900px]:h-[520px] border border-solid border-border rounded-xl bg-card" src={pdfUrl} title={`${L.title} ${view.contractNumber}`} />
                ) : view.documentAvailable ? (
                  <div className="py-6 text-center">
                    <Spinner className="size-[22px] mx-auto text-primary" />
                  </div>
                ) : (
                  <Alert variant="info" className="text-[0.8125rem]">
                    <Info />
                    <AlertDescription>{L.documentUnavailable}</AlertDescription>
                  </Alert>
                )}
                {view.status === 'PENDING' && (
                  <p className="mt-1.5 text-xs text-faint">
                    {L.documentHint}
                  </p>
                )}
              </div>
            )}

            {/* ── Bloc signature ── */}
            {view.status === 'PENDING' && (
              <div className={cn(PANEL_CLASS, 'border-primary')}>
                <SectionLabel>{L.signTitle}</SectionLabel>
                <div className="flex flex-col gap-3">
                  <Field>
                    <FieldLabel htmlFor="contract-signer-name">{L.signerNameLabel}</FieldLabel>
                    <Input
                      id="contract-signer-name"
                      className="w-full"
                      placeholder={L.signerNamePlaceholder}
                      value={signerName}
                      onChange={(e) => setSignerName(e.target.value)}
                      autoComplete="name"
                    />
                  </Field>
                  <Field orientation="horizontal" className="items-start">
                    <Checkbox
                      id="contract-consent"
                      className="mt-[3px]"
                      checked={consent}
                      onCheckedChange={(checked) => setConsent(checked === true)}
                    />
                    <FieldLabel
                      htmlFor="contract-consent"
                      className="text-xs font-normal text-muted-foreground leading-[1.55]"
                    >
                      {view.consentText}
                    </FieldLabel>
                  </Field>
                  {signError && (
                    <Alert variant="destructive" className="text-[0.8125rem]">
                      <TriangleAlert />
                      <AlertDescription>{signError}</AlertDescription>
                    </Alert>
                  )}
                  {/* CTA principal de la page : l'aplat accent maison cede la place a
                      l'encre pleine du kit. `sm` MUI = 600px cote Tailwind. */}
                  <Button
                    variant="default"
                    size="lg"
                    onClick={handleSign}
                    disabled={!formValid || signing}
                    className="px-6 min-[600px]:self-start"
                  >
                    {signing
                      ? <Spinner className="size-4" />
                      : <CheckCircle size={18} strokeWidth={1.75} />}
                    {signing ? L.signing : L.signButton}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Pied de page légal ── */}
        <p className="text-2xs text-faint text-center pb-3">
          {L.footer}
        </p>
      </div>
    </div>
  );
};

// ─── Sous-composants ──────────────────────────────────────────────────────────

// L'ancien surcharge par `sx` devient une surcharge par `className` : le seul
// appelant passait `mb: 0`, que tailwind-merge resout contre le mb-[9px] de base.
const SectionLabel: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <p className={cn('text-2xs font-bold uppercase tracking-[0.06em] text-faint mb-[9px]', className)}>
    {children}
  </p>
);

const SummaryRow: React.FC<{ label: string; value: string; tabular?: boolean }> = ({ label, value, tabular }) => (
  <div className="flex justify-between gap-3 py-1.5 border-b border-border">
    <p className="text-[0.8125rem] text-muted-foreground shrink-0">{label}</p>
    <p className={cn('text-[0.8125rem] font-semibold text-foreground text-end', tabular && 'tabular-nums')}>
      {value}
    </p>
  </div>
);

/**
 * Bandeau d'état du lien de signature (introuvable, expiré, annulé, signé).
 * C'est exactement la forme d'une `Alert` du kit : le couple fond `-soft` /
 * encre `-ink` de chaque variante y est déjà conforme AA, ce que la carte
 * écrite à la main ne garantissait pas.
 */
const StatusCard: React.FC<{
  icon: React.ReactNode;
  variant: 'warning' | 'destructive' | 'success';
  title: string;
  text: string;
}> = ({ icon, variant, title, text }) => (
  <Alert variant={variant} className="px-4 py-3.5 gap-x-3">
    {icon}
    <AlertTitle className="font-[family-name:var(--font-display)] text-base font-semibold text-balance">
      {title}
    </AlertTitle>
    <AlertDescription className="mt-0.5 text-[0.85rem] leading-[1.55]">{text}</AlertDescription>
  </Alert>
);

export default ContractSignPage;
