import React, { useState, useEffect } from 'react';
import StatusChip from '../../components/StatusChip';
import { Alert, AlertDescription } from '../../components/ui';
import { TriangleAlert } from '../../icons/glyphs';
import { Spinner, Button } from '../../components/ui';
import { Field, FieldDescription, FieldLabel } from '../../components/ui';
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from '../../components/ui/combobox';
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
import { Building2, Rocket } from '../../icons/glyphs';
import { useTranslation } from '../../hooks/useTranslation';

const ORG_TYPE_LABELS: Record<string, string> = {
  INDIVIDUAL: 'Particulier',
  CONCIERGE: 'Conciergerie',
  CLEANING_COMPANY: 'Societe de menage',
};

function getOrgTypeLabel(type: string, t: (key: string, fallback: string) => string): string {
  const fallback = ORG_TYPE_LABELS[type];
  return fallback ? t('organizations.types.' + type, fallback) : type;
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
  const { t } = useTranslation();
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
        setOrgsError(t('organizations.section.loadError'));
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
      <SettingsSection title={t('organizations.section.title')} icon={Business} accent="primary">
        <Alert variant="info">
          <InfoOutlined size={16} strokeWidth={1.75} />
          <AlertDescription>
            {t('organizations.section.noneInSystem')}
          </AlertDescription>
        </Alert>
      </SettingsSection>
    );
  }

  const inviteAction = effectiveOrgId ? (
    <Button size="sm" onClick={() => setDialogOpen(true)}>
      <PersonAdd size={14} strokeWidth={2} />
      {t('organizations.section.invite')}
    </Button>
  ) : undefined;

  return (
    <>
      <PageTabs
        options={[
          { label: t('organizations.section.tabOrganization'), icon: <Building2 /> },
          { label: t('organizations.section.tabPrelaunch'), icon: <Rocket /> },
        ]}
        value={subTab}
        onChange={setSubTab}
        ariaLabel={t('organizations.section.subTabsAria')}
      />

      {subTab === 0 && (
      <>
      <div className="grid grid-cols-12 gap-3">
        {/* ─── Colonne gauche : Organisation ─────────────────────────── */}
        <div className="col-span-12 min-[900px]:col-span-5">
          <SettingsSection
            title={t('organizations.section.title')}
            icon={Business}
            accent="primary"
            action={inviteAction}
          >
            {orgsError && (
              <Alert variant="destructive" className="mb-2">
                <TriangleAlert />
                <AlertDescription>{orgsError}</AlertDescription>
              </Alert>
            )}

            <Field className="mb-3">
              <FieldLabel htmlFor="organization-picker">{t('organizations.section.pick')}</FieldLabel>
              <Combobox
                items={organizations}
                value={selectedOrg}
                onValueChange={(next) => {
                  setSelectedOrg(next);
                  setRefreshTrigger(0);
                }}
                itemToStringLabel={(option: OrganizationDto) => option.name}
                isItemEqualToValue={(option: OrganizationDto, value: OrganizationDto) => option.id === value.id}
              >
                <ComboboxInput
                  id="organization-picker"
                  placeholder={t('organizations.section.pick')}
                  disabled={orgsLoading}
                />
                <ComboboxContent>
                  <ComboboxEmpty>{t('organizations.section.none')}</ComboboxEmpty>
                  <ComboboxList>
                    {(option: OrganizationDto) => {
                      const c = getOrgTypeColor(option.type);
                      return (
                        <ComboboxItem key={option.id} value={option}>
                          <div className="flex items-center gap-1.5 w-full">
                            <p className="text-sm font-medium flex-1">
                              {option.name}
                            </p>
                            {/* Teinte du type d'organisation : valeur runtime hors
                                palette sémantique → fond doux dérivé par la primitive. */}
                            <StatusChip color={c} label={getOrgTypeLabel(option.type, t)} className="h-[20px] text-2xs" />
                            <p className="text-2xs text-muted-foreground tabular-nums">
                              {t('organizations.section.memberCount', { count: option.memberCount })}
                            </p>
                          </div>
                        </ComboboxItem>
                      );
                    }}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
              {/* L'attente ne tient plus dans un adornment du champ (le kit n'en
                  expose pas) : elle se dit sous le champ, en texte d'aide. */}
              {orgsLoading && (
                <FieldDescription className="flex items-center gap-1.5">
                  <Spinner className="size-3.5" />
                  {t('organizations.section.loading')}
                </FieldDescription>
              )}
            </Field>

            {effectiveOrgId ? (
              <>
                <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                  {t('organizations.section.members')}
                </p>

                <MembersList
                  organizationId={effectiveOrgId}
                  refreshTrigger={refreshTrigger}
                  onMemberChanged={triggerRefresh}
                />
              </>
            ) : (
              <Alert variant="info">
                <InfoOutlined size={16} strokeWidth={1.75} />
                <AlertDescription>
                  {t('organizations.section.pickForMembers')}
                </AlertDescription>
              </Alert>
            )}
          </SettingsSection>
        </div>

        {/* ─── Colonne droite : Facturation + Invitations ─────────── */}
        <div className="col-span-12 min-[900px]:col-span-7">
          <div className="flex flex-col gap-3">
            {effectiveOrgId ? (
              <BillingSummaryCard
                organizationId={effectiveOrgId}
                refreshTrigger={refreshTrigger}
              />
            ) : (
              <SettingsSection title={t('organizations.section.billing')} icon={Business} accent="accent">
                <p className="text-xs text-muted-foreground text-center py-3">
                  {t('organizations.section.pickForBilling')}
                </p>
              </SettingsSection>
            )}

            {effectiveOrgId && (
              <SettingsSection title={t('organizations.section.invitationsSent')} icon={Email} accent="info">
                <InvitationsList
                  organizationId={effectiveOrgId}
                  refreshTrigger={refreshTrigger}
                />
              </SettingsSection>
            )}
          </div>
        </div>
      </div>
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
