import React from 'react';
import StatusChip, { type StatusTone } from '../../components/StatusChip';
import { Spinner, Button } from '../../components/ui';
import { Card as BuiCard } from '../../components/ui';
import { Container, Stepper, Step, StepLabel, FormControl, InputLabel, Select, MenuItem, Grid, Card, CardContent, List, ListItem, ListItemText, ListItemIcon, Checkbox, TextField, InputAdornment, Avatar } from '@mui/material';
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
      <Container maxWidth="lg">
        <PageHeader
          title={t('portfolios.forms.teamUserAssociation')}
          subtitle={t('portfolios.forms.teamUserAssociationSubtitle')}
          backPath="/portfolios"
          showBackButton={true}
        />
        <div className="flex justify-center items-center min-h-[300px]">
          <Spinner className="size-8" />
        </div>
      </Container>
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
            <FormControl fullWidth size="small">
              <InputLabel>{t('portfolios.fields.manager')}</InputLabel>
              <Select
                value={selectedManager}
                onChange={(e) => setSelectedManager(e.target.value as number)}
                label={t('portfolios.fields.manager')}
                displayEmpty
                sx={{ borderRadius: 2, fontSize: '0.85rem' }}
              >
                {managers.map((manager) => (
                  <MenuItem key={manager.id} value={manager.id}>
                    <div className="flex items-center gap-1.5">
                      <Avatar sx={{ width: 24, height: 24, fontSize: '0.6rem', fontFamily: 'var(--font-display)', fontWeight: 600, bgcolor: 'var(--accent)', color: 'var(--on-accent)', borderRadius: '8px' }}>
                        {manager.firstName.charAt(0)}{manager.lastName.charAt(0)}
                      </Avatar>
                      <p className="cn-text-body1 text-[0.85rem]">
                        {manager.firstName} {manager.lastName} - {manager.email}
                      </p>
                    </div>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
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
            <Grid container spacing={1.5}>
              {teams.map((team) => (
                <Grid item xs={12} sm={6} md={4} key={team.id}>
                  <Card
                    variant={selectedTeamsSet.has(team.id) ? 'elevation' : 'outlined'}
                    sx={{
                      cursor: 'pointer',
                      borderRadius: 2,
                      border: selectedTeamsSet.has(team.id) ? 2 : 1,
                      borderColor: selectedTeamsSet.has(team.id) ? 'var(--accent)' : 'var(--line)',
                      transition: 'border-color 0.2s ease',
                      '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
                      '&:hover': {
                        borderColor: 'var(--accent)',
                      },
                    }}
                    onClick={() => handleTeamToggle(team.id)}
                  >
                    <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                      <div className="flex items-center mb-1">
                        <Checkbox
                          checked={selectedTeamsSet.has(team.id)}
                          onChange={() => handleTeamToggle(team.id)}
                          size="small"
                          sx={{ p: 0.25, mr: 0.75 }}
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
                  </Card>
                </Grid>
              ))}
            </Grid>
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
            <TextField
              fullWidth
              size="small"
              placeholder={t('portfolios.fields.searchUser')}
              value={userSearchTerm}
              onChange={(e) => setUserSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <span className="inline-flex text-muted-foreground"><Search size={18} strokeWidth={1.75} /></span>
                  </InputAdornment>
                ),
              }}
              sx={{
                mb: 2,
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  fontSize: '0.85rem',
                },
              }}
            />

            {filteredUsers.length === 0 ? (
              <div className="text-center py-6">
                <span className="inline-flex text-muted-foreground opacity-60 mb-1.5"><People size={40} strokeWidth={1.75} /></span>
                <p className="cn-text-body2 text-muted-foreground text-[0.85rem]">
                  {userSearchTerm ? t('portfolios.fields.noUserFound') : t('portfolios.fields.noUserAvailable')}
                </p>
              </div>
            ) : (
              <Grid container spacing={1.5}>
                {filteredUsers.map((userItem) => (
                  <Grid item xs={12} sm={6} md={4} key={userItem.id}>
                    <Card
                      variant={selectedUsersSet.has(userItem.id) ? 'elevation' : 'outlined'}
                      sx={{
                        cursor: 'pointer',
                        borderRadius: 2,
                        border: selectedUsersSet.has(userItem.id) ? 2 : 1,
                        borderColor: selectedUsersSet.has(userItem.id) ? 'var(--accent)' : 'var(--line)',
                        transition: 'border-color 0.2s ease',
                        '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
                        '&:hover': {
                          borderColor: 'var(--accent)',
                        },
                      }}
                      onClick={() => handleUserToggle(userItem.id)}
                    >
                      <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                        <div className="flex items-center mb-1">
                          <Checkbox
                            checked={selectedUsersSet.has(userItem.id)}
                            onChange={() => handleUserToggle(userItem.id)}
                            size="small"
                            sx={{ p: 0.25, mr: 0.75 }}
                          />
                          <Avatar
                            sx={{
                              width: 24,
                              height: 24,
                              fontSize: '0.55rem',
                              fontWeight: 600,
                              bgcolor: 'var(--accent)',
                              color: 'var(--on-accent)',
                              fontFamily: 'var(--font-display)',
                              borderRadius: '8px',
                              mr: 0.75,
                            }}
                          >
                            {userItem.firstName.charAt(0)}{userItem.lastName.charAt(0)}
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
                    </Card>
                  </Grid>
                ))}
              </Grid>
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
                <Avatar sx={{ width: 28, height: 28, fontSize: '0.6rem', fontFamily: 'var(--font-display)', fontWeight: 600, bgcolor: 'var(--accent)', color: 'var(--on-accent)', borderRadius: '8px' }}>
                  {selectedManagerData?.firstName?.charAt(0)}{selectedManagerData?.lastName?.charAt(0)}
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

            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <BuiCard className="gap-0 py-0 p-3">
                  <h6 className="cn-text-subtitle2 text-[0.82rem] mb-1.5 flex items-center gap-0.5">
                    <Group size={16} strokeWidth={1.75} />
                    {t('portfolios.fields.selectedTeams')} ({selectedTeamsData.length})
                  </h6>
                  {selectedTeamsData.length > 0 ? (
                    <List dense disablePadding>
                      {selectedTeamsData.map((team) => (
                        <ListItem key={team.id} disableGutters sx={{ py: 0.5 }}>
                          <ListItemIcon sx={{ minWidth: 28 }}>
                            <span className="inline-flex text-[var(--ok)]"><CheckCircle size={16} strokeWidth={1.75} /></span>
                          </ListItemIcon>
                          <ListItemText
                            primary={<p className="cn-text-body1 text-[0.82rem]">{team.name}</p>}
                            secondary={
                              <span className="cn-text-caption text-[0.7rem]">
                                {team.memberCount ?? 0} {t('portfolios.fields.members')} {team.interventionType ? `\u2022 ${team.interventionType}` : ''}
                              </span>
                            }
                          />
                        </ListItem>
                      ))}
                    </List>
                  ) : (
                    <span className="cn-text-caption text-muted-foreground italic text-[0.75rem]">
                      {t('portfolios.fields.noTeamSelected')}
                    </span>
                  )}
                </BuiCard>
              </Grid>

              <Grid item xs={12} md={6}>
                <BuiCard className="gap-0 py-0 p-3">
                  <h6 className="cn-text-subtitle2 text-[0.82rem] mb-1.5 flex items-center gap-0.5">
                    <People size={16} strokeWidth={1.75} />
                    {t('portfolios.fields.selectedUsers')} ({selectedUsersData.length})
                  </h6>
                  {selectedUsersData.length > 0 ? (
                    <List dense disablePadding>
                      {selectedUsersData.map((userItem) => (
                        <ListItem key={userItem.id} disableGutters sx={{ py: 0.5 }}>
                          <ListItemIcon sx={{ minWidth: 28 }}>
                            <span className="inline-flex text-[var(--ok)]"><CheckCircle size={16} strokeWidth={1.75} /></span>
                          </ListItemIcon>
                          <ListItemText
                            primary={<p className="cn-text-body1 text-[0.82rem]">{userItem.firstName} {userItem.lastName}</p>}
                            secondary={
                              <span className="cn-text-caption text-[0.7rem]">
                                {userItem.email} {'\u2022'} {getRoleLabel(userItem.role)}
                              </span>
                            }
                          />
                        </ListItem>
                      ))}
                    </List>
                  ) : (
                    <span className="cn-text-caption text-muted-foreground italic text-[0.75rem]">
                      {t('portfolios.fields.noUserAvailable')}
                    </span>
                  )}
                </BuiCard>
              </Grid>
            </Grid>
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <Container maxWidth="lg">
      <PageHeader
        title={t('portfolios.forms.teamUserAssociation')}
        subtitle={t('portfolios.forms.teamUserAssociationSubtitle')}
        backPath="/portfolios"
        showBackButton={true}
      />

      <BuiCard className="gap-0 py-0 p-4 mt-3">
        <Stepper
          activeStep={activeStep}
          sx={{
            mb: 4,
            '& .MuiStepLabel-label': { fontSize: '0.82rem' },
          }}
        >
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
    </Container>
  );
};

export default TeamUserAssignmentForm;
