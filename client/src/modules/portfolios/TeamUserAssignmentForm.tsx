import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Container,
  Stepper,
  Step,
  StepLabel,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  CircularProgress,
  Grid,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Checkbox,
  TextField,
  InputAdornment,
  Avatar,
} from '@mui/material';
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
} from '@mui/icons-material';
import PageHeader from '../../components/PageHeader';
import { useTeamUserAssignment } from './useTeamUserAssignment';

// ─── Role Icon Helper ────────────────────────────────────────────────────────

function getRoleIcon(role: string) {
  switch (role) {
    case 'HOUSEKEEPER': return <CleaningServices sx={{ fontSize: 16 }} />;
    case 'TECHNICIAN': return <Build sx={{ fontSize: 16 }} />;
    case 'LAUNDRY': return <CleaningServices sx={{ fontSize: 16 }} />;
    case 'EXTERIOR_TECH': return <Build sx={{ fontSize: 16 }} />;
    case 'SUPERVISOR': return <SupervisorAccount sx={{ fontSize: 16 }} />;
    default: return <Person sx={{ fontSize: 16 }} />;
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
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
          <CircularProgress size={32} />
        </Box>
      </Container>
    );
  }

  const getStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, fontSize: '0.9rem', mb: 0.5 }}>
              {t('portfolios.steps.selectManagerTitle')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.82rem', mb: 2.5 }}>
              {t('portfolios.steps.selectManagerDescription')}
            </Typography>
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
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar sx={{ width: 24, height: 24, fontSize: '0.6rem', bgcolor: 'primary.main' }}>
                        {manager.firstName.charAt(0)}{manager.lastName.charAt(0)}
                      </Avatar>
                      <Typography sx={{ fontSize: '0.85rem' }}>
                        {manager.firstName} {manager.lastName} - {manager.email}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        );

      case 1:
        return (
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, fontSize: '0.9rem', mb: 0.5 }}>
              {t('portfolios.fields.selectTeams')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.82rem', mb: 2.5 }}>
              {t('portfolios.fields.selectTeamsDescription')}{' '}
              <strong>{t('portfolios.fields.optionalStep')}</strong>
            </Typography>
            <Grid container spacing={1.5}>
              {teams.map((team) => (
                <Grid item xs={12} sm={6} md={4} key={team.id}>
                  <Card
                    variant={selectedTeams.includes(team.id) ? 'elevation' : 'outlined'}
                    sx={{
                      cursor: 'pointer',
                      borderRadius: 2,
                      border: selectedTeams.includes(team.id) ? 2 : 1,
                      borderColor: selectedTeams.includes(team.id) ? 'primary.main' : 'divider',
                      transition: 'all 0.2s ease-in-out',
                      '&:hover': {
                        borderColor: 'primary.main',
                        transform: 'translateY(-1px)',
                      },
                    }}
                    onClick={() => handleTeamToggle(team.id)}
                  >
                    <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.75 }}>
                        <Checkbox
                          checked={selectedTeams.includes(team.id)}
                          onChange={() => handleTeamToggle(team.id)}
                          size="small"
                          sx={{ p: 0.25, mr: 0.75 }}
                        />
                        <Group sx={{ fontSize: 18, mr: 0.75, color: 'primary.main' }} />
                        <Typography variant="subtitle2" sx={{ fontSize: '0.82rem', fontWeight: 600 }}>
                          {team.name}
                        </Typography>
                      </Box>
                      {team.description && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', ml: 3.5, fontSize: '0.72rem', mb: 0.5 }}>
                          {team.description}
                        </Typography>
                      )}
                      <Box sx={{ display: 'flex', gap: 0.75, ml: 3.5, alignItems: 'center' }}>
                        {team.interventionType && (
                          <Chip
                            label={team.interventionType}
                            size="small"
                            color={team.interventionType === 'CLEANING' ? 'success' : 'info'}
                            sx={{ height: 20, fontSize: '0.6rem' }}
                          />
                        )}
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                          {team.memberCount ?? 0} {t('portfolios.fields.members')}
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        );

      case 2:
        return (
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, fontSize: '0.9rem', mb: 0.5 }}>
              {t('portfolios.fields.selectUsers')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.82rem', mb: 2 }}>
              {t('portfolios.fields.selectUsersDescription')}
              {selectedTeams.length === 0 ? (
                <strong> {t('portfolios.fields.mustSelectAtLeastOneUser')}</strong>
              ) : (
                <strong> {t('portfolios.fields.optionalSelection')}</strong>
              )}
            </Typography>

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
                    <Search sx={{ fontSize: 18, color: 'text.secondary' }} />
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
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <People sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
                  {userSearchTerm ? t('portfolios.fields.noUserFound') : t('portfolios.fields.noUserAvailable')}
                </Typography>
              </Box>
            ) : (
              <Grid container spacing={1.5}>
                {filteredUsers.map((userItem) => (
                  <Grid item xs={12} sm={6} md={4} key={userItem.id}>
                    <Card
                      variant={selectedUsers.includes(userItem.id) ? 'elevation' : 'outlined'}
                      sx={{
                        cursor: 'pointer',
                        borderRadius: 2,
                        border: selectedUsers.includes(userItem.id) ? 2 : 1,
                        borderColor: selectedUsers.includes(userItem.id) ? 'primary.main' : 'divider',
                        transition: 'all 0.2s ease-in-out',
                        '&:hover': {
                          borderColor: 'primary.main',
                          transform: 'translateY(-1px)',
                        },
                      }}
                      onClick={() => handleUserToggle(userItem.id)}
                    >
                      <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.75 }}>
                          <Checkbox
                            checked={selectedUsers.includes(userItem.id)}
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
                              bgcolor: `${getRoleColor(userItem.role)}.main`,
                              mr: 0.75,
                            }}
                          >
                            {userItem.firstName.charAt(0)}{userItem.lastName.charAt(0)}
                          </Avatar>
                          <Typography variant="subtitle2" sx={{ fontSize: '0.82rem', fontWeight: 600 }}>
                            {userItem.firstName} {userItem.lastName}
                          </Typography>
                        </Box>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', ml: 3.5, fontSize: '0.7rem', mb: 0.5 }}>
                          {userItem.email}
                        </Typography>
                        <Box sx={{ ml: 3.5 }}>
                          <Chip
                            label={getRoleLabel(userItem.role)}
                            size="small"
                            color={getRoleColor(userItem.role)}
                            icon={getRoleIcon(userItem.role)}
                            sx={{ height: 22, fontSize: '0.65rem' }}
                          />
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </Box>
        );

      case 3: {
        const selectedTeamsData = teams.filter(t => selectedTeams.includes(t.id));
        const allUsers = filteredUsers.length > 0 ? filteredUsers : [];
        const selectedUsersData = allUsers.filter(u => selectedUsers.includes(u.id));
        const selectedManagerData = isAdmin
          ? managers.find(m => m.id === selectedManager)
          : { firstName: user?.firstName, lastName: user?.lastName, email: user?.email };

        return (
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, fontSize: '0.9rem', mb: 2 }}>
              {t('portfolios.fields.confirmAssignments')}
            </Typography>

            {/* Manager */}
            <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ fontSize: '0.82rem', mb: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <People sx={{ fontSize: 16 }} />
                {t('portfolios.fields.selectedManager')}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                <Avatar sx={{ width: 28, height: 28, fontSize: '0.6rem', bgcolor: 'primary.main' }}>
                  {selectedManagerData?.firstName?.charAt(0)}{selectedManagerData?.lastName?.charAt(0)}
                </Avatar>
                <Box>
                  <Typography variant="subtitle2" color="primary" sx={{ fontSize: '0.85rem', fontWeight: 600 }}>
                    {selectedManagerData?.firstName} {selectedManagerData?.lastName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                    {selectedManagerData?.email}
                  </Typography>
                </Box>
              </Box>
            </Paper>

            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontSize: '0.82rem', mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Group sx={{ fontSize: 16 }} />
                    {t('portfolios.fields.selectedTeams')} ({selectedTeamsData.length})
                  </Typography>
                  {selectedTeamsData.length > 0 ? (
                    <List dense disablePadding>
                      {selectedTeamsData.map((team) => (
                        <ListItem key={team.id} disableGutters sx={{ py: 0.5 }}>
                          <ListItemIcon sx={{ minWidth: 28 }}>
                            <CheckCircle sx={{ fontSize: 16, color: 'success.main' }} />
                          </ListItemIcon>
                          <ListItemText
                            primary={<Typography sx={{ fontSize: '0.82rem' }}>{team.name}</Typography>}
                            secondary={
                              <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                                {team.memberCount ?? 0} {t('portfolios.fields.members')} {team.interventionType ? `\u2022 ${team.interventionType}` : ''}
                              </Typography>
                            }
                          />
                        </ListItem>
                      ))}
                    </List>
                  ) : (
                    <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', fontSize: '0.75rem' }}>
                      {t('portfolios.fields.noTeamSelected')}
                    </Typography>
                  )}
                </Paper>
              </Grid>

              <Grid item xs={12} md={6}>
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontSize: '0.82rem', mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <People sx={{ fontSize: 16 }} />
                    {t('portfolios.fields.selectedUsers')} ({selectedUsersData.length})
                  </Typography>
                  {selectedUsersData.length > 0 ? (
                    <List dense disablePadding>
                      {selectedUsersData.map((userItem) => (
                        <ListItem key={userItem.id} disableGutters sx={{ py: 0.5 }}>
                          <ListItemIcon sx={{ minWidth: 28 }}>
                            <CheckCircle sx={{ fontSize: 16, color: 'success.main' }} />
                          </ListItemIcon>
                          <ListItemText
                            primary={<Typography sx={{ fontSize: '0.82rem' }}>{userItem.firstName} {userItem.lastName}</Typography>}
                            secondary={
                              <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                                {userItem.email} {'\u2022'} {getRoleLabel(userItem.role)}
                              </Typography>
                            }
                          />
                        </ListItem>
                      ))}
                    </List>
                  ) : (
                    <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', fontSize: '0.75rem' }}>
                      {t('portfolios.fields.noUserAvailable')}
                    </Typography>
                  )}
                </Paper>
              </Grid>
            </Grid>
          </Box>
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

      <Paper sx={{ p: 3, borderRadius: 2, mt: 2 }}>
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

        <Box sx={{ mb: 4, minHeight: 200 }}>
          {getStepContent(activeStep)}
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button
            disabled={activeStep === 0}
            onClick={handleBack}
            startIcon={<ArrowBack sx={{ fontSize: 16 }} />}
            size="small"
            sx={{ fontSize: '0.82rem' }}
          >
            {t('portfolios.forms.back')}
          </Button>

          {activeStep === steps.length - 1 ? (
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={submitting || !selectedManager || (selectedTeams.length === 0 && selectedUsers.length === 0)}
              startIcon={submitting ? <CircularProgress size={16} /> : <CheckCircle sx={{ fontSize: 16 }} />}
              size="small"
              sx={{ fontSize: '0.82rem' }}
            >
              {submitting ? t('portfolios.forms.assigning') : t('portfolios.forms.confirmAssignments')}
            </Button>
          ) : (
            <Button
              variant="contained"
              onClick={handleNext}
              disabled={!canGoNext}
              endIcon={<ArrowForward sx={{ fontSize: 16 }} />}
              size="small"
              sx={{ fontSize: '0.82rem' }}
            >
              {t('portfolios.forms.next')}
            </Button>
          )}
        </Box>
      </Paper>
    </Container>
  );
};

export default TeamUserAssignmentForm;
