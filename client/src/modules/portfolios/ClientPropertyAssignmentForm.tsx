import React from 'react';
import { Card as BuiCard } from '../../components/ui';
import { Container, Stepper, Step, StepLabel, Button, FormControl, InputLabel, Select, MenuItem, Chip, CircularProgress, Grid, Card, CardContent, List, ListItem, ListItemText, ListItemIcon, Checkbox, Avatar } from '@mui/material';
import {
  People,
  Assignment,
  CheckCircle,
  ArrowForward,
  ArrowBack,
  Home,
  LocationOn,
} from '../../icons';
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
        <div className="flex justify-center items-center min-h-[300px]">
          <CircularProgress size={32} />
        </div>
      </Container>
    );
  }

  const getStepContent = (step: number) => {
    const selectedClientsSet = new Set(selectedClients);
    const selectedPropertiesSet = new Set(selectedProperties);
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
              {t('portfolios.fields.selectClientsToAssign')}
            </h6>
            <p className="cn-text-body2 text-muted-foreground text-[0.82rem] mb-3.5">
              {t('portfolios.fields.selectClientsDescription')}
            </p>

            <FormControl fullWidth size="small">
              <InputLabel>Clients (HOST)</InputLabel>
              <Select
                multiple
                value={selectedClients}
                onChange={(e) => {
                  const values = e.target.value as number[];
                  const valuesSet = new Set(values);
                  const lastAdded = values.find(v => !selectedClientsSet.has(v));
                  const lastRemoved = selectedClients.find(v => !valuesSet.has(v));
                  if (lastAdded) handleClientToggle(lastAdded);
                  if (lastRemoved) handleClientToggle(lastRemoved);
                }}
                label="Clients (HOST)"
                displayEmpty
                sx={{ borderRadius: 2, fontSize: '0.85rem' }}
                renderValue={(selected) => {
                  if (selected.length === 0) {
                    return <p className="cn-text-body2 text-muted-foreground">{t('portfolios.fields.selectClients')}</p>;
                  }
                  return selected.map(id => {
                    const client = hostUsers.find(c => c.id === id);
                    return client ? `${client.firstName} ${client.lastName}` : id;
                  }).join(', ');
                }}
              >
                {hostUsers.map((client) => (
                  <MenuItem key={client.id} value={client.id}>
                    <div className="flex items-center gap-1.5">
                      <Checkbox checked={selectedClientsSet.has(client.id)} size="small" />
                      <Avatar sx={{ width: 24, height: 24, fontSize: '0.6rem', fontFamily: 'var(--font-display)', fontWeight: 600, bgcolor: 'var(--accent)', color: 'var(--on-accent)', borderRadius: '8px' }}>
                        {client.firstName.charAt(0)}{client.lastName.charAt(0)}
                      </Avatar>
                      <p className="cn-text-body1 text-[0.85rem]">
                        {client.firstName} {client.lastName} - {client.email}
                      </p>
                    </div>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {selectedClients.length > 0 && (
              <div className="mt-3">
                <h6 className="cn-text-subtitle2 text-[0.82rem] mb-1.5">
                  {t('portfolios.fields.clientsSelected')} ({selectedClients.length}) :
                </h6>
                <div className="flex flex-wrap gap-1">
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
                </div>
              </div>
            )}
          </div>
        );

      case 2:
        return (
          <div>
            <h6 className="cn-text-subtitle1 font-semibold text-[0.9rem] mb-0.5">
              {t('portfolios.fields.selectProperties')}
            </h6>
            <p className="cn-text-body2 text-muted-foreground text-[0.82rem] mb-3.5">
              {t('portfolios.fields.propertiesDescription')}
            </p>

            {loading ? (
              <div className="flex justify-center py-6">
                <CircularProgress size={28} />
              </div>
            ) : (
              <Grid container spacing={1.5}>
                {properties.map((property) => (
                  <Grid item xs={12} sm={6} md={4} key={property.id}>
                    <Card
                      variant={selectedPropertiesSet.has(property.id) ? 'elevation' : 'outlined'}
                      sx={{
                        cursor: 'pointer',
                        borderRadius: 2,
                        border: selectedPropertiesSet.has(property.id) ? 2 : 1,
                        borderColor: selectedPropertiesSet.has(property.id) ? 'var(--accent)' : 'var(--line)',
                        transition: 'border-color 0.2s ease',
                        '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
                        '&:hover': {
                          borderColor: 'var(--accent)',
                        },
                      }}
                      onClick={() => handlePropertyToggle(property.id)}
                    >
                      <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                        <div className="flex items-center mb-1">
                          <Checkbox
                            checked={selectedPropertiesSet.has(property.id)}
                            onChange={() => handlePropertyToggle(property.id)}
                            size="small"
                            sx={{ p: 0.25, mr: 0.75 }}
                          />
                          <span className="inline-flex text-[var(--info)] me-1"><Home size={18} strokeWidth={1.75} /></span>
                          <h6 className="cn-text-subtitle2 text-[0.82rem] font-semibold truncate">
                            {property.name}
                          </h6>
                        </div>
                        <div className="flex items-center ms-5">
                          <span className="inline-flex text-muted-foreground me-0.5"><LocationOn size={13} strokeWidth={1.75} /></span>
                          <span className="cn-text-caption text-muted-foreground text-[0.7rem] truncate">
                            {property.address}, {property.city}
                          </span>
                        </div>
                        <div className="flex gap-1 mt-1 ms-5">
                          <Chip label={property.type} size="small" sx={{ height: 20, fontSize: '0.6rem' }} />
                          {property.status && (
                            <Chip
                              label={property.status}
                              size="small"
                              color={property.status === 'ACTIVE' ? 'success' : 'default'}
                              sx={{ height: 20, fontSize: '0.6rem' }}
                            />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}

            {properties.length === 0 && selectedClients.length > 0 && !loading && (
              <p className="cn-text-body2 text-muted-foreground text-center py-6 text-[0.82rem]">
                {t('portfolios.fields.noClientAssociated')}
              </p>
            )}
          </div>
        );

      case 3: {
        const selectedClientsData = hostUsers.filter(c => selectedClientsSet.has(c.id));
        const selectedPropertiesData = properties.filter(p => selectedPropertiesSet.has(p.id));
        const selectedManagerData = managers.find(m => m.id === selectedManager);

        return (
          <div>
            <h6 className="cn-text-subtitle1 font-semibold text-[0.9rem] mb-3">
              {t('portfolios.fields.confirmAssignments')}
            </h6>

            <BuiCard className="gap-0 py-0 p-3 mb-3">
              <h6 className="cn-text-subtitle2 text-[0.82rem] mb-0.5 flex items-center gap-0.5">
                <People size={16} strokeWidth={1.75} />
                {t('portfolios.fields.selectedManager')}
              </h6>
              {selectedManagerData ? (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Avatar sx={{ width: 28, height: 28, fontSize: '0.6rem', fontFamily: 'var(--font-display)', fontWeight: 600, bgcolor: 'var(--accent)', color: 'var(--on-accent)', borderRadius: '8px' }}>
                    {selectedManagerData.firstName.charAt(0)}{selectedManagerData.lastName.charAt(0)}
                  </Avatar>
                  <div>
                    <h6 className="cn-text-subtitle2 text-primary text-[0.85rem] font-semibold">
                      {selectedManagerData.firstName} {selectedManagerData.lastName}
                    </h6>
                    <span className="cn-text-caption text-muted-foreground text-[0.7rem]">
                      {selectedManagerData.email}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="cn-text-body2 text-destructive text-[0.82rem]">
                  {t('portfolios.confirmations.noManagerFound')}
                </p>
              )}
            </BuiCard>

            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <BuiCard className="gap-0 py-0 p-3">
                  <h6 className="cn-text-subtitle2 text-[0.82rem] mb-1.5 flex items-center gap-0.5">
                    <People size={16} strokeWidth={1.75} />
                    {t('portfolios.fields.selectedClients')} ({selectedClientsData.length})
                  </h6>
                  <List dense disablePadding>
                    {selectedClientsData.map((client) => (
                      <ListItem key={client.id} disableGutters sx={{ py: 0.5 }}>
                        <ListItemIcon sx={{ minWidth: 28 }}>
                          <span className="inline-flex text-[var(--ok)]"><CheckCircle size={16} strokeWidth={1.75} /></span>
                        </ListItemIcon>
                        <ListItemText
                          primary={<p className="cn-text-body1 text-[0.82rem]">{client.firstName} {client.lastName}</p>}
                          secondary={<span className="cn-text-caption text-[0.7rem]">{client.email}</span>}
                        />
                      </ListItem>
                    ))}
                  </List>
                </BuiCard>
              </Grid>

              <Grid item xs={12} md={6}>
                <BuiCard className="gap-0 py-0 p-3">
                  <h6 className="cn-text-subtitle2 text-[0.82rem] mb-1.5 flex items-center gap-0.5">
                    <Assignment size={16} strokeWidth={1.75} />
                    {t('portfolios.fields.selectedProperties')} ({selectedPropertiesData.length})
                  </h6>
                  <List dense disablePadding>
                    {selectedPropertiesData.map((property) => (
                      <ListItem key={property.id} disableGutters sx={{ py: 0.5 }}>
                        <ListItemIcon sx={{ minWidth: 28 }}>
                          <span className="inline-flex text-[var(--ok)]"><CheckCircle size={16} strokeWidth={1.75} /></span>
                        </ListItemIcon>
                        <ListItemText
                          primary={<p className="cn-text-body1 text-[0.82rem]">{property.name}</p>}
                          secondary={<span className="cn-text-caption text-[0.7rem]">{property.address}, {property.city}</span>}
                        />
                      </ListItem>
                    ))}
                  </List>
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
        title={t('portfolios.forms.clientPropertyAssociation')}
        subtitle={t('portfolios.forms.clientPropertyAssociationSubtitle')}
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
          <Button
            disabled={activeStep === 0}
            onClick={handleBack}
            startIcon={<ArrowBack size={16} strokeWidth={1.75} />}
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
              startIcon={submitting ? <CircularProgress size={16} /> : <CheckCircle size={16} strokeWidth={1.75} />}
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
              endIcon={<ArrowForward size={16} strokeWidth={1.75} />}
              size="small"
              sx={{ fontSize: '0.82rem' }}
            >
              {t('portfolios.forms.next')}
            </Button>
          )}
        </div>
      </BuiCard>
    </Container>
  );
};

export default ClientPropertyAssignmentForm;
