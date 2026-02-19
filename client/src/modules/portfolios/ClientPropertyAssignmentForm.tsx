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
  Avatar,
} from '@mui/material';
import {
  People,
  Assignment,
  CheckCircle,
  ArrowForward,
  ArrowBack,
  Home,
  LocationOn,
} from '@mui/icons-material';
import PageHeader from '../../components/PageHeader';
import { useClientPropertyAssignment } from './useClientPropertyAssignment';

// ─── Main component ──────────────────────────────────────────────────────────

const ClientPropertyAssignmentForm: React.FC = () => {
  const {
    user,
    activeStep,
    steps,
    handleNext,
    handleBack,
    canGoNext,
    managers,
    hostUsers,
    properties,
    loading,
    selectedManager,
    setSelectedManager,
    selectedClients,
    selectedProperties,
    handleClientToggle,
    handlePropertyToggle,
    handleSubmit,
    submitting,
    t,
  } = useClientPropertyAssignment();

  if (!user?.id) {
    return (
      <Container maxWidth="lg">
        <PageHeader
          title={t('portfolios.forms.clientPropertyAssociation')}
          subtitle={t('portfolios.forms.clientPropertyAssociationSubtitle')}
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
              {t('portfolios.fields.selectClientsToAssign')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.82rem', mb: 2.5 }}>
              {t('portfolios.fields.selectClientsDescription')}
            </Typography>

            <FormControl fullWidth size="small">
              <InputLabel>Clients (HOST)</InputLabel>
              <Select
                multiple
                value={selectedClients}
                onChange={(e) => {
                  const values = e.target.value as number[];
                  const lastAdded = values.find(v => !selectedClients.includes(v));
                  const lastRemoved = selectedClients.find(v => !values.includes(v));
                  if (lastAdded) handleClientToggle(lastAdded);
                  if (lastRemoved) handleClientToggle(lastRemoved);
                }}
                label="Clients (HOST)"
                displayEmpty
                sx={{ borderRadius: 2, fontSize: '0.85rem' }}
                renderValue={(selected) => {
                  if (selected.length === 0) {
                    return <Typography variant="body2" color="text.secondary">{t('portfolios.fields.selectClients')}</Typography>;
                  }
                  return selected.map(id => {
                    const client = hostUsers.find(c => c.id === id);
                    return client ? `${client.firstName} ${client.lastName}` : id;
                  }).join(', ');
                }}
              >
                {hostUsers.map((client) => (
                  <MenuItem key={client.id} value={client.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Checkbox checked={selectedClients.includes(client.id)} size="small" />
                      <Avatar sx={{ width: 24, height: 24, fontSize: '0.6rem', bgcolor: 'primary.main' }}>
                        {client.firstName.charAt(0)}{client.lastName.charAt(0)}
                      </Avatar>
                      <Typography sx={{ fontSize: '0.85rem' }}>
                        {client.firstName} {client.lastName} - {client.email}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {selectedClients.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" sx={{ fontSize: '0.82rem', mb: 1 }}>
                  {t('portfolios.fields.clientsSelected')} ({selectedClients.length}) :
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {selectedClients.map(clientId => {
                    const client = hostUsers.find(c => c.id === clientId);
                    return client ? (
                      <Chip
                        key={clientId}
                        label={`${client.firstName} ${client.lastName}`}
                        onDelete={() => handleClientToggle(clientId)}
                        color="primary"
                        variant="outlined"
                        size="small"
                        sx={{ fontSize: '0.75rem', height: 26 }}
                      />
                    ) : null;
                  })}
                </Box>
              </Box>
            )}
          </Box>
        );

      case 2:
        return (
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, fontSize: '0.9rem', mb: 0.5 }}>
              {t('portfolios.fields.selectProperties')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.82rem', mb: 2.5 }}>
              {t('portfolios.fields.propertiesDescription')}
            </Typography>

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={28} />
              </Box>
            ) : (
              <Grid container spacing={1.5}>
                {properties.map((property) => (
                  <Grid item xs={12} sm={6} md={4} key={property.id}>
                    <Card
                      variant={selectedProperties.includes(property.id) ? 'elevation' : 'outlined'}
                      sx={{
                        cursor: 'pointer',
                        borderRadius: 2,
                        border: selectedProperties.includes(property.id) ? 2 : 1,
                        borderColor: selectedProperties.includes(property.id) ? 'primary.main' : 'divider',
                        transition: 'all 0.2s ease-in-out',
                        '&:hover': {
                          borderColor: 'primary.main',
                          transform: 'translateY(-1px)',
                        },
                      }}
                      onClick={() => handlePropertyToggle(property.id)}
                    >
                      <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.75 }}>
                          <Checkbox
                            checked={selectedProperties.includes(property.id)}
                            onChange={() => handlePropertyToggle(property.id)}
                            size="small"
                            sx={{ p: 0.25, mr: 0.75 }}
                          />
                          <Home sx={{ fontSize: 18, mr: 0.75, color: 'info.main' }} />
                          <Typography variant="subtitle2" sx={{ fontSize: '0.82rem', fontWeight: 600 }} noWrap>
                            {property.name}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', ml: 3.5 }}>
                          <LocationOn sx={{ fontSize: 13, mr: 0.5, color: 'text.secondary' }} />
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }} noWrap>
                            {property.address}, {property.city}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 0.75, mt: 0.75, ml: 3.5 }}>
                          <Chip label={property.type} size="small" sx={{ height: 20, fontSize: '0.6rem' }} />
                          {property.status && (
                            <Chip
                              label={property.status}
                              size="small"
                              color={property.status === 'ACTIVE' ? 'success' : 'default'}
                              sx={{ height: 20, fontSize: '0.6rem' }}
                            />
                          )}
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}

            {properties.length === 0 && selectedClients.length > 0 && !loading && (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4, fontSize: '0.82rem' }}>
                {t('portfolios.fields.noClientAssociated')}
              </Typography>
            )}
          </Box>
        );

      case 3: {
        const selectedClientsData = hostUsers.filter(c => selectedClients.includes(c.id));
        const selectedPropertiesData = properties.filter(p => selectedProperties.includes(p.id));
        const selectedManagerData = managers.find(m => m.id === selectedManager);

        return (
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, fontSize: '0.9rem', mb: 2 }}>
              {t('portfolios.fields.confirmAssignments')}
            </Typography>

            <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ fontSize: '0.82rem', mb: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <People sx={{ fontSize: 16 }} />
                {t('portfolios.fields.selectedManager')}
              </Typography>
              {selectedManagerData ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                  <Avatar sx={{ width: 28, height: 28, fontSize: '0.6rem', bgcolor: 'primary.main' }}>
                    {selectedManagerData.firstName.charAt(0)}{selectedManagerData.lastName.charAt(0)}
                  </Avatar>
                  <Box>
                    <Typography variant="subtitle2" color="primary" sx={{ fontSize: '0.85rem', fontWeight: 600 }}>
                      {selectedManagerData.firstName} {selectedManagerData.lastName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                      {selectedManagerData.email}
                    </Typography>
                  </Box>
                </Box>
              ) : (
                <Typography variant="body2" color="error" sx={{ fontSize: '0.82rem' }}>
                  {t('portfolios.confirmations.noManagerFound')}
                </Typography>
              )}
            </Paper>

            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontSize: '0.82rem', mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <People sx={{ fontSize: 16 }} />
                    {t('portfolios.fields.selectedClients')} ({selectedClientsData.length})
                  </Typography>
                  <List dense disablePadding>
                    {selectedClientsData.map((client) => (
                      <ListItem key={client.id} disableGutters sx={{ py: 0.5 }}>
                        <ListItemIcon sx={{ minWidth: 28 }}>
                          <CheckCircle sx={{ fontSize: 16, color: 'success.main' }} />
                        </ListItemIcon>
                        <ListItemText
                          primary={<Typography sx={{ fontSize: '0.82rem' }}>{client.firstName} {client.lastName}</Typography>}
                          secondary={<Typography variant="caption" sx={{ fontSize: '0.7rem' }}>{client.email}</Typography>}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Paper>
              </Grid>

              <Grid item xs={12} md={6}>
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontSize: '0.82rem', mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Assignment sx={{ fontSize: 16 }} />
                    {t('portfolios.fields.selectedProperties')} ({selectedPropertiesData.length})
                  </Typography>
                  <List dense disablePadding>
                    {selectedPropertiesData.map((property) => (
                      <ListItem key={property.id} disableGutters sx={{ py: 0.5 }}>
                        <ListItemIcon sx={{ minWidth: 28 }}>
                          <CheckCircle sx={{ fontSize: 16, color: 'success.main' }} />
                        </ListItemIcon>
                        <ListItemText
                          primary={<Typography sx={{ fontSize: '0.82rem' }}>{property.name}</Typography>}
                          secondary={<Typography variant="caption" sx={{ fontSize: '0.7rem' }}>{property.address}, {property.city}</Typography>}
                        />
                      </ListItem>
                    ))}
                  </List>
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
        title={t('portfolios.forms.clientPropertyAssociation')}
        subtitle={t('portfolios.forms.clientPropertyAssociationSubtitle')}
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
              disabled={submitting || !selectedManager || selectedClients.length === 0 || selectedProperties.length === 0}
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

export default ClientPropertyAssignmentForm;
