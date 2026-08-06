import React from 'react';
import { cn } from '../../utils/cn';
import StatusChip, { type ToneTokens } from '../../components/StatusChip';
import { FORM_TAG_TOKENS, FORM_TAG_CLASS } from './serviceRequestsListConstants';
import { Field, FieldError, FieldLabel, Input } from '../../components/ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui';
import {
  Home,
  Person,
  Bed,
  Bathtub,
  SquareFoot,
  Layers,
  Deck,
  LocalLaundryService,
  People,
  Category,
  Window,
  DoorSliding,
  Iron,
  Kitchen,
  AutoAwesome,
} from '../../icons';
import { Controller, Control, FieldErrors } from 'react-hook-form';
import { useTranslation } from '../../hooks/useTranslation';
import { getPropertyTypeLabel } from '../../utils/statusUtils';
import type { ServiceRequestFormValues } from '../../schemas';

interface Property {
  id: number;
  name: string;
  address: string;
  city: string;
  type: string;
  ownerId?: number;
  // Caractéristiques logement
  bedroomCount?: number;
  bathroomCount?: number;
  squareMeters?: number;
  maxGuests?: number;
  // Tarification ménage
  cleaningDurationMinutes?: number;
  cleaningBasePrice?: number;
  cleaningNotes?: string;
  cleaningFrequency?: string;
  numberOfFloors?: number;
  hasExterior?: boolean;
  hasLaundry?: boolean;
  // Prestations à la carte
  windowCount?: number;
  frenchDoorCount?: number;
  slidingDoorCount?: number;
  hasIroning?: boolean;
  hasDeepKitchen?: boolean;
  hasDisinfection?: boolean;
  // Check-in/out
  defaultCheckInTime?: string;
  defaultCheckOutTime?: string;
}

interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

/** Info utilisateur connecté pour affichage demandeur en lecture seule */
interface CurrentUserInfo {
  name: string;
  role: string;
  roleLabel: string;
}

export interface ServiceRequestFormPropertyProps {
  control: Control<ServiceRequestFormValues>;
  errors: FieldErrors<ServiceRequestFormValues>;
  properties: Property[];
  users: User[];
  isAdminOrManager: boolean;
  selectedProperty?: Property | null;
  disabled?: boolean;
  /** Info de l'utilisateur connecté — si fourni, le demandeur est affiché en lecture seule */
  currentUser?: CurrentUserInfo | null;
}

/**
 * Ton de la pastille de rôle du demandeur. Encre `-ink` sur fond `-soft` : la
 * teinte vive en TEXTE plafonne à ~2,2:1 sur son propre pastel.
 */
const REQUESTOR_ROLE_TOKENS: Record<string, ToneTokens> = {
  ADMIN: { color: 'var(--bui-destructive-ink)', bg: 'var(--bui-destructive-soft)' },
  MANAGER: { color: 'var(--bui-warning-ink)', bg: 'var(--bui-warning-soft)' },
};

const REQUESTOR_ROLE_FALLBACK: ToneTokens = { color: 'var(--bui-primary)', bg: 'var(--bui-primary-soft)' };

