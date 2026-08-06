import React, { useState, useCallback } from 'react';
import StatusChip from '../components/StatusChip';
import { TriangleAlert, CircleCheck } from 'lucide-react';
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  Field,
  FieldLabel,
  Input,
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
  Spinner,
} from '../components/ui';
import {
  VpnKey,
  CheckCircle,
  Store as StoreIcon,
  PersonOutline,
} from '../icons';
import { useParams } from 'react-router-dom';
import { API_CONFIG } from '../config/api';

// ─── API base URL (no auth needed for public endpoints) ─────────────────────
// Origine de l'API (les chemins passés à publicFetch incluent déjà /api).
// Résolution standard de l'app via VITE_API_BASE_URL : dev = http://localhost:8084,
// prod = https://app.clenzy.fr. L'ancien VITE_API_URL n'était défini nulle part :
// en dev les fetch tapaient le serveur Vite (localhost:3000) qui renvoyait index.html.

const API_BASE = API_CONFIG.BASE_URL;

async function publicFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ message: 'Erreur serveur' }));
    throw new Error(err.message || 'Erreur');
  }
  return response.json();
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface VerifyResult {
  valid: boolean;
  guestName: string;
  codeType: string;
  status: string;
  storeName: string;
  validUntil: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

const PublicKeyVerification: React.FC = () => {
  const { token } = useParams<{ token: string }>();

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const handleVerify = useCallback(async () => {
    if (!code.trim() || !token) return;
    setLoading(true);
    setError(null);
    setVerifyResult(null);
    setConfirmed(false);
    try {
      const result = await publicFetch<VerifyResult>(
        `/api/public/key-verify/${token}?code=${encodeURIComponent(code.trim())}`,
      );
      setVerifyResult(result);
    } catch (e: any) {
      setError(e.message || 'Code invalide');
    } finally {
      setLoading(false);
    }
  }, [code, token]);

  const handleConfirm = useCallback(async (action: 'collected' | 'returned' | 'deposited') => {
    if (!token || !code.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await publicFetch(`/api/public/key-verify/${token}/confirm`, {
        method: 'POST',
        body: JSON.stringify({ code: code.trim(), action }),
      });
      setConfirmed(true);
    } catch (e: any) {
      setError(e.message || 'Erreur lors de la confirmation');
    } finally {
      setLoading(false);
    }
  }, [token, code]);

  if (!token) {
    return (
      <div className="flex justify-center items-center min-h-svh bg-background p-3">
        <Alert variant="destructive" className="max-w-[420px]">
          <TriangleAlert />
          <AlertDescription>Lien de vérification invalide</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex justify-center items-center min-h-svh bg-background p-3">
      <Card className="gap-0 py-0 max-w-[420px] w-full p-4">
        {/* Header */}
        <div className="text-center mb-4">
          <span className="inline-flex mb-1.5 text-primary"><VpnKey size={40} strokeWidth={1.75} /></span>
          <h1 className="text-lg font-semibold tracking-tight text-balance">
            Vérification de code
          </h1>
          <p className="text-xs text-muted-foreground">
            Entrez le code présenté par le voyageur
          </p>
        </div>

        {/* Code input */}
        {!confirmed && (
          <div className="mb-3">
            <Field>
              <FieldLabel htmlFor="key-verification-code">Code à 6 chiffres</FieldLabel>
              {/* Saisie de code : corps genereux, chasse fixe et interlettrage
                  large pour que les six chiffres se lisent un a un. La hauteur
                  est explicite — le champ compact du kit (h32) ne contient pas
                  un corps de 1.5rem. */}
              <Input
                id="key-verification-code"
                className="h-12 w-full text-center font-mono text-2xl tracking-[0.2em] tabular-nums"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={10}
                onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
              />
            </Field>
            <Button
              onClick={handleVerify}
              disabled={loading || code.trim().length < 4}
              className="mt-[9px] w-full shrink"
            >
              {loading && <Spinner className="size-4" />}
              Vérifier
            </Button>
          </div>
        )}

        {/* Error */}
        {error && (
          <Alert variant="destructive" className="mb-3">
            <TriangleAlert />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Verify result */}
        {verifyResult && !confirmed && (
          <div className="mt-3">
            {verifyResult.valid ? (
              <>
                <Alert variant="success" className="mb-3">
                  <CircleCheck />
                  <AlertDescription>Code valide</AlertDescription>
                </Alert>

                {/* Recapitulatif : des lignes `Item`, pas un panneau borde dans
                    une carte — une carte dans une carte s'aplatit. */}
                <ItemGroup className="mb-3">
                  {verifyResult.guestName && (
                    <Item variant="muted" size="xs">
                      <ItemMedia variant="icon" className="text-muted-foreground">
                        <PersonOutline strokeWidth={1.75} />
                      </ItemMedia>
                      <ItemContent>
                        <ItemTitle>{verifyResult.guestName}</ItemTitle>
                        <ItemDescription>Voyageur</ItemDescription>
                      </ItemContent>
                    </Item>
                  )}
                  <Item variant="muted" size="xs">
                    <ItemMedia variant="icon" className="text-muted-foreground">
                      <StoreIcon strokeWidth={1.75} />
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle>{verifyResult.storeName}</ItemTitle>
                      <ItemDescription>Point</ItemDescription>
                    </ItemContent>
                  </Item>
                </ItemGroup>

                <div className="mb-3 flex items-center gap-1.5">
                  <StatusChip
                    tone={verifyResult.codeType === 'COLLECTION' ? 'info' : 'ok'}
                    label={verifyResult.codeType === 'COLLECTION' ? 'Collecte' : 'Dépôt'}
                  />
                  {verifyResult.validUntil && (
                    <p className="text-xs tabular-nums text-muted-foreground">
                      Valide jusqu'au {new Date(verifyResult.validUntil).toLocaleDateString('fr-FR')}
                    </p>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex gap-1.5">
                  <Button
                    onClick={() => handleConfirm('collected')}
                    disabled={loading}
                    className="w-full"
                  >
                    Clé remise au voyageur
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleConfirm('returned')}
                    disabled={loading}
                    className="w-full"
                  >
                    Clé récupérée
                  </Button>
                </div>
              </>
            ) : (
              <Alert variant="warning">
                <TriangleAlert />
                <AlertDescription>Code invalide ou expiré. Statut : {verifyResult.status}</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Confirmation */}
        {confirmed && (
          <div className="text-center py-3">
            <span className="inline-flex text-success mb-1.5"><CheckCircle size={48} strokeWidth={1.75} /></span>
            <p className="mb-1.5 text-base font-semibold tracking-tight text-balance">
              Mouvement confirmé
            </p>
            <p className="mb-3 text-xs text-muted-foreground">
              Le mouvement de clé a été enregistré avec succès.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setCode('');
                setVerifyResult(null);
                setConfirmed(false);
                setError(null);
              }}
            >
              Vérifier un autre code
            </Button>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-4 pt-3 border-t border-border">
          <p className="text-2xs text-faint">
            Propulsé par Baitly — Gestion immobilière
          </p>
        </div>
      </Card>
    </div>
  );
};

export default PublicKeyVerification;
