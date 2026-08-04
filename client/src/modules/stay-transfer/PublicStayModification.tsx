import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Spinner } from '../../components/ui';
import { API_CONFIG } from '../../config/api';

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
      setError('Cette proposition est introuvable ou le lien est invalide.');
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

  const formatAmount = (value: number | null) =>
    value != null ? `${value.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €` : null;

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
            ✓ C'est confirmé : votre séjour est modifié du{' '}
            <b>{formatDate(view.newCheckIn)}</b> au <b>{formatDate(view.newCheckOut)}</b>.
            {view.priceDelta != null && view.priceDelta > 0 && (
              <> Le complément de <b>{formatAmount(view.priceDelta)}</b> vous sera demandé
              par votre hôte.</>
            )}
            {view.priceDelta != null && view.priceDelta < 0 && (
              <> Le trop-perçu de <b>{formatAmount(Math.abs(view.priceDelta))}</b> vous
              sera remboursé.</>
            )}
            {' '}Bon séjour !
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
            Ce lien a expiré. Contactez votre hôte pour obtenir une proposition à jour.
          </p>
        );
      default:
        return (
          <>
            <p className="m-0 text-[14px] leading-relaxed">
              {view.guestFirstName ? `${view.guestFirstName}, voici` : 'Voici'} la
              proposition de modification de votre séjour
              {view.propertyName ? <> à <b>{view.propertyName}</b></> : null} :
            </p>
            <div className="my-4 p-4 rounded-xl border border-solid border-[#e3e6ea] bg-[#fafbfc]">
              {view.currentCheckIn && view.currentCheckOut && (
                <p className="m-0 text-[13px] text-[#5b6570] line-through">
                  Du {formatDate(view.currentCheckIn)} au {formatDate(view.currentCheckOut)}
                  {view.oldTotal != null ? ` — ${formatAmount(view.oldTotal)}` : ''}
                </p>
              )}
              <p className="m-0 mt-1.5 text-[15px] font-semibold">
                Du {formatDate(view.newCheckIn)} au {formatDate(view.newCheckOut)}
                {view.newTotal != null ? ` — ${formatAmount(view.newTotal)}` : ''}
              </p>
              {view.priceDelta != null && view.priceDelta !== 0 && (
                <p className="m-0 mt-2 text-[13px] text-[#5b6570]">
                  {view.priceDelta > 0
                    ? `Complément de ${formatAmount(view.priceDelta)} par rapport à votre réservation actuelle.`
                    : `Trop-perçu de ${formatAmount(Math.abs(view.priceDelta))} remboursé après confirmation.`}
                </p>
              )}
            </div>
            <p className="m-0 mb-4 text-[13px] text-[#5b6570]">
              Rien ne sera modifié sans votre accord.
            </p>
            <div className="flex gap-2.5">
              <button
                type="button"
                disabled={acting}
                onClick={() => act('confirm')}
                className="flex-1 h-11 rounded-lg border-0 bg-[#5453D6] text-white text-[14px] font-semibold cursor-pointer disabled:opacity-60"
              >
                {acting ? '…' : 'Confirmer la modification'}
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
          Modification de séjour
        </p>
        {error && (
          <p className="mt-3 mb-0 text-[13px] text-[#b4423f]">{error}</p>
        )}
        {statusBlock()}
      </div>
    </div>
  );
}
