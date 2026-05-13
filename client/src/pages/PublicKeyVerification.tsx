import React, { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Alert,
  CircularProgress,
  Chip,
} from '@mui/material';
import {
  VpnKey,
  CheckCircle,
  Store as StoreIcon,
  PersonOutline,
} from '../icons';
import { useParams } from 'react-router-dom';

// ─── API base URL (no auth needed for public endpoints) ─────────────────────

const API_BASE = import.meta.env.VITE_API_URL || '';

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
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', bgcolor: '#f5f5f5' }}>
        <Alert severity="error">Lien de vérification invalide</Alert>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        bgcolor: '#f5f5f5',
        p: 2,
      }}
    >
      <Paper
        elevation={2}
        sx={{
          maxWidth: 420,
          width: '100%',
          p: 3,
          borderRadius: 2,
        }}
      >
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Box component="span" sx={{ display: 'inline-flex', mb: 1 }}><VpnKey size={40} strokeWidth={1.75} color='#6B8A9A' /></Box>
          <Typography variant="h6" fontWeight={700} sx={{ fontSize: '1.1rem' }}>
            Vérification de code
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem' }}>
            Entrez le code présenté par le voyageur
          </Typography>
        </Box>

        {/* Code input */}
        {!confirmed && (
          <Box sx={{ mb: 2 }}>
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
              startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
              sx={{ mt: 1.5, textTransform: 'none', fontWeight: 600 }}
            >
              Vérifier
            </Button>
          </Box>
        )}

        {/* Error */}
        {error && (
          <Alert severity="error" sx={{ fontSize: '0.8125rem', mb: 2 }}>{error}</Alert>
        )}

        {/* Verify result */}
        {verifyResult && !confirmed && (
          <Box sx={{ mt: 2 }}>
            {verifyResult.valid ? (
              <>
                <Alert severity="success" sx={{ fontSize: '0.8125rem', mb: 2 }}>
                  Code valide
                </Alert>

                <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1.5, mb: 2 }}>
                  {verifyResult.guestName && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><PersonOutline size={18} strokeWidth={1.75} /></Box>
                      <Typography sx={{ fontSize: '0.875rem' }}>
                        <strong>Voyageur :</strong> {verifyResult.guestName}
                      </Typography>
                    </Box>
                  )}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><StoreIcon size={18} strokeWidth={1.75} /></Box>
                    <Typography sx={{ fontSize: '0.875rem' }}>
                      <strong>Point :</strong> {verifyResult.storeName}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1 }}>
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
                      <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', alignSelf: 'center' }}>
                        Valide jusqu'au {new Date(verifyResult.validUntil).toLocaleDateString('fr-FR')}
                      </Typography>
                    )}
                  </Box>
                </Box>

                {/* Action buttons */}
                <Box sx={{ display: 'flex', gap: 1 }}>
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
                </Box>
              </>
            ) : (
              <Alert severity="warning" sx={{ fontSize: '0.8125rem' }}>
                Code invalide ou expiré. Statut : {verifyResult.status}
              </Alert>
            )}
          </Box>
        )}

        {/* Confirmation */}
        {confirmed && (
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <Box component="span" sx={{ display: 'inline-flex', color: 'success.main', mb: 1 }}><CheckCircle size={48} strokeWidth={1.75} /></Box>
            <Typography variant="h6" fontWeight={700} sx={{ fontSize: '1rem', mb: 1 }}>
              Mouvement confirmé
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem', mb: 2 }}>
              Le mouvement de clé a été enregistré avec succès.
            </Typography>
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
          </Box>
        )}

        {/* Footer */}
        <Box sx={{ textAlign: 'center', mt: 3, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          <Typography sx={{ fontSize: '0.6875rem', color: 'text.disabled' }}>
            Propulsé par Clenzy — Gestion immobilière
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
};

export default PublicKeyVerification;
