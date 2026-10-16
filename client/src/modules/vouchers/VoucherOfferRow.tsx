import { useEffect, useId, useRef, useState } from 'react';
import { Copy, Check, ChevronDown } from '../../icons/glyphs';
import { Edit, Pause, PlayArrow, Delete } from '../../icons';
import { Button } from '../../components/ui';
import StatusChip from '../../components/StatusChip';
import { useTranslation } from '../../hooks/useTranslation';
import { useNotification } from '../../hooks/useNotification';
import type { BookingVoucher } from '../../services/api/bookingVouchersApi';
import { intlLocale } from '../../utils/localeDate';

export function voucherDiscount(v: Pick<BookingVoucher, 'discountType' | 'discountValue' | 'currency'>, locale: string, nights: (count: number) => string) {
  const value = Number(v.discountValue);
  if (v.discountType === 'PERCENTAGE') return `−${new Intl.NumberFormat(intlLocale(locale)).format(value)} %`;
  if (v.discountType === 'FREE_NIGHTS') return `${value} ${nights(value)}`;
  return `−${new Intl.NumberFormat(intlLocale(locale), {style: 'currency', currency: v.currency || 'EUR', maximumFractionDigits: 2}).format(value)}`;
}

export default function VoucherOfferRow({ voucher: v, busy, onEdit, onPause, onResume, onDelete }: {
  voucher: BookingVoucher; busy: boolean; onEdit: () => void; onPause: () => void; onResume: () => void; onDelete: () => void;
}) {
  const { t, currentLanguage } = useTranslation();
  const { notify } = useNotification();
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const detailsId = useId();
  const offerRef = useRef<HTMLElement>(null);
  const conditionsRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!expanded) return;
    const dismissOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !offerRef.current?.contains(event.target)) setExpanded(false);
    };
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setExpanded(false);
        conditionsRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', dismissOutside);
    document.addEventListener('keydown', dismissOnEscape);
    return () => {
      document.removeEventListener('pointerdown', dismissOutside);
      document.removeEventListener('keydown', dismissOnEscape);
    };
  }, [expanded]);
  const date = (iso: string) => new Intl.DateTimeFormat(intlLocale(currentLanguage), {dateStyle:'medium'}).format(new Date(iso));
  const copy = async () => {
    if (!v.code || copying) return;
    setCopying(true);
    try { await navigator.clipboard.writeText(v.code); setCopied(v.code); notify.success(t('vouchers.workspace.copied')); }
    catch { notify.error(t('vouchers.workspace.copyError')); }
    finally { setCopying(false); }
  };
  const tone = {ACTIVE:'ok',PAUSED:'warn',DRAFT:'info',EXPIRED:'neutral'} as const;
  const artwork = v.discountType === 'FREE_NIGHTS' ? 'occupancy' : v.discountType === 'FIXED_AMOUNT' ? 'revenue' : 'adr';
  const limit = v.maxUsesTotal;
  return <article ref={offerRef} className="baitly-voucher-offer" data-status={v.status} data-expanded={expanded}>
    <div className="baitly-voucher-ticket">
      <img src={`/images/dashboard-kpis/${artwork}.webp`} width={64} height={64} alt="" decoding="async" />
      <strong>{voucherDiscount(v, currentLanguage, count => t('vouchers.editor.nights',{count}))}</strong>
      <span>{t(`vouchers.workspace.${v.discountType === 'FREE_NIGHTS' ? 'freeNights' : 'discount'}`, {count:Number(v.discountValue)})}</span>
    </div>
    <div className="baitly-voucher-content">
      <div className="baitly-voucher-heading"><h3>{v.name}</h3><StatusChip tone={tone[v.status]} label={t(`vouchers.status.${v.status}`)} /></div>
      <div className="baitly-voucher-code-row">
        {v.code ? <Button variant="outline" size="sm" className="baitly-voucher-code" onClick={copy} disabled={copying} aria-label={t('vouchers.workspace.copyCode',{code:v.code})}>
          <bdi>{v.code}</bdi>{copied === v.code ? <Check size={14} /> : <Copy size={14} />}
        </Button> : <span className="baitly-voucher-auto">{t('vouchers.autoCampaign')}</span>}
        <span>{t(v.type === 'AUTO_CAMPAIGN' ? 'vouchers.typeAuto' : 'vouchers.typeManual')}</span>
      </div>
      <div className="baitly-voucher-meta">
        <span>{v.validFrom || v.validUntil ? [v.validFrom ? date(v.validFrom) : t('vouchers.workspace.noStart'),v.validUntil ? date(v.validUntil) : t('vouchers.workspace.noEnd')].join(' → ') : t('vouchers.workspace.noDates')}</span>
        <span>{v.propertyIds.length ? t('vouchers.workspace.propertyCount',{count:v.propertyIds.length}) : t('vouchers.workspace.allProperties')}</span>
      </div>
      <div className="baitly-voucher-bottom">
        <div className="baitly-voucher-usage"><span><strong>{v.usageCount}</strong>{limit != null ? ` / ${limit}` : ''} {t('vouchers.workspace.uses')}</span>
          {limit != null && limit > 0 && <div role="meter" aria-label={t('vouchers.table.usage')} aria-valuemin={0} aria-valuemax={limit} aria-valuenow={Math.min(v.usageCount,limit)}><i style={{transform:`scaleX(${Math.min(v.usageCount/limit,1)})`}} /></div>}
        </div>
        <div className="baitly-voucher-actions">
          <Button ref={conditionsRef} variant="ghost" size="sm" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} aria-controls={detailsId}>{t('vouchers.workspace.conditions')}<ChevronDown size={14} /></Button>
          <Button variant="outline" size="sm" onClick={onEdit} disabled={busy}><Edit size={14} />{t('common.edit')}</Button>
        </div>
      </div>
    </div>
    {expanded && <div id={detailsId} className="baitly-voucher-details">
      {v.description && <p>{v.description}</p>}
      <p>{t('vouchers.editor.lodgingOnly')}</p>
      <dl>
        <div><dt>{t('vouchers.editor.channelScope')}</dt><dd>{t(`vouchers.workspace.channels.${v.channelScope}`)}</dd></div>
        <div><dt>{t('vouchers.editor.minStayNights')}</dt><dd>{v.minStayNights ?? t('vouchers.workspace.noMinimum')}</dd></div>
        <div><dt>{t('vouchers.editor.maxStayNights')}</dt><dd>{v.maxStayNights ?? t('vouchers.workspace.unlimited')}</dd></div>
        <div><dt>{t('vouchers.editor.minTotalAmount')}</dt><dd>{v.minTotalAmount != null ? new Intl.NumberFormat(intlLocale(currentLanguage),{style:'currency',currency:v.currency || 'EUR'}).format(Number(v.minTotalAmount)) : t('vouchers.workspace.noMinimum')}</dd></div>
        <div><dt>{t('vouchers.editor.maxUsesPerGuest')}</dt><dd>{v.maxUsesPerGuest ?? t('vouchers.workspace.unlimited')}</dd></div>
      </dl>
      <div className="baitly-voucher-management">
        {v.status === 'ACTIVE' && <Button variant="outline" size="sm" disabled={busy} onClick={onPause}><Pause size={14} />{t('vouchers.pause')}</Button>}
        {v.status === 'PAUSED' && <Button variant="outline" size="sm" disabled={busy} onClick={onResume}><PlayArrow size={14} />{t('vouchers.resume')}</Button>}
        <Button variant="ghost" size="sm" disabled={busy || v.usageCount > 0} onClick={onDelete} title={v.usageCount > 0 ? t('vouchers.deleteRefusedUsed',{count:v.usageCount}) : undefined}><Delete size={14} />{t('common.delete')}</Button>
      </div>
    </div>}
  </article>;
}
