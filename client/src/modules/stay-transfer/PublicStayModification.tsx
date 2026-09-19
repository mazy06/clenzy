import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Spinner } from '../../components/ui';
import { API_CONFIG } from '../../config/api';
import { activeIntlLocale } from '../../utils/activeLocale';
import { useTranslation } from '../../hooks/useTranslation';

const API_BASE = API_CONFIG.BASE_URL;

interface ModificationView {
  status: 'PROPOSED' | 'CONFIRMED' | 'DONE' | 'CANCELLED' | 'EXPIRED';
  guestFirstName: string | null;
  propertyName: string | null;
  currentCheckIn: string | null;
  currentCheckOut: string | null;
  newCheckIn: string;
  newCheckOut: string;
  oldTotal: number | null;
  newTotal: number | null;
  priceDelta: number | null;
  expiresAt: string;
}

/**
 * Page publique de l'avenant de séjour (STAY_MODIFICATION v2) — lien envoyé au
 * voyageur, token = autorisation. Accepter applique la modification (dispo et
 * tarif re-vérifiés côté serveur, jamais plus cher que le chiffrage affiché).
 */
export default function PublicStayModification() {
  const { t } = useTranslation();
  const { token } = useParams<{ token: string }>();
  const [view, setView] = useState<ModificationView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/public/stay-modifications/${token}`);
      if (!response.ok) throw new Error();
      setView(await response.json());
    } catch {
      setError(t('stayTransfer.errors.notFound'));
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const act = async (action: 'confirm' | 'decline') => {
    setActing(true);
    setError(null);
    try {
      const response = await fetch(
        `${API_BASE}/api/public/stay-modifications/${token}/${action}`, { method: 'POST' });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message || undefined);
      }
      setView(await response.json());
    } catch (e) {
      setError(e instanceof Error && e.message
        ? e.message
        : t('stayTransfer.errors.actionFailed'));
      load();
    } finally {
      setActing(false);
    }
  };

  const formatDate = (iso: string | null) =>
    iso ? new Date(`${iso}T00:00:00`).toLocaleDateString(activeIntlLocale(), {
      weekday: 'long', day: 'numeric', month: 'long',
    }) : null;

  const formatAmount = (value: number | null) =>
    value != null ? `${value.toLocaleString(activeIntlLocale(), { minimumFractionDigits: 2 })} €` : null;

  if (!view && !error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f6f7f9]">
        <Spinner className="size-8" />
      </div>
    );
  }

  const statusBlock = () => {
    if (!view) return null;
    switch (view.status) {
      case 'DONE':
      case 'CONFIRMED':
        return (
          <p className="m-0 text-[14px] leading-relaxed">
            {t('stayTransfer.confirmedModificationHead')}{' '}
            <b>{formatDate(view.newCheckIn)}</b> {t('stayTransfer.toDate')}{' '}
            <b>{formatDate(view.newCheckOut)}</b>.
            {view.priceDelta != null && view.priceDelta > 0 && (
              <> {t('stayTransfer.supplementHead')} <b>{formatAmount(view.priceDelta)}</b> {t('stayTransfer.supplementTail')}</>
            )}
            {view.priceDelta != null && view.priceDelta < 0 && (
              <> {t('stayTransfer.refundHead')} <b>{formatAmount(Math.abs(view.priceDelta))}</b> {t('stayTransfer.refundTail')}</>
            )}
            {' '}{t('stayTransfer.enjoyStay')}
          </p>
        );
      case 'CANCELLED':
        return (
          <p className="m-0 text-[14px] leading-relaxed">
            {t('stayTransfer.cancelled')}
          </p>
        );
      case 'EXPIRED':
        return (
          <p className="m-0 text-[14px] leading-relaxed">
            {t('stayTransfer.expiredModification')}
          </p>
        );
      default:
        return (
          <>
            <p className="m-0 text-[14px] leading-relaxed">
              {view.guestFirstName
                ? t('stayTransfer.modificationLeadNamed', { name: view.guestFirstName })
                : t('stayTransfer.modificationLead')}
              {view.propertyName ? <> {t('stayTransfer.atProperty')} <b>{view.propertyName}</b></> : null} :
            </p>
            <div className="my-4 p-4 rounded-xl border border-solid border-[#e3e6ea] bg-[#fafbfc]">
              {view.currentCheckIn && view.currentCheckOut && (
                <p className="m-0 text-[13px] text-[#5b6570] line-through">
                  {t('stayTransfer.dateRange', {
                    from: formatDate(view.currentCheckIn),
                    to: formatDate(view.currentCheckOut),
                  })}
                  {view.oldTotal != null ? ` — ${formatAmount(view.oldTotal)}` : ''}
                </p>
              )}
              <p className="m-0 mt-1.5 text-[15px] font-semibold">
                {t('stayTransfer.dateRange', {
                  from: formatDate(view.newCheckIn),
                  to: formatDate(view.newCheckOut),
                })}
                {view.newTotal != null ? ` — ${formatAmount(view.newTotal)}` : ''}
              </p>
              {view.priceDelta != null && view.priceDelta !== 0 && (
                <p className="m-0 mt-2 text-[13px] text-[#5b6570]">
                  {view.priceDelta > 0
                    ? t('stayTransfer.extraCharge', { amount: formatAmount(view.priceDelta) })
                    : t('stayTransfer.overpayment', { amount: formatAmount(Math.abs(view.priceDelta)) })}
                </p>
              )}
            </div>
            <p className="m-0 mb-4 text-[13px] text-[#5b6570]">
              {t('stayTransfer.nothingWithoutConsent')}
            </p>
            <div className="flex gap-2.5">
              <button
                type="button"
                disabled={acting}
                onClick={() => act('confirm')}
                className="flex-1 h-11 rounded-lg border-0 bg-[#5453D6] text-white text-[14px] font-semibold cursor-pointer disabled:opacity-60"
              >
                {acting ? '…' : t('stayTransfer.confirmModification')}
              </button>
              <button
                type="button"
                disabled={acting}
                onClick={() => act('decline')}
                className="flex-1 h-11 rounded-lg border border-solid border-[#d4d8dd] bg-white text-[#3a424b] text-[14px] font-semibold cursor-pointer disabled:opacity-60"
              >
                {t('stayTransfer.decline')}
              </button>
            </div>
          </>
        );
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-[#f6f7f9]">
      <div className="w-full max-w-[440px] p-6 rounded-2xl bg-white border border-solid border-[#e3e6ea]">
        <p className="m-0 mb-1 text-[11px] font-bold uppercase tracking-[.06em] text-[#8b93a0]">
          {t('stayTransfer.modificationTitle')}
        </p>
        {error && (
          <p className="mt-3 mb-0 text-[13px] text-[#b4423f]">{error}</p>
        )}
        {statusBlock()}
      </div>
    </div>
  );
}
