import React, { useState, useEffect } from 'react';
import {
  Paper,
  Box,
  Typography,
  Button,
  Divider,
  Alert,
  Autocomplete,
  TextField,
  Chip,
  CircularProgress,
} from '@mui/material';
import {
  Business,
  PersonAdd,
  InfoOutlined,
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import { organizationsApi, OrganizationDto } from '../../services/api/organizationsApi';
import SendInvitationDialog from './SendInvitationDialog';
import InvitationsList from './InvitationsList';
import MembersList from './MembersList';

// ─── Labels FR pour les types d'organisation ─────────────────────────────────

const ORG_TYPE_LABELS: Record<string, string> = {
  INDIVIDUAL: 'Particulier',
  CONCIERGE: 'Conciergerie',
  CLEANING_COMPANY: 'Societe de menage',
};

function getOrgTypeLabel(type: string): string {
  return ORG_TYPE_LABELS[type] || type;
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  organizationId?: number;
  organizationName?: string;
}

// ─── Composant ───────────────────────────────────────────────────────────────

export default function OrganizationSection({ organizationId, organizationName }: Props) {
  const { hasAnyRole } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // State pour le selecteur multi-org (staff plateforme)
  const [organizations, setOrganizations] = useState<OrganizationDto[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<OrganizationDto | null>(null);
  const [orgsLoading, setOrgsLoading] = useState(false);
  const [orgsError, setOrgsError] = useState<string | null>(null);

  const isPlatformStaff = hasAnyRole(['SUPER_ADMIN', 'SUPER_MANAGER']);

  // Charger la liste des organisations pour le staff plateforme
  // IMPORTANT : tous les hooks doivent etre appeles avant tout early return
  useEffect(() => {
    if (!isPlatformStaff) return;

    let cancelled = false;
    const loadOrganizations = async () => {
      setOrgsLoading(true);
      setOrgsError(null);
      try {
        const data = await organizationsApi.listAll();
        if (cancelled) return;
        setOrganizations(data);

        // Pre-selectionner l'org de l'utilisateur, sinon la premiere
        if (data.length > 0) {
          const userOrg = organizationId
            ? data.find((o) => o.id === organizationId)
            : null;
          setSelectedOrg(userOrg || data[0]);
        }
      } catch {
        if (cancelled) return;
        setOrgsError('Impossible de charger les organisations');
      } finally {
        if (!cancelled) setOrgsLoading(false);
      }
    };

    loadOrganizations();
    return () => { cancelled = true; };
  }, [isPlatformStaff, organizationId]);

  // Early return APRES tous les hooks
  if (!isPlatformStaff) {
    return null;
  }

  const triggerRefresh = () => setRefreshTrigger((prev) => prev + 1);

  // Org effective = celle selectionnee dans le selecteur
  const effectiveOrgId = selectedOrg?.id;

  // ─── Rendu : aucune organisation dans le systeme ─────────────────────────

  if (!orgsLoading && organizations.length === 0 && !orgsError) {
    return (
      <Paper sx={{ p: 2, height: '100%' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <Business sx={{ color: 'primary.main', fontSize: 20 }} />
          <Typography variant="subtitle1" fontWeight={600} sx={{ fontSize: '0.95rem' }}>
            Organisations
          </Typography>
        </Box>
        <Divider sx={{ mb: 2 }} />
        <Alert severity="info" icon={<InfoOutlined />}>
          Aucune organisation n'existe dans le systeme pour le moment.
        </Alert>
      </Paper>
    );
  }

  return (
    <>
      <Paper sx={{ p: 2, height: '100%' }}>
        {/* ─── Header ───────────────────────────────────────────────────── */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Business sx={{ color: 'primary.main', fontSize: 20 }} />
            <Typography variant="subtitle1" fontWeight={600} sx={{ fontSize: '0.95rem' }}>
              Organisations
            </Typography>
          </Box>
          {effectiveOrgId && (
            <Button
              variant="contained"
              size="small"
              startIcon={<PersonAdd />}
              onClick={() => setDialogOpen(true)}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              Inviter
            </Button>
          )}
        </Box>

        <Divider sx={{ mb: 1.5 }} />

        {/* ─── Selecteur d'organisation ──────────────────────────────────── */}
        {orgsError && (
          <Alert severity="error" sx={{ mb: 1.5 }}>{orgsError}</Alert>
        )}

        <Autocomplete
          size="small"
          options={organizations}
          value={selectedOrg}
          loading={orgsLoading}
          onChange={(_event, newValue) => {
            setSelectedOrg(newValue);
            setRefreshTrigger(0);
          }}
          getOptionLabel={(option) => option.name}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          renderOption={(props, option) => (
            <li {...props} key={option.id}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                <Typography variant="body2" sx={{ fontWeight: 500, flex: 1 }}>
                  {option.name}
                </Typography>
                <Chip
                  label={getOrgTypeLabel(option.type)}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: '0.7rem', height: 20 }}
                />
                <Typography variant="caption" color="text.secondary">
                  {option.memberCount} membre{option.memberCount !== 1 ? 's' : ''}
                </Typography>
              </Box>
            </li>
          )}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Selectionner une organisation"
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {orgsLoading ? <CircularProgress color="inherit" size={18} /> : null}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
            />
          )}
          sx={{ mb: 2 }}
          noOptionsText="Aucune organisation"
        />

        {/* ─── Contenu de l'organisation selectionnee ─────────────────── */}
        {effectiveOrgId ? (
          <>
            {/* Section Membres */}
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, fontWeight: 500 }}>
              Membres de l'organisation
            </Typography>

            <MembersList
              organizationId={effectiveOrgId}
              refreshTrigger={refreshTrigger}
              onMemberChanged={triggerRefresh}
            />

            <Divider sx={{ my: 2 }} />

            {/* Section Invitations */}
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, fontWeight: 500 }}>
              Invitations envoyees
            </Typography>

            <InvitationsList
              organizationId={effectiveOrgId}
              refreshTrigger={refreshTrigger}
            />
          </>
        ) : (
          <Alert severity="info" icon={<InfoOutlined />}>
            Selectionnez une organisation pour voir ses membres et invitations.
          </Alert>
        )}
      </Paper>

      {effectiveOrgId && (
        <SendInvitationDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          organizationId={effectiveOrgId}
          onInvitationSent={triggerRefresh}
        />
      )}
    </>
  );
}
