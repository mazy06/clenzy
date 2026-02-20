import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Typography,
  Alert,
  CircularProgress,
  Box,
  IconButton,
  InputAdornment,
  Tooltip,
} from '@mui/material';
import {
  Send,
  ContentCopy,
  CheckCircle,
  Close,
} from '@mui/icons-material';
import { invitationsApi, InvitationDto } from '../../services/api/invitationsApi';

interface Props {
  open: boolean;
  onClose: () => void;
  organizationId: number;
  onInvitationSent: () => void;
}

const ROLES = [
  { value: 'MEMBER', label: 'Membre' },
  { value: 'ADMIN', label: 'Administrateur' },
];

export default function SendInvitationDialog({ open, onClose, organizationId, onInvitationSent }: Props) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('MEMBER');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InvitationDto | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSend = async () => {
    if (!email.trim()) {
      setError('Veuillez saisir un email.');
      return;
    }

    // Validation email basique
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError('Veuillez saisir un email valide.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const invitation = await invitationsApi.send(organizationId, {
        email: email.trim(),
        role,
      });
      setResult(invitation);
      onInvitationSent();
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      setError(apiErr.message || 'Erreur lors de l\'envoi de l\'invitation.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (!result?.invitationLink) return;
    try {
      await navigator.clipboard.writeText(result.invitationLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback pour les navigateurs sans clipboard API
      const textarea = document.createElement('textarea');
      textarea.value = result.invitationLink;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setEmail('');
    setRole('MEMBER');
    setError(null);
    setResult(null);
    setCopied(false);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading && !result) {
      handleSend();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" fontWeight={600}>
          {result ? 'Invitation envoyee' : 'Inviter un membre'}
        </Typography>
        <IconButton size="small" onClick={handleClose}>
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {!result ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
            <TextField
              label="Adresse email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={handleKeyDown}
              fullWidth
              autoFocus
              placeholder="exemple@email.com"
              disabled={loading}
            />

            <TextField
              label="Role"
              select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              fullWidth
              disabled={loading}
              helperText="Le role attribue au nouvel utilisateur"
            >
              {ROLES.map((r) => (
                <MenuItem key={r.value} value={r.value}>
                  {r.label}
                </MenuItem>
              ))}
            </TextField>

            {error && (
              <Alert severity="error" onClose={() => setError(null)}>
                {error}
              </Alert>
            )}
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1, alignItems: 'center' }}>
            <CheckCircle sx={{ fontSize: 56, color: 'success.main' }} />
            <Typography variant="body1" textAlign="center">
              L'invitation a ete envoyee a <strong>{result.invitedEmail}</strong>
            </Typography>

            {result.invitationLink && (
              <Box sx={{ width: '100%' }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Vous pouvez aussi partager ce lien directement :
                </Typography>
                <TextField
                  value={result.invitationLink}
                  fullWidth
                  size="small"
                  InputProps={{
                    readOnly: true,
                    sx: { fontSize: '0.8rem', fontFamily: 'monospace' },
                    endAdornment: (
                      <InputAdornment position="end">
                        <Tooltip title={copied ? 'Copie !' : 'Copier le lien'}>
                          <IconButton onClick={handleCopyLink} size="small" color={copied ? 'success' : 'default'}>
                            {copied ? <CheckCircle fontSize="small" /> : <ContentCopy fontSize="small" />}
                          </IconButton>
                        </Tooltip>
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>
            )}

            <Typography variant="caption" color="text.secondary" textAlign="center">
              L'invitation expire le{' '}
              {new Date(result.expiresAt).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        {!result ? (
          <>
            <Button onClick={handleClose} disabled={loading}>
              Annuler
            </Button>
            <Button
              variant="contained"
              onClick={handleSend}
              disabled={loading || !email.trim()}
              startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <Send />}
            >
              {loading ? 'Envoi...' : 'Envoyer'}
            </Button>
          </>
        ) : (
          <Button variant="contained" onClick={handleClose}>
            Fermer
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
