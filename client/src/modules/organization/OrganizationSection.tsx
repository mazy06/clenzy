import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Alert,
  Autocomplete,
  TextField,
  Chip,
  CircularProgress,
  Grid,
} from '@mui/material';
import {
  Business,
  PersonAdd,
  InfoOutlined,
  Email,
} from '../../icons';
import { useAuth } from '../../hooks/useAuth';
import { organizationsApi, OrganizationDto } from '../../services/api/organizationsApi';
import SendInvitationDialog from './SendInvitationDialog';
import InvitationsList from './InvitationsList';
import MembersList from './MembersList';
import BillingSummaryCard from './BillingSummaryCard';
import SettingsSection from '../settings/components/SettingsSection';
import LaunchSettingsSection from '../settings/LaunchSettingsSection';
import PageTabs from '../../components/PageTabs';
import { Building2, Rocket } from 'lucide-react';

const ORG_TYPE_LABELS: Record<string, string> = {
  INDIVIDUAL: 'Particulier',
  CONCIERGE: 'Conciergerie',
  CLEANING_COMPANY: 'Societe de menage',
};

function getOrgTypeLabel(type: string): string {
  return ORG_TYPE_LABELS[type] || type;
}

const ORG_TYPE_COLORS: Record<string, string> = {
  INDIVIDUAL: '#7BA3C2',
  CONCIERGE: '#6B8A9A',
  CLEANING_COMPANY: '#4A9B8E',
};

function getOrgTypeColor(type: string): string {
  return ORG_TYPE_COLORS[type] || '#8A8378';
}

interface Props {
  organizationId?: number;
  organizationName?: string;
}

export default function OrganizationSection({ organizationId }: Props) {
  const { hasAnyRole } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  // Sous-onglets de la page Organisation : 0 = infos org (par-org, suit le
  // sélecteur), 1 = pré-lancement (config GLOBALE plateforme).
  const [subTab, setSubTab] = useState(0);

  const [organizations, setOrganizations] = useState<OrganizationDto[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<OrganizationDto | null>(null);
  const [orgsLoading, setOrgsLoading] = useState(false);
  const [orgsError, setOrgsError] = useState<string | null>(null);

  const isPlatformStaff = hasAnyRole(['SUPER_ADMIN', 'SUPER_MANAGER']);

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

        if (data.length > 0) {
          const userOrg = organizationId ? data.find((o) => o.id === organizationId) : null;
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

  if (!isPlatformStaff) {
    return null;
  }

  const triggerRefresh = () => setRefreshTrigger((prev) => prev + 1);
  const effectiveOrgId = selectedOrg?.id;

  // ── Aucune organisation dans le système ──
  if (!orgsLoading && organizations.length === 0 && !orgsError) {
    return (
      <SettingsSection title="Organisations" icon={Business} accent="primary">
        <Alert
          severity="info"
          icon={<InfoOutlined size={16} strokeWidth={1.75} />}
          sx={{ borderRadius: '8px' }}
        >
          Aucune organisation n'existe dans le systeme pour le moment.
        </Alert>
      </SettingsSection>
    );
  }

  const inviteAction = effectiveOrgId ? (
    <Button
      variant="contained"
      size="small"
      startIcon={<PersonAdd size={14} strokeWidth={2} />}
      onClick={() => setDialogOpen(true)}
      sx={{ '& .MuiButton-startIcon': { mr: 0.75 } }}
    >
      Inviter
    </Button>
  ) : undefined;

  return (
    <>
      <PageTabs
        options={[
          { label: 'Organisation', icon: <Building2 /> },
          { label: 'Pré-lancement', icon: <Rocket /> },
        ]}
        value={subTab}
        onChange={setSubTab}
        ariaLabel="Sous-sections de l'organisation"
      />

      {subTab === 0 && (
      <>
      <Grid container spacing={2}>
        {/* ─── Colonne gauche : Organisation ─────────────────────────── */}
        <Grid item xs={12} md={5}>
          <SettingsSection
            title="Organisations"
            icon={Business}
            accent="primary"
            action={inviteAction}
          >
            {orgsError && (
              <Alert severity="error" sx={{ mb: 1.5, borderRadius: '8px' }}>
                {orgsError}
              </Alert>
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
              renderOption={(props, option) => {
                const { key, ...optionProps } = props;
                const c = getOrgTypeColor(option.type);
                return (
                  <li key={key} {...optionProps}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                      <Typography sx={{ fontWeight: 500, flex: 1, fontSize: '0.85rem' }}>
                        {option.name}
                      </Typography>
                      <Chip
                        label={getOrgTypeLabel(option.type)}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: '0.65rem',
                          backgroundColor: `${c}18`,
                          color: c,
                          '& .MuiChip-label': { px: 0.75 },
                        }}
                      />
                      <Typography
                        sx={{
                          fontSize: '0.7rem',
                          color: 'text.secondary',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {option.memberCount} membre{option.memberCount !== 1 ? 's' : ''}
                      </Typography>
                    </Box>
                  </li>
                );
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Sélectionner une organisation"
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {orgsLoading ? <CircularProgress color="inherit" size={16} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
              sx={{ mb: 2 }}
              noOptionsText="Aucune organisation"
            />

            {effectiveOrgId ? (
              <>
                <Typography
                  sx={{
                    fontSize: '10.5px',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'var(--faint)',
                    mb: 1,
                  }}
                >
                  Membres de l'organisation
                </Typography>

                <MembersList
                  organizationId={effectiveOrgId}
                  refreshTrigger={refreshTrigger}
                  onMemberChanged={triggerRefresh}
                />
              </>
            ) : (
              <Alert
                severity="info"
                icon={<InfoOutlined size={16} strokeWidth={1.75} />}
                sx={{ borderRadius: '8px' }}
              >
                Sélectionnez une organisation pour voir ses membres et invitations.
              </Alert>
            )}
          </SettingsSection>
        </Grid>

        {/* ─── Colonne droite : Facturation + Invitations ─────────── */}
        <Grid item xs={12} md={7}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {effectiveOrgId ? (
              <BillingSummaryCard
                organizationId={effectiveOrgId}
                refreshTrigger={refreshTrigger}
              />
            ) : (
              <SettingsSection title="Facturation" icon={Business} accent="accent">
                <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', textAlign: 'center', py: 2 }}>
                  Sélectionnez une organisation pour voir la facturation.
                </Typography>
              </SettingsSection>
            )}

            {effectiveOrgId && (
              <SettingsSection title="Invitations envoyées" icon={Email} accent="info">
                <InvitationsList
                  organizationId={effectiveOrgId}
                  refreshTrigger={refreshTrigger}
                />
              </SettingsSection>
            )}
          </Box>
        </Grid>
      </Grid>
      </>
      )}

      {/* ─── Pré-lancement plateforme (toggle emails prospects + waitlist) ───
          Sous-onglet séparé : config GLOBALE plateforme, indépendante de l'org. */}
      {subTab === 1 && (
        <LaunchSettingsSection />
      )}

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
