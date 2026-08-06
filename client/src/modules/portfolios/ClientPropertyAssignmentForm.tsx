import React from 'react';
import { cn } from '../../utils/cn';
import StatusChip from '../../components/StatusChip';
import { Badge } from '../../components/ui';
import { Spinner } from '../../components/ui';
import { Card as BuiCard } from '../../components/ui';
import {
  Avatar,
  AvatarFallback,
  Button,
  Checkbox,
  Field,
  FieldLabel,
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Step,
  StepLabel,
  Stepper,
} from '../../components/ui';
import {
  People,
  Assignment,
  CheckCircle,
  ArrowForward,
  ArrowBack,
  ExpandMore,
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
      // Container maxWidth="lg" MUI = 1200 px centres + gouttieres.
      <div className="mx-auto w-full max-w-[1200px] px-4">
        <PageHeader
          title={t('portfolios.forms.clientPropertyAssociation')}
          subtitle={t('portfolios.forms.clientPropertyAssociationSubtitle')}
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
    const selectedClientsSet = new Set(selectedClients);
    const selectedPropertiesSet = new Set(selectedProperties);
    switch (step) {
      case 0:
        return (
          <div>
            <h6 className="text-sm font-semibold tracking-tight mb-0.5">
              {t('portfolios.steps.selectManagerTitle')}
            </h6>
            <p className="text-xs text-muted-foreground mb-3.5">
              {t('portfolios.steps.selectManagerDescription')}
            </p>
            <Field>
              <FieldLabel htmlFor="assign-manager">{t('portfolios.fields.manager')}</FieldLabel>
              <Select
                value={selectedManager === '' ? '' : String(selectedManager)}
                onValueChange={(value) => setSelectedManager(Number(value))}
              >
                <SelectTrigger id="assign-manager" size="sm" className="w-full text-[0.85rem]">
                  <SelectValue placeholder={t('portfolios.fields.manager')} />
                </SelectTrigger>
                <SelectContent>
                  {managers.map((manager) => (
                    <SelectItem key={manager.id} value={String(manager.id)}>
                      <div className="flex items-center gap-1.5">
                        <Avatar className="size-6 rounded-[8px] after:rounded-[8px]">
                          <AvatarFallback className="rounded-md bg-primary text-primary-foreground text-[0.6rem] font-semibold font-[family-name:var(--font-display)]">
                            {manager.firstName.charAt(0)}{manager.lastName.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <p className="text-[0.85rem]">
                          {manager.firstName} {manager.lastName} - {manager.email}
                        </p>
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
            <h6 className="text-sm font-semibold tracking-tight mb-0.5">
              {t('portfolios.fields.selectClientsToAssign')}
            </h6>
            <p className="text-xs text-muted-foreground mb-3.5">
              {t('portfolios.fields.selectClientsDescription')}
            </p>

            {/* Le Select du kit ne connait pas le mode `multiple` : la liste a
                cocher passe donc par un Popover, ce qui rend exactement ce que
                faisait le Select MUI (resume dans le champ, cases dans le menu).
                Le declencheur est un bouton NATIF et non le Button du kit :
                Radix pose sa ref d'ancrage sur cet enfant, qu'un composant
                fonction ne transmet pas. */}
            <Field>
              <FieldLabel htmlFor="assign-clients">Clients (HOST)</FieldLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    id="assign-clients"
                    type="button"
                    className="flex h-8 w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-solid border-border bg-transparent px-2.5 py-1 text-start text-[0.85rem] transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className={cn('truncate', selectedClients.length === 0 && 'text-muted-foreground')}>
                      {selectedClients.length === 0
                        ? t('portfolios.fields.selectClients')
                        : selectedClients
                            .map((id) => {
                              const client = hostUsers.find((c) => c.id === id);
                              return client ? `${client.firstName} ${client.lastName}` : id;
                            })
                            .join(', ')}
                    </span>
                    <ExpandMore size={16} strokeWidth={1.75} className="shrink-0 text-muted-foreground" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] max-h-[320px] overflow-y-auto p-1">
                  {hostUsers.map((client) => (
                    <button
                      key={client.id}
                      type="button"
                      // Bouton bascule : `aria-pressed` porte l'etat coche, la
                      // case qui suit n'etant qu'un rendu (aucun role listbox
                      // parent, donc pas de role="option" ici).
                      aria-pressed={selectedClientsSet.has(client.id)}
                      onClick={() => handleClientToggle(client.id)}
                      className="flex w-full cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 text-start hover:bg-muted"
                    >
                      {/* Purement indicatif : c'est le clic sur la ligne qui
                          pilote la selection, comme avec la case MUI. */}
                      <Checkbox checked={selectedClientsSet.has(client.id)} tabIndex={-1} className="pointer-events-none" />
                      <Avatar className="size-6 rounded-[8px] after:rounded-[8px]">
                        <AvatarFallback className="rounded-md bg-primary text-primary-foreground text-[0.6rem] font-semibold font-[family-name:var(--font-display)]">
                          {client.firstName.charAt(0)}{client.lastName.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <p className="truncate text-[0.85rem]">
                        {client.firstName} {client.lastName} - {client.email}
                      </p>
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
            </Field>

            {selectedClients.length > 0 && (
              <div className="mt-3">
                <h6 className="text-xs font-medium mb-1.5">
                  {t('portfolios.fields.clientsSelected')} ({selectedClients.length}) :
                </h6>
                <div className="flex flex-wrap gap-1">
                  {selectedClients.map(clientId => {
                    const client = hostUsers.find(c => c.id === clientId);
                    return client ? (
                      <StatusChip
                        key={clientId}
                        tone="accent"
                        label={`${client.firstName} ${client.lastName}`}
                        onDelete={() => handleClientToggle(clientId)}
                        deleteLabel={`Retirer ${client.firstName} ${client.lastName}`}
                        className="h-[26px] text-[0.75rem]"
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
            <h6 className="text-sm font-semibold tracking-tight mb-0.5">
              {t('portfolios.fields.selectProperties')}
            </h6>
            <p className="text-xs text-muted-foreground mb-3.5">
              {t('portfolios.fields.propertiesDescription')}
            </p>

            {loading ? (
              <div className="flex justify-center py-6">
                <Spinner className="size-7" />
              </div>
            ) : (
              <div className="grid grid-cols-12 gap-[9px]">
                {properties.map((property) => (
                  <div className="col-span-12 min-[600px]:col-span-6 min-[900px]:col-span-4" key={property.id}>
                    <BuiCard
                      className={cn(
                        'gap-0 px-3 py-[9px] cursor-pointer rounded-2xl border border-solid transition-colors duration-200 motion-reduce:transition-none hover:border-primary',
                        selectedPropertiesSet.has(property.id)
                          ? 'border-primary bg-primary-soft/50'
                          : 'border-border',
                      )}
                      onClick={() => handlePropertyToggle(property.id)}
                    >
                      <div className="flex items-center mb-1">
                        <Checkbox
                          checked={selectedPropertiesSet.has(property.id)}
                          onCheckedChange={() => handlePropertyToggle(property.id)}
                          className="me-1"
                        />
                        <span className="inline-flex text-info me-1"><Home size={18} strokeWidth={1.75} /></span>
                        <h6 className="text-xs font-semibold truncate">
                          {property.name}
                        </h6>
                      </div>
                      <div className="flex items-center ms-5">
                        <span className="inline-flex text-muted-foreground me-0.5"><LocationOn size={13} strokeWidth={1.75} /></span>
                        <span className="text-[0.7rem] text-muted-foreground truncate">
                          {property.address}, {property.city}
                        </span>
                      </div>
                      <div className="flex gap-1 mt-1 ms-5">
                        <Badge variant="secondary" className="h-[20px] text-[0.6rem]">{property.type}</Badge>
                        {property.status && (
                          <StatusChip
                            tone={property.status === 'ACTIVE' ? 'ok' : 'neutral'}
                            label={property.status}
                            className="h-[20px] text-[0.6rem]"
                          />
                        )}
                      </div>
                    </BuiCard>
                  </div>
                ))}
              </div>
            )}

            {properties.length === 0 && selectedClients.length > 0 && !loading && (
              <p className="text-xs text-muted-foreground text-center py-6">
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
            <h6 className="text-sm font-semibold tracking-tight mb-3">
              {t('portfolios.fields.confirmAssignments')}
            </h6>

            <BuiCard className="gap-0 py-0 p-3 mb-3">
              <h6 className="text-xs font-medium mb-0.5 flex items-center gap-0.5">
                <People size={16} strokeWidth={1.75} />
                {t('portfolios.fields.selectedManager')}
              </h6>
              {selectedManagerData ? (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Avatar className="size-7 rounded-[8px] after:rounded-[8px]">
                    <AvatarFallback className="rounded-md bg-primary text-primary-foreground text-[0.6rem] font-semibold font-[family-name:var(--font-display)]">
                      {selectedManagerData.firstName.charAt(0)}{selectedManagerData.lastName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h6 className="text-primary text-[0.85rem] font-semibold">
                      {selectedManagerData.firstName} {selectedManagerData.lastName}
                    </h6>
                    <span className="text-[0.7rem] text-muted-foreground">
                      {selectedManagerData.email}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-destructive">
                  {t('portfolios.confirmations.noManagerFound')}
                </p>
              )}
            </BuiCard>

            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-12 min-[900px]:col-span-6">
                <BuiCard className="gap-0 py-0 p-3">
                  <h6 className="text-xs font-medium mb-1.5 flex items-center gap-0.5">
                    <People size={16} strokeWidth={1.75} />
                    {t('portfolios.fields.selectedClients')} ({selectedClientsData.length})
                  </h6>
                  <ItemGroup>
                    {selectedClientsData.map((client) => (
                      <Item key={client.id} size="xs" className="px-0 py-[3px]">
                        <ItemMedia variant="icon" className="min-w-[28px] text-success">
                          <CheckCircle size={16} strokeWidth={1.75} />
                        </ItemMedia>
                        <ItemContent>
                          <ItemTitle className="text-[0.82rem] font-normal">{client.firstName} {client.lastName}</ItemTitle>
                          <ItemDescription className="text-[0.7rem]">{client.email}</ItemDescription>
                        </ItemContent>
                      </Item>
                    ))}
                  </ItemGroup>
                </BuiCard>
              </div>

              <div className="col-span-12 min-[900px]:col-span-6">
                <BuiCard className="gap-0 py-0 p-3">
                  <h6 className="text-xs font-medium mb-1.5 flex items-center gap-0.5">
                    <Assignment size={16} strokeWidth={1.75} />
                    {t('portfolios.fields.selectedProperties')} ({selectedPropertiesData.length})
                  </h6>
                  <ItemGroup>
                    {selectedPropertiesData.map((property) => (
                      <Item key={property.id} size="xs" className="px-0 py-[3px]">
                        <ItemMedia variant="icon" className="min-w-[28px] text-success">
                          <CheckCircle size={16} strokeWidth={1.75} />
                        </ItemMedia>
                        <ItemContent>
                          <ItemTitle className="text-[0.82rem] font-normal">{property.name}</ItemTitle>
                          <ItemDescription className="text-[0.7rem]">{property.address}, {property.city}</ItemDescription>
                        </ItemContent>
                      </Item>
                    ))}
                  </ItemGroup>
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
    <div className="mx-auto w-full max-w-[1200px] px-4">
      <PageHeader
        title={t('portfolios.forms.clientPropertyAssociation')}
        subtitle={t('portfolios.forms.clientPropertyAssociationSubtitle')}
        backPath="/portfolios"
        showBackButton={true}
      />

      <BuiCard className="gap-0 py-0 p-4 mt-3">
        {/* mb: 4 = 24 px (spacing MUI du projet = 6 px) */}
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
          <Button
            variant="ghost"
            size="sm"
            disabled={activeStep === 0}
            onClick={handleBack}
          >
            <ArrowBack strokeWidth={1.75} />
            {t('portfolios.forms.back')}
          </Button>

          {activeStep === steps.length - 1 ? (
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={submitting || !selectedManager || selectedClients.length === 0 || selectedProperties.length === 0}
            >
              {submitting ? <Spinner className="size-4" /> : <CheckCircle strokeWidth={1.75} />}
              {submitting ? t('portfolios.forms.assigning') : t('portfolios.forms.confirmAssignments')}
            </Button>
          ) : (
            <Button size="sm" onClick={handleNext} disabled={!canGoNext}>
              {t('portfolios.forms.next')}
              <ArrowForward strokeWidth={1.75} />
            </Button>
          )}
        </div>
      </BuiCard>
    </div>
  );
};

export default ClientPropertyAssignmentForm;
