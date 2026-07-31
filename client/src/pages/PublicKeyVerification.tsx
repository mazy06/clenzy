import React, { useState, useCallback } from 'react';
import { Spinner } from '../components/ui';
import { Card } from '../components/ui';
import { TextField, Button, Alert, Chip } from '@mui/material';
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
      <div className="flex justify-center items-center min-h-[100vh] bg-[#f5f5f5]">
        <Alert severity="error">Lien de vérification invalide</Alert>
      </div>
    );
  }

  return (
    <div className="flex justify-center items-center min-h-[100vh] bg-[#f5f5f5] p-3">
      <Card className="gap-0 py-0 max-w-[420px] w-full p-4">
        {/* Header */}
        <div className="text-center mb-4">
          <span className="inline-flex mb-1.5"><VpnKey size={40} strokeWidth={1.75} color='#6B8A9A' /></span>
          <h6 className="cn-text-h6 font-bold text-[1.1rem]">
            Vérification de code
          </h6>
          <p className="cn-text-body2 text-muted-foreground text-[0.8125rem]">
            Entrez le code présenté par le voyageur
          </p>
        </div>

        {/* Code input */}
        {!confirmed && (
          <div className="mb-3">
            <TextField
              fullWidth
              size="medium"
              label="Code à 6 chiffres"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputProps={{
                maxLength: 10,
                style: { textAlign: 'center', fontSize: '1.5rem', fontFamily: 'monospace', letterSpacing: '0.2em' },
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
            />
            <Button
              variant="contained"
              fullWidth
              onClick={handleVerify}
              disabled={loading || code.trim().length < 4}
              startIcon={loading ? <Spinner className="size-4" /> : undefined}
              sx={{ mt: 1.5, textTransform: 'none', fontWeight: 600 }}
            >
              Vérifier
            </Button>
          </div>
        )}

        {/* Error */}
        {error && (
          <Alert severity="error" sx={{ fontSize: '0.8125rem', mb: 2 }}>{error}</Alert>
        )}

        {/* Verify result */}
        {verifyResult && !confirmed && (
          <div className="mt-3">
            {verifyResult.valid ? (
              <>
                <Alert severity="success" sx={{ fontSize: '0.8125rem', mb: 2 }}>
                  Code valide
                </Alert>

                <div className="p-3 border border-[divider] rounded-[1.5px] mb-3">
                  {verifyResult.guestName && (
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="inline-flex text-muted-foreground"><PersonOutline size={18} strokeWidth={1.75} /></span>
                      <p className="cn-text-body1 text-[0.875rem]">
                        <strong>Voyageur :</strong> {verifyResult.guestName}
                      </p>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="inline-flex text-muted-foreground"><StoreIcon size={18} strokeWidth={1.75} /></span>
                    <p className="cn-text-body1 text-[0.875rem]">
                      <strong>Point :</strong> {verifyResult.storeName}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    {(() => { const c = verifyResult.codeType === 'COLLECTION' ? '#0288d1' : '#4A9B8E'; return (
                      <Chip
                        label={verifyResult.codeType === 'COLLECTION' ? 'Collecte' : 'Dépôt'}
                        size="small"
                        sx={{
                          fontSize: '0.6875rem', height: 22, fontWeight: 600,
                          backgroundColor: `${c}18`, color: c,
                          border: `1px solid ${c}40`, borderRadius: '6px',
                          '& .MuiChip-label': { px: 0.75 },
                        }}
                      />
                    ); })()}
                    {verifyResult.validUntil && (
                      <p className="cn-text-body1 text-[0.75rem] text-muted-foreground self-center">
                        Valide jusqu'au {new Date(verifyResult.validUntil).toLocaleDateString('fr-FR')}
                      </p>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-1.5">
                  <Button
                    variant="contained"
                    fullWidth
                    color="primary"
                    onClick={() => handleConfirm('collected')}
                    disabled={loading}
                    sx={{ textTransform: 'none', fontWeight: 600 }}
                  >
                    Clé remise au voyageur
                  </Button>
                  <Button
                    variant="outlined"
                    fullWidth
                    onClick={() => handleConfirm('returned')}
                    disabled={loading}
                    sx={{ textTransform: 'none', fontWeight: 600 }}
                  >
                    Clé récupérée
                  </Button>
                </div>
              </>
            ) : (
              <Alert severity="warning" sx={{ fontSize: '0.8125rem' }}>
                Code invalide ou expiré. Statut : {verifyResult.status}
              </Alert>
            )}
          </div>
        )}

        {/* Confirmation */}
        {confirmed && (
          <div className="text-center py-3">
            <span className="inline-flex text-[var(--bui-success-ink)] mb-1.5"><CheckCircle size={48} strokeWidth={1.75} /></span>
            <h6 className="cn-text-h6 font-bold text-[1rem] mb-1.5">
              Mouvement confirmé
            </h6>
            <p className="cn-text-body2 text-muted-foreground text-[0.8125rem] mb-3">
              Le mouvement de clé a été enregistré avec succès.
            </p>
            <Button
              variant="outlined"
              onClick={() => {
                setCode('');
                setVerifyResult(null);
                setConfirmed(false);
                setError(null);
              }}
              sx={{ textTransform: 'none' }}
            >
              Vérifier un autre code
            </Button>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-4 pt-3 border-t border-[divider]">
          <p className="cn-text-body1 text-[0.6875rem] text-muted-foreground opacity-60">
            Propulsé par Baitly — Gestion immobilière
          </p>
        </div>
      </Card>
    </div>
  );
};

export default PublicKeyVerification;
