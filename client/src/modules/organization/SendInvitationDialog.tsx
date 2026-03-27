import React, { useState, useCallback } from 'react';
import { ASSIGNABLE_ORG_ROLES } from '../../utils/orgRoleLabels';
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
  ToggleButtonGroup,
  ToggleButton,
  Autocomplete,
  Chip,
} from '@mui/material';
import {
  Send,
  ContentCopy,
  CheckCircle,
  Close,
  PersonAdd,
} from '@mui/icons-material';
import { invitationsApi, InvitationDto } from '../../services/api/invitationsApi';
import apiClient from '../../services/apiClient';

// ─── Types for user search ───────────────────────────────────────────────────

interface UserSearchResult {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  hasOrganization: boolean;
}

// ─── API helpers ─────────────────────────────────────────────────────────────

const searchUsers = async (q: string): Promise<UserSearchResult[]> => {
  return apiClient.get<UserSearchResult[]>('/v2/users/search', { params: { q } });
};

const addMemberDirect = async (orgId: number, userId: number, role: string) => {
  return apiClient.post(`/organizations/${orgId}/members`, { userId, role });
};

type Mode = 'email' | 'existing';

interface Props {
  open: boolean;
  onClose: () => void;
  organizationId: number;
  onInvitationSent: () => void;
}

const ROLES = ASSIGNABLE_ORG_ROLES;

export default function SendInvitationDialog({ open, onClose, organizationId, onInvitationSent }: Props) {
  const [mode, setMode] = useState<Mode>('email');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('MEMBER');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InvitationDto | null>(null);
  const [copied, setCopied] = useState(false);

  // ─── Existing member mode state ──────────────────────────────────────────
  const [userOptions, setUserOptions] = useState<UserSearchResult[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [memberRole, setMemberRole] = useState('MEMBER');
  const [memberSuccess, setMemberSuccess] = useState(false);
  const [addingMember, setAddingMember] = useState(false);

  const handleUserSearch = useCallback(async (_: React.SyntheticEvent, value: string) => {
    if (value.length < 2) {
      setUserOptions([]);
      return;
    }
    setUserSearchLoading(true);
    try {
      const results = await searchUsers(value);
      setUserOptions(results);
    } catch {
      setUserOptions([]);
    } finally {
      setUserSearchLoading(false);
    }
  }, []);

  const handleAddMember = async () => {
    if (!selectedUser) return;
    setAddingMember(true);
    setError(null);
    try {
      await addMemberDirect(organizationId, selectedUser.id, memberRole);
      setMemberSuccess(true);
      onInvitationSent();
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      setError(apiErr.message || "Erreur lors de l'ajout du membre.");
    } finally {
      setAddingMember(false);
    }
  };

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
    setMode('email');
    setEmail('');
    setRole('MEMBER');
    setError(null);
    setResult(null);
    setCopied(false);
    setSelectedUser(null);
    setUserOptions([]);
    setMemberRole('MEMBER');
    setMemberSuccess(false);
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
          {result ? 'Invitation envoyee' : memberSuccess ? 'Membre ajoute' : 'Inviter un membre'}
        </Typography>
        <IconButton size="small" onClick={handleClose}>
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {!result && !memberSuccess ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
            <ToggleButtonGroup
              value={mode}
              exclusive
              onChange={(_, v) => { if (v) { setMode(v); setError(null); } }}
              size="small"
              fullWidth
            >
              <ToggleButton value="email">Inviter par email</ToggleButton>
              <ToggleButton value="existing">Membre existant</ToggleButton>
            </ToggleButtonGroup>

            {mode === 'email' ? (
              <>
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
              </>
            ) : (
              <>
                <Autocomplete
                  options={userOptions}
                  getOptionLabel={(option) =>
                    `${option.firstName} ${option.lastName} (${option.email})`
                  }
                  filterOptions={(x) => x}
                  value={selectedUser}
                  onChange={(_, value) => setSelectedUser(value)}
                  onInputChange={handleUserSearch}
                  loading={userSearchLoading}
                  noOptionsText="Aucun utilisateur trouve"
                  loadingText="Recherche..."
                  renderOption={(props, option) => (
                    <li {...props} key={option.id}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                        <Box sx={{ flexGrow: 1 }}>
                          <Typography variant="body2">
                            {option.firstName} {option.lastName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {option.email}
                          </Typography>
                        </Box>
                        {option.hasOrganization && (
                          <Chip label="Deja dans une org" size="small" color="warning" variant="outlined" />
                        )}
                      </Box>
                    </li>
                  )}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Rechercher un utilisateur..."
                      placeholder="Nom, prenom ou email (min. 2 caracteres)"
                      fullWidth
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {userSearchLoading ? <CircularProgress size={18} /> : null}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                />

                <TextField
                  label="Role"
                  select
                  value={memberRole}
                  onChange={(e) => setMemberRole(e.target.value)}
                  fullWidth
                  disabled={addingMember}
                  helperText="Le role attribue au membre"
                >
                  {ROLES.map((r) => (
                    <MenuItem key={r.value} value={r.value}>
                      {r.label}
                    </MenuItem>
                  ))}
                </TextField>
              </>
            )}

            {error && (
              <Alert severity="error" onClose={() => setError(null)}>
                {error}
              </Alert>
            )}
          </Box>
        ) : memberSuccess ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1, alignItems: 'center' }}>
            <CheckCircle sx={{ fontSize: 56, color: 'success.main' }} />
            <Typography variant="body1" textAlign="center">
              <strong>{selectedUser?.firstName} {selectedUser?.lastName}</strong> a ete ajoute a l'organisation.
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1, alignItems: 'center' }}>
            <CheckCircle sx={{ fontSize: 56, color: 'success.main' }} />
            <Typography variant="body1" textAlign="center">
              L'invitation a ete envoyee a <strong>{result?.invitedEmail}</strong>
            </Typography>

            {result?.invitationLink && (
              <Box sx={{ width: '100%' }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Vous pouvez aussi partager ce lien directement :
                </Typography>
                <TextField
                  value={result?.invitationLink ?? ''}
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
              {result?.expiresAt ? new Date(result.expiresAt).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              }) : ''}
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        {!result && !memberSuccess ? (
          <>
            <Button onClick={handleClose} disabled={loading || addingMember}>
              Annuler
            </Button>
            {mode === 'email' ? (
              <Button
                variant="contained"
                onClick={handleSend}
                disabled={loading || !email.trim()}
                startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <Send />}
              >
                {loading ? 'Envoi...' : 'Envoyer'}
              </Button>
            ) : (
              <Button
                variant="contained"
                onClick={handleAddMember}
                disabled={addingMember || !selectedUser}
                startIcon={addingMember ? <CircularProgress size={16} color="inherit" /> : <PersonAdd />}
              >
                {addingMember ? 'Ajout...' : 'Ajouter'}
              </Button>
            )}
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
