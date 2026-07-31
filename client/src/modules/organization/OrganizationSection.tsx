import React, { useState, useEffect } from 'react';
import { Alert as UiAlert, AlertDescription } from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Spinner } from '../../components/ui';
import { Button, Alert, Autocomplete, TextField, Chip, Grid } from '@mui/material';
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
              <UiAlert variant="destructive" className="mb-2">
                <TriangleAlert />
                <AlertDescription>{orgsError}</AlertDescription>
              </UiAlert>
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
                    <div className="flex items-center gap-1.5 w-full">
                      <p className="cn-text-body1 font-medium flex-1 text-[0.85rem]">
                        {option.name}
                      </p>
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
                      <p className="cn-text-body1 text-[0.7rem] text-muted-foreground tabular-nums">
                        {option.memberCount} membre{option.memberCount !== 1 ? 's' : ''}
                      </p>
                    </div>
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
                        {orgsLoading ? <Spinner className="size-4" /> : null}
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
                <p className="cn-text-body1 text-[10.5px] font-bold tracking-[0.08em] uppercase text-[var(--faint)] mb-1.5">
                  Membres de l'organisation
                </p>

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
          <div className="flex flex-col gap-3">
            {effectiveOrgId ? (
              <BillingSummaryCard
                organizationId={effectiveOrgId}
                refreshTrigger={refreshTrigger}
              />
            ) : (
              <SettingsSection title="Facturation" icon={Business} accent="accent">
                <p className="cn-text-body1 text-[0.78rem] text-muted-foreground text-center py-3">
                  Sélectionnez une organisation pour voir la facturation.
                </p>
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
          </div>
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
