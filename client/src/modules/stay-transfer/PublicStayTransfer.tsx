import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Spinner } from '../../components/ui';
import { API_CONFIG } from '../../config/api';

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
      setError('Cette proposition est introuvable ou le lien est invalide.');
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
        : "L'opération n'a pas abouti — votre hôte a été prévenu, il revient vers vous.");
      load();
    } finally {
      setActing(false);
    }
  };

  const formatDate = (iso: string | null) =>
    iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('fr-FR', {
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
            ✓ C'est confirmé : votre séjour se poursuit dans{' '}
            <b>{view.toPropertyName}</b>. Vos nouveaux codes d'accès vous parviennent
            séparément — merci, et bon séjour !
          </p>
        );
      case 'CANCELLED':
        return (
          <p className="m-0 text-[14px] leading-relaxed">
            Cette proposition a été annulée. Votre hôte est au courant et reste
            joignable pour trouver une solution avec vous.
          </p>
        );
      case 'EXPIRED':
        return (
          <p className="m-0 text-[14px] leading-relaxed">
            Ce lien a expiré. Contactez votre hôte pour la suite — il vous
            proposera une solution à jour.
          </p>
        );
      default:
        return (
          <>
            <p className="m-0 text-[14px] leading-relaxed">
              {view.guestFirstName ? `${view.guestFirstName}, suite` : 'Suite'} à un
              incident sur <b>{view.fromPropertyName}</b>, nous vous proposons de
              poursuivre votre séjour dans :
            </p>
            <div className="my-4 p-4 rounded-xl border border-solid border-[#e3e6ea] bg-[#fafbfc]">
              <p className="m-0 text-[16px] font-semibold">{view.toPropertyName}</p>
              {view.toPropertyAddress && (
                <p className="m-0 mt-1 text-[13px] text-[#5b6570]">{view.toPropertyAddress}</p>
              )}
              {view.checkIn && view.checkOut && (
                <p className="m-0 mt-2 text-[13px] text-[#5b6570]">
                  Du {formatDate(view.checkIn)} au {formatDate(view.checkOut)} — dates et
                  tarif inchangés.
                </p>
              )}
            </div>
            <p className="m-0 mb-4 text-[13px] text-[#5b6570]">
              Rien ne sera déplacé sans votre accord.
            </p>
            <div className="flex gap-2.5">
              <button
                type="button"
                disabled={acting}
                onClick={() => act('confirm')}
                className="flex-1 h-11 rounded-lg border-0 bg-[#5453D6] text-white text-[14px] font-semibold cursor-pointer disabled:opacity-60"
              >
                {acting ? '…' : 'Accepter le relogement'}
              </button>
              <button
                type="button"
                disabled={acting}
                onClick={() => act('decline')}
                className="flex-1 h-11 rounded-lg border border-solid border-[#d4d8dd] bg-white text-[#3a424b] text-[14px] font-semibold cursor-pointer disabled:opacity-60"
              >
                Refuser
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
          Proposition de relogement
        </p>
        {error && (
          <p className="mt-3 mb-0 text-[13px] text-[#b4423f]">{error}</p>
        )}
        {statusBlock()}
      </div>
    </div>
  );
}