// Chip neutre « champ » : fond de champ, icône de marque (géométrie pilule du gabarit).
const ServiceRequestFormProperty: React.FC<ServiceRequestFormPropertyProps> = React.memo(
  ({ control, errors, properties, users, isAdminOrManager, selectedProperty, disabled = false, currentUser }) => {
    const { t } = useTranslation();

    // Construire les tags caractéristiques du logement sélectionné
    const propertyTags = React.useMemo(() => {
      if (!selectedProperty) return [];
      const tags: { icon: React.ReactElement; label: string }[] = [];

      // Type de logement
      if (selectedProperty.type) {
        tags.push({
          icon: <Category size={14} strokeWidth={1.75} />,
          label: getPropertyTypeLabel(selectedProperty.type, t),
        });
      }

      // Surface
      if (selectedProperty.squareMeters && selectedProperty.squareMeters > 0) {
        tags.push({
          icon: <SquareFoot size={14} strokeWidth={1.75} />,
          label: `${selectedProperty.squareMeters} m²`,
        });
      }

      // Chambres
      if (selectedProperty.bedroomCount && selectedProperty.bedroomCount > 0) {
        tags.push({
          icon: <Bed size={14} strokeWidth={1.75} />,
          label: `${selectedProperty.bedroomCount} ${selectedProperty.bedroomCount > 1 ? 'chambres' : 'chambre'}`,
        });
      }

      // Salles de bain
      if (selectedProperty.bathroomCount && selectedProperty.bathroomCount > 0) {
        tags.push({
          icon: <Bathtub size={14} strokeWidth={1.75} />,
          label: `${selectedProperty.bathroomCount} SDB`,
        });
      }

      // Capacité
      if (selectedProperty.maxGuests && selectedProperty.maxGuests > 0) {
        tags.push({
          icon: <People size={14} strokeWidth={1.75} />,
          label: `${selectedProperty.maxGuests} voyageurs`,
        });
      }

      // Étages
      if (selectedProperty.numberOfFloors && selectedProperty.numberOfFloors > 1) {
        tags.push({
          icon: <Layers size={14} strokeWidth={1.75} />,
          label: `${selectedProperty.numberOfFloors} étages`,
        });
      }

      // Extérieur
      if (selectedProperty.hasExterior) {
        tags.push({
          icon: <Deck size={14} strokeWidth={1.75} />,
          label: 'Extérieur',
        });
      }

      // Linge
      if (selectedProperty.hasLaundry) {
        tags.push({
          icon: <LocalLaundryService size={14} strokeWidth={1.75} />,
          label: 'Linge',
        });
      }

      // Fenêtres
      if (selectedProperty.windowCount && selectedProperty.windowCount > 0) {
        tags.push({
          icon: <Window size={14} strokeWidth={1.75} />,
          label: `${selectedProperty.windowCount} fenêtres`,
        });
      }

      // Porte-fenêtres
      if (selectedProperty.frenchDoorCount && selectedProperty.frenchDoorCount > 0) {
        tags.push({
          icon: <DoorSliding size={14} strokeWidth={1.75} />,
          label: `${selectedProperty.frenchDoorCount} portes-fenêtres`,
        });
      }

      // Baies vitrées
      if (selectedProperty.slidingDoorCount && selectedProperty.slidingDoorCount > 0) {
        tags.push({
          icon: <DoorSliding size={14} strokeWidth={1.75} />,
          label: `${selectedProperty.slidingDoorCount} baies vitrées`,
        });
      }

      // Repassage
      if (selectedProperty.hasIroning) {
        tags.push({
          icon: <Iron size={14} strokeWidth={1.75} />,
          label: 'Repassage',
        });
      }

      // Cuisine approfondie
      if (selectedProperty.hasDeepKitchen) {
        tags.push({
          icon: <Kitchen size={14} strokeWidth={1.75} />,
          label: 'Cuisine approfondie',
        });
      }

      // Désinfection
      if (selectedProperty.hasDisinfection) {
        tags.push({
          icon: <AutoAwesome size={14} strokeWidth={1.75} />,
          label: 'Désinfection',
        });
      }

      return tags;
    }, [selectedProperty, t]);

    return (
      <>
        {/* Titre de la demande */}
        <div className="mb-3">
          <Controller
            name="title"
            control={control}
            render={({ field, fieldState }) => (
              <Field>
                <FieldLabel htmlFor="service-request-title">
                  {t('serviceRequests.fields.title')} *
                </FieldLabel>
                {/* field.ref n'est pas transmis : les primitives du kit sont des
                    composants fonction sans forwardRef (React 18), le passer
                    declencherait un avertissement sans jamais s'attacher. */}
                <Input
                  id="service-request-title"
                  className="w-full"
                  name={field.name}
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  disabled={disabled}
                  required
                  placeholder={t('serviceRequests.fields.titlePlaceholder')}
                  aria-invalid={!!fieldState.error}
                />
                {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
              </Field>
            )}
          />
        </div>

        {/* Propriete */}
        <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          {t('serviceRequests.sections.property')}
        </p>

        {/* Propriété et Demandeur sur la même ligne */}
        <div className="flex gap-3 mb-2">
          {/* Propriété */}
          <div className="flex-[7]">
            <Controller
              name="propertyId"
              control={control}
              // Liste riche (pastille de logement par option) -> Select du kit :
              // une <option> native ne peut porter aucun balisage.
              render={({ field, fieldState }) => {
                const selectedProp = properties.find(p => p.id === field.value);
                return (
                  <Field>
                    <FieldLabel htmlFor="service-request-property">
                      {t('serviceRequests.fields.property')}
                    </FieldLabel>
                    <Select
                      value={field.value ? String(field.value) : ''}
                      onValueChange={(value) => field.onChange(Number(value))}
                    >
                      <SelectTrigger
                        id="service-request-property"
                        size="sm"
                        className="w-full *:data-[slot=select-value]:flex-1 *:data-[slot=select-value]:text-start"
                        aria-invalid={!!fieldState.error}
                        onBlur={field.onBlur}
                      >
                        <span className={cn('inline-flex shrink-0', selectedProp ? 'text-primary' : 'text-faint')}><Home size={16} strokeWidth={1.75} /></span>
                        <SelectValue placeholder={t('serviceRequests.fields.selectProperty')} />
                      </SelectTrigger>
                      <SelectContent>
                        {properties.map((property) => (
                          <SelectItem key={property.id} value={String(property.id)}>
                            <span className="inline-flex text-primary"><Home size={16} strokeWidth={1.75} /></span>
                            <span className="text-[12.5px] text-foreground">
                              {property.name} - {property.address}, {property.city}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
                  </Field>
                );
              }}
            />
          </div>

          {/* Demandeur — lecture seule, trace l'utilisateur connecté */}
          <div className="flex-[5]">
            {currentUser ? (
              <div>
                <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground mb-0.5 ms-0.5">
                  {t('serviceRequests.fields.requestor')}
                </p>
                <div className="flex items-center gap-1 px-2 py-1 rounded-[11px] bg-field border border-solid border-field-line min-h-[40px]">
                  <span className="inline-flex text-primary"><Person size={16} strokeWidth={1.75} /></span>
                  <p className="text-[12.5px] font-medium text-foreground flex-1">
                    {currentUser.name}
                  </p>
                  {currentUser.roleLabel && (
                    <StatusChip
                      tokens={REQUESTOR_ROLE_TOKENS[currentUser.role] ?? REQUESTOR_ROLE_FALLBACK}
                      label={currentUser.roleLabel}
                      className="h-[20px] text-[10px]"
                    />
                  )}
                </div>
              </div>
            ) : (
              /* Fallback: ancien Select si currentUser pas fourni (compatibilité) */
              <Controller
                name="userId"
                control={control}
                render={({ field, fieldState }) => {
                  const selectedUser = users.find(u => u.id === field.value);
                  const hasValue = !!selectedUser;
                  return (
                    <Field>
                      <FieldLabel htmlFor="service-request-requestor">
                        {t('serviceRequests.fields.requestor')}
                      </FieldLabel>
                      <Select
                        value={field.value ? String(field.value) : ''}
                        onValueChange={(value) => field.onChange(Number(value))}
                        disabled={!isAdminOrManager}
                      >
                        <SelectTrigger
                          id="service-request-requestor"
                          size="sm"
                          className="w-full *:data-[slot=select-value]:flex-1 *:data-[slot=select-value]:text-start"
                          aria-invalid={!!fieldState.error}
                          onBlur={field.onBlur}
                        >
                          <span className={cn('inline-flex shrink-0', hasValue ? 'text-primary' : 'text-faint')}><Person size={16} strokeWidth={1.75} /></span>
                          <SelectValue placeholder={t('serviceRequests.fields.selectRequestor')} />
                        </SelectTrigger>
                        <SelectContent>
                          {users.map((u) => (
                            <SelectItem key={u.id} value={String(u.id)}>
                              <span className="inline-flex text-primary"><Person size={16} strokeWidth={1.75} /></span>
                              <span className="text-[12.5px] text-foreground">
                                {u.firstName} {u.lastName}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
                    </Field>
                  );
                }}
              />
            )}
          </div>
        </div>

        {/* Chips caractéristiques du logement */}
        {propertyTags.length > 0 && (
          <div className="mt-[9px] mb-[3px] flex flex-wrap gap-[4.5px]">
            {propertyTags.map((tag) => (
              <StatusChip
                key={tag.label}
                tokens={FORM_TAG_TOKENS}
                icon={tag.icon}
                label={tag.label}
                className={FORM_TAG_CLASS}
              />
            ))}
          </div>
        )}
      </>
    );
  }
);

ServiceRequestFormProperty.displayName = 'ServiceRequestFormProperty';

export default ServiceRequestFormProperty;
