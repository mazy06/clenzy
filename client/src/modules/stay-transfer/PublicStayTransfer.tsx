import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Spinner } from '../../components/ui';
import { API_CONFIG } from '../../config/api';
import { activeIntlLocale } from '../../utils/activeLocale';
import { useTranslation } from '../../hooks/useTranslation';

const API_BASE = API_CONFIG.BASE_URL;

interface TransferView {
  status: 'PROPOSED' | 'CONFIRMED' | 'DONE' | 'CANCELLED' | 'EXPIRED';
  guestFirstName: string | null;
  fromPropertyName: string | null;
  toPropertyName: string | null;
  toPropertyAddress: string | null;
  checkIn: string | null;
  checkOut: string | null;
  reason: string | null;
  expiresAt: string;
}

/**
 * Page publique de la proposition de relogement (M11 v2) — accessible par le
 * lien envoyé au voyageur (token = autorisation, comme /guide/:token). Rien ne
 * bouge sans son clic : Accepter exécute le transfert, Refuser prévient l'hôte.
 */
export default function PublicStayTransfer() {
  const { t } = useTranslation();
  const { token } = useParams<{ token: string }>();
  const [view, setView] = useState<TransferView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/public/stay-transfers/${token}`);
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
        `${API_BASE}/api/public/stay-transfers/${token}/${action}`, { method: 'POST' });
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

  if (!view && !error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg,#f6f7f9)]">
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
            {t('stayTransfer.confirmedTransferHead')}{' '}
            <b>{view.toPropertyName}</b>. {t('stayTransfer.confirmedTransferTail')}
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
            {t('stayTransfer.expiredTransfer')}
          </p>
        );
      default:
        return (
          <>
            <p className="m-0 text-[14px] leading-relaxed">
              {view.guestFirstName
                ? t('stayTransfer.transferLeadNamed', { name: view.guestFirstName })
                : t('stayTransfer.transferLead')}{' '}
              <b>{view.fromPropertyName}</b>{t('stayTransfer.transferLeadTail')}
            </p>
            <div className="my-4 p-4 rounded-xl border border-solid border-[#e3e6ea] bg-[#fafbfc]">
              <p className="m-0 text-[16px] font-semibold">{view.toPropertyName}</p>
              {view.toPropertyAddress && (
                <p className="m-0 mt-1 text-[13px] text-[#5b6570]">{view.toPropertyAddress}</p>
              )}
              {view.checkIn && view.checkOut && (
                <p className="m-0 mt-2 text-[13px] text-[#5b6570]">
                  {t('stayTransfer.sameDatesAndPrice', {
                    from: formatDate(view.checkIn),
                    to: formatDate(view.checkOut),
                  })}
                </p>
              )}
            </div>
            <p className="m-0 mb-4 text-[13px] text-[#5b6570]">
              {t('stayTransfer.nothingMovedWithoutConsent')}
            </p>
            <div className="flex gap-2.5">
              <button
                type="button"
                disabled={acting}
                onClick={() => act('confirm')}
                className="flex-1 h-11 rounded-lg border-0 bg-[#5453D6] text-white text-[14px] font-semibold cursor-pointer disabled:opacity-60"
              >
                {acting ? '…' : t('stayTransfer.acceptTransfer')}
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
          {t('stayTransfer.transferTitle')}
        </p>
        {error && (
          <p className="mt-3 mb-0 text-[13px] text-[#b4423f]">{error}</p>
        )}
        {statusBlock()}
      </div>
    </div>
  );
}
