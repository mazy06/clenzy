import React from 'react';
import { cn } from '../../utils/cn';
import StatusChip, { type StatusTone } from '../../components/StatusChip';
import { Spinner, Button } from '../../components/ui';
import { Card as BuiCard, CardContent } from '../../components/ui';
import {
  Avatar,
  AvatarFallback,
  Checkbox,
  Field,
  FieldLabel,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui';
import { Stepper, Step, StepLabel } from '../../components/ui';
import { InputGroup, InputGroupAddon, InputGroupInput } from '../../components/ui';
import {
  People,
  Group,
  CheckCircle,
  ArrowForward,
  ArrowBack,
  Person,
  Build,
  CleaningServices,
  SupervisorAccount,
  Search,
} from '../../icons';
import PageHeader from '../../components/PageHeader';
import { useTeamUserAssignment } from './useTeamUserAssignment';

// `getRoleColor` du hook rend un nom de couleur MUI : on le transpose ici, le
// hook etant partage avec d'autres ecrans.
const ROLE_TONE: Record<string, StatusTone> = {
  primary: 'accent',
  secondary: 'neutral',
  success: 'ok',
  warning: 'warn',
  error: 'err',
  info: 'info',
  default: 'neutral',
};

// ─── Role Icon Helper ────────────────────────────────────────────────────────

function getRoleIcon(role: string) {
  switch (role) {
    case 'HOUSEKEEPER': return <CleaningServices size={16} strokeWidth={1.75} />;
    case 'TECHNICIAN': return <Build size={16} strokeWidth={1.75} />;
    case 'LAUNDRY': return <CleaningServices size={16} strokeWidth={1.75} />;
    case 'EXTERIOR_TECH': return <Build size={16} strokeWidth={1.75} />;
    case 'SUPERVISOR': return <SupervisorAccount size={16} strokeWidth={1.75} />;
    default: return <Person size={16} strokeWidth={1.75} />;
  }
}

// ─── Main component ──────────────────────────────────────────────────────────

const TeamUserAssignmentForm: React.FC = () => {
  const {
    user,
    isAdmin,
    activeStep,
    steps,
    handleNext,
    handleBack,
    canGoNext,
    managers,
    teams,
    filteredUsers,
    selectedManager,
    setSelectedManager,
    selectedTeams,
    selectedUsers,
    userSearchTerm,
    setUserSearchTerm,
    handleTeamToggle,
    handleUserToggle,
    handleSubmit,
    submitting,
    getRoleColor,
    getRoleLabel,
    t,
  } = useTeamUserAssignment();

  if (!user?.id) {
    return (
      <div className="mx-auto w-full max-w-[1200px] px-3 min-[600px]:px-[18px]">
        <PageHeader
          title={t('portfolios.forms.teamUserAssociation')}
          subtitle={t('portfolios.forms.teamUserAssociationSubtitle')}
          backPath="/portfolios"
          showBackButton={true}
        />
        <div className="flex justify-center items-center min-h-[300px]">
          <Spinner className="size-8" />
        </div>
      </div>
    );
  }

  const getStepContent = (step: number) => {
    const selectedTeamsSet = new Set(selectedTeams);
    const selectedUsersSet = new Set(selectedUsers);
    switch (step) {
      case 0:
        return (
          <div>
            <h6 className="cn-text-subtitle1 font-semibold text-[0.9rem] mb-0.5">
              {t('portfolios.steps.selectManagerTitle')}
            </h6>
            <p className="cn-text-body2 text-muted-foreground text-[0.82rem] mb-3.5">
              {t('portfolios.steps.selectManagerDescription')}
            </p>
            <Field>
              <FieldLabel htmlFor="team-user-manager">{t('portfolios.fields.manager')}</FieldLabel>
              {/* Select « riche » et non NativeSelect : chaque option porte un
                  avatar, qu'une <option> native ne peut pas afficher. */}
              <Select
                value={selectedManager === '' ? '' : String(selectedManager)}
                onValueChange={(value) => setSelectedManager(Number(value))}
              >
                <SelectTrigger id="team-user-manager" className="w-full text-[0.85rem]">
                  <SelectValue placeholder={t('portfolios.fields.manager')} />
                </SelectTrigger>
                <SelectContent>
                  {managers.map((manager) => (
                    <SelectItem key={manager.id} value={String(manager.id)}>
                      <div className="flex items-center gap-1.5">
                        <Avatar className="size-6 rounded-[8px] after:rounded-[8px]">
                          <AvatarFallback className="rounded-[8px] bg-[var(--accent)] text-[var(--on-accent)] text-[0.6rem] font-semibold font-[family-name:var(--font-display)]">
                            {manager.firstName.charAt(0)}{manager.lastName.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="cn-text-body1 text-[0.85rem]">
                          {manager.firstName} {manager.lastName} - {manager.email}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        );

      case 1:
        return (
          <div>
            <h6 className="cn-text-subtitle1 font-semibold text-[0.9rem] mb-0.5">
              {t('portfolios.fields.selectTeams')}
            </h6>
            <p className="cn-text-body2 text-muted-foreground text-[0.82rem] mb-3.5">
              {t('portfolios.fields.selectTeamsDescription')}{' '}
              <strong>{t('portfolios.fields.optionalStep')}</strong>
            </p>
            <div className="grid grid-cols-12 gap-[9px]">
              {teams.map((team) => (
                <div className="col-span-12 min-[600px]:col-span-6 min-[900px]:col-span-4" key={team.id}>
                  <BuiCard
                    className={cn(
                      // `border-solid` obligatoire : le gabarit pose border-none,
                      // sans quoi la largeur existe mais le lisere reste invisible.
                      'cursor-pointer rounded-[16px] border-solid ring-0 gap-0 py-[9px] transition-[border-color] duration-200 motion-reduce:transition-none hover:border-[var(--accent)]',
                      selectedTeamsSet.has(team.id)
                        ? 'border-2 border-[var(--accent)]'
                        : 'border border-[var(--line)]',
                    )}
                    onClick={() => handleTeamToggle(team.id)}
                  >
                    <CardContent className="px-3">
                      <div className="flex items-center mb-1">
                        <Checkbox
                          className="me-[4.5px]"
                          checked={selectedTeamsSet.has(team.id)}
                          onCheckedChange={() => handleTeamToggle(team.id)}
                        />
                        <span className="inline-flex text-[var(--accent)] me-1"><Group size={18} strokeWidth={1.75} /></span>
                        <h6 className="cn-text-subtitle2 text-[0.82rem] font-semibold">
                          {team.name}
                        </h6>
                      </div>
                      {team.description && (
                        <span className="cn-text-caption text-muted-foreground block ms-5 text-[0.72rem] mb-0.5">
                          {team.description}
                        </span>
                      )}
                      <div className="flex gap-1 ms-5 items-center">
                        {team.interventionType && (
                          <StatusChip
                            tone={team.interventionType === 'CLEANING' ? 'ok' : 'info'}
                            label={team.interventionType}
                            className="h-[20px] text-[0.6rem]"
                          />
                        )}
                        <span className="cn-text-caption text-muted-foreground text-[0.65rem]">
                          {team.memberCount ?? 0} {t('portfolios.fields.members')}
                        </span>
                      </div>
                    </CardContent>
                  </BuiCard>
                </div>
              ))}
            </div>
          </div>
        );

      case 2:
        return (
          <div>
            <h6 className="cn-text-subtitle1 font-semibold text-[0.9rem] mb-0.5">
              {t('portfolios.fields.selectUsers')}
            </h6>
            <p className="cn-text-body2 text-muted-foreground text-[0.82rem] mb-3">
              {t('portfolios.fields.selectUsersDescription')}
              {selectedTeams.length === 0 ? (
                <strong> {t('portfolios.fields.mustSelectAtLeastOneUser')}</strong>
              ) : (
                <strong> {t('portfolios.fields.optionalSelection')}</strong>
              )}
            </p>

            {/* Search bar */}
            {/* Champ sans libelle visible (la section porte deja son titre) :
                l'aria-label reste la seule etiquette. */}
            <InputGroup className="mb-3">
              <InputGroupAddon align="inline-start">
                <span className="inline-flex text-muted-foreground"><Search size={18} strokeWidth={1.75} /></span>
              </InputGroupAddon>
              <InputGroupInput
                id="team-user-search"
                aria-label={t('portfolios.fields.searchUser')}
                placeholder={t('portfolios.fields.searchUser')}
                value={userSearchTerm}
                onChange={(e) => setUserSearchTerm(e.target.value)}
              />
            </InputGroup>

            {filteredUsers.length === 0 ? (
              <div className="text-center py-6">
                <span className="inline-flex text-muted-foreground opacity-60 mb-1.5"><People size={40} strokeWidth={1.75} /></span>
                <p className="cn-text-body2 text-muted-foreground text-[0.85rem]">
                  {userSearchTerm ? t('portfolios.fields.noUserFound') : t('portfolios.fields.noUserAvailable')}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-12 gap-[9px]">
                {filteredUsers.map((userItem) => (
                  <div className="col-span-12 min-[600px]:col-span-6 min-[900px]:col-span-4" key={userItem.id}>
                    <BuiCard
                      className={cn(
                        'cursor-pointer rounded-[16px] border-solid ring-0 gap-0 py-[9px] transition-[border-color] duration-200 motion-reduce:transition-none hover:border-[var(--accent)]',
                        selectedUsersSet.has(userItem.id)
                          ? 'border-2 border-[var(--accent)]'
                          : 'border border-[var(--line)]',
                      )}
                      onClick={() => handleUserToggle(userItem.id)}
                    >
                      <CardContent className="px-3">
                        <div className="flex items-center mb-1">
                          <Checkbox
                            className="me-[4.5px]"
                            checked={selectedUsersSet.has(userItem.id)}
                            onCheckedChange={() => handleUserToggle(userItem.id)}
                          />
                          <Avatar className="size-6 rounded-[8px] after:rounded-[8px] me-[4.5px]">
                            <AvatarFallback className="rounded-[8px] bg-[var(--accent)] text-[var(--on-accent)] text-[0.55rem] font-semibold font-[family-name:var(--font-display)]">
                              {userItem.firstName.charAt(0)}{userItem.lastName.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <h6 className="cn-text-subtitle2 text-[0.82rem] font-semibold">
                            {userItem.firstName} {userItem.lastName}
                          </h6>
                        </div>
                        <span className="cn-text-caption text-muted-foreground block ms-5 text-[0.7rem] mb-0.5">
                          {userItem.email}
                        </span>
                        <div className="ms-5">
                          <StatusChip
                            tone={ROLE_TONE[getRoleColor(userItem.role)] ?? 'neutral'}
                            label={getRoleLabel(userItem.role)}
                            icon={getRoleIcon(userItem.role)}
                            className="text-[0.65rem]"
                          />
                        </div>
                      </CardContent>
                    </BuiCard>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 3: {
        const selectedTeamsData = teams.filter(t => selectedTeamsSet.has(t.id));
        const allUsers = filteredUsers.length > 0 ? filteredUsers : [];
        const selectedUsersData = allUsers.filter(u => selectedUsersSet.has(u.id));
        const selectedManagerData = isAdmin
          ? managers.find(m => m.id === selectedManager)
          : { firstName: user?.firstName, lastName: user?.lastName, email: user?.email };

        return (
          <div>
            <h6 className="cn-text-subtitle1 font-semibold text-[0.9rem] mb-3">
              {t('portfolios.fields.confirmAssignments')}
            </h6>

            {/* Manager */}
            <BuiCard className="gap-0 py-0 p-3 mb-3">
              <h6 className="cn-text-subtitle2 text-[0.82rem] mb-0.5 flex items-center gap-0.5">
                <People size={16} strokeWidth={1.75} />
                {t('portfolios.fields.selectedManager')}
              </h6>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Avatar className="size-7 rounded-[8px] after:rounded-[8px]">
                  <AvatarFallback className="rounded-[8px] bg-[var(--accent)] text-[var(--on-accent)] text-[0.6rem] font-semibold font-[family-name:var(--font-display)]">
                    {selectedManagerData?.firstName?.charAt(0)}{selectedManagerData?.lastName?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h6 className="cn-text-subtitle2 text-primary text-[0.85rem] font-semibold">
                    {selectedManagerData?.firstName} {selectedManagerData?.lastName}
                  </h6>
                  <span className="cn-text-caption text-muted-foreground text-[0.7rem]">
                    {selectedManagerData?.email}
                  </span>
                </div>
              </div>
            </BuiCard>

            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-12 min-[900px]:col-span-6">
                <BuiCard className="gap-0 py-0 p-3">
                  <h6 className="cn-text-subtitle2 text-[0.82rem] mb-1.5 flex items-center gap-0.5">
                    <Group size={16} strokeWidth={1.75} />
                    {t('portfolios.fields.selectedTeams')} ({selectedTeamsData.length})
                  </h6>
                  {selectedTeamsData.length > 0 ? (
                    <ul className="list-none m-0 p-0">
                      {selectedTeamsData.map((team) => (
                        <li className="flex items-center py-[3px]" key={team.id}>
                          <span className="inline-flex text-[var(--ok)] min-w-[28px]"><CheckCircle size={16} strokeWidth={1.75} /></span>
                          <div className="min-w-0">
                            <p className="cn-text-body1 text-[0.82rem]">{team.name}</p>
                            <span className="cn-text-caption text-muted-foreground text-[0.7rem]">
                              {team.memberCount ?? 0} {t('portfolios.fields.members')} {team.interventionType ? `\u2022 ${team.interventionType}` : ''}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="cn-text-caption text-muted-foreground italic text-[0.75rem]">
                      {t('portfolios.fields.noTeamSelected')}
                    </span>
                  )}
                </BuiCard>
              </div>

              <div className="col-span-12 min-[900px]:col-span-6">
                <BuiCard className="gap-0 py-0 p-3">
                  <h6 className="cn-text-subtitle2 text-[0.82rem] mb-1.5 flex items-center gap-0.5">
                    <People size={16} strokeWidth={1.75} />
                    {t('portfolios.fields.selectedUsers')} ({selectedUsersData.length})
                  </h6>
                  {selectedUsersData.length > 0 ? (
                    <ul className="list-none m-0 p-0">
                      {selectedUsersData.map((userItem) => (
                        <li className="flex items-center py-[3px]" key={userItem.id}>
                          <span className="inline-flex text-[var(--ok)] min-w-[28px]"><CheckCircle size={16} strokeWidth={1.75} /></span>
                          <div className="min-w-0">
                            <p className="cn-text-body1 text-[0.82rem]">{userItem.firstName} {userItem.lastName}</p>
                            <span className="cn-text-caption text-muted-foreground text-[0.7rem]">
                              {userItem.email} {'\u2022'} {getRoleLabel(userItem.role)}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="cn-text-caption text-muted-foreground italic text-[0.75rem]">
                      {t('portfolios.fields.noUserAvailable')}
                    </span>
                  )}
                </BuiCard>
              </div>
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1200px] px-3 min-[600px]:px-[18px]">
      <PageHeader
        title={t('portfolios.forms.teamUserAssociation')}
        subtitle={t('portfolios.forms.teamUserAssociationSubtitle')}
        backPath="/portfolios"
        showBackButton={true}
      />

      <BuiCard className="gap-0 py-0 p-4 mt-3">
        <Stepper activeStep={activeStep} className="mb-6">
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        <div className="mb-6 min-h-[200px]">
          {getStepContent(activeStep)}
        </div>

        <div className="flex justify-between">
          <Button variant="ghost" size="sm" disabled={activeStep === 0} onClick={handleBack}>
            <ArrowBack size={16} strokeWidth={1.75} />
            {t('portfolios.forms.back')}
          </Button>

          {activeStep === steps.length - 1 ? (
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={submitting || !selectedManager || (selectedTeams.length === 0 && selectedUsers.length === 0)}
            >
              {submitting ? <Spinner className="size-4" /> : <CheckCircle size={16} strokeWidth={1.75} />}
              {submitting ? t('portfolios.forms.assigning') : t('portfolios.forms.confirmAssignments')}
            </Button>
          ) : (
            <Button size="sm" onClick={handleNext} disabled={!canGoNext}>
              {t('portfolios.forms.next')}
              <ArrowForward size={16} strokeWidth={1.75} />
            </Button>
          )}
        </div>
      </BuiCard>
    </div>
  );
};

export default TeamUserAssignmentForm;
