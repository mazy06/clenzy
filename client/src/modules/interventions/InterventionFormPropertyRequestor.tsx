import React from 'react';
import {
  Card,
  CardContent,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  NativeSelect,
  NativeSelectOption,
} from '../../components/ui';
import { useQuery } from '@tanstack/react-query';
import { propertiesApi } from '../../services/api/propertiesApi';
import { PropertyThumb } from '../notifications/NotificationPropertyPanel';
import { Controller, useWatch } from 'react-hook-form';
import type { Control, FieldErrors } from 'react-hook-form';
import { useTranslation } from '../../hooks/useTranslation';
import type { InterventionFormValues } from '../../schemas';

interface Property {
  id: number;
  name: string;
  address: string;
  city: string;
  postalCode: string;
}

interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

export interface InterventionFormPropertyRequestorProps {
  control: Control<InterventionFormValues>;
  errors: FieldErrors<InterventionFormValues>;
  properties: Property[];
  users: User[];
  isAdmin: () => boolean;
  isManager: () => boolean;
}

const InterventionFormPropertyRequestor: React.FC<InterventionFormPropertyRequestorProps> = React.memo(
  ({ control, errors, properties, users, isAdmin, isManager }) => {
    const { t } = useTranslation();
    const propertyId = useWatch({ control, name: 'propertyId' });
    const detail = useQuery({
      queryKey: ['intervention-property', propertyId],
      queryFn: () => propertiesApi.getById(propertyId),
      enabled: !!propertyId,
    });
    const property = detail.data;

    return (
      <Card className="mb-[9px]">
        <CardContent>
          <div className="flex gap-3 items-center">
          {property && <PropertyThumb key={property.id} property={property} name={property.name} />}
          <div className="flex-1 min-w-0">

          <Controller
            name="propertyId"
            control={control}
            // Le ref de react-hook-form est ecarte : les primitives du kit sont des
            // composants fonction sans forwardRef (React 18 refuserait le ref).
            render={({ field: { ref: _ref, ...field }, fieldState }) => (
              <Field className="mb-[9px]">
                <FieldLabel htmlFor="intervention-property">
                  {t('interventions.fields.property')}
                </FieldLabel>
                <NativeSelect
                  {...field}
                  id="intervention-property"
                  className="w-full"
                  required
                  value={field.value || ''}
                  // Le <select> natif ne renvoie que des chaines : la valeur est
                  // recastee en nombre, l'ancien Select MUI portait des id numeriques.
                  onChange={(e) => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))}
                  aria-invalid={!!fieldState.error}
                >
                  <NativeSelectOption value="" disabled>
                    {t('interventions.fields.property')}
                  </NativeSelectOption>
                  {properties.map((property) => (
                    <NativeSelectOption key={property.id} value={property.id}>
                      {property.name} · {property.city}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
              </Field>
            )}
          />

          {property && <div className="text-xs text-muted-foreground tabular-nums">
            <p className="truncate" title={property.address}>{property.address}, {property.city}</p>
            <p>{property.squareMeters} m² · {t('requestComposer.bedrooms', { count: property.bedroomCount })} · {t('requestComposer.guests', { count: property.maxGuests })}</p>
          </div>}
          </div></div>
          <Controller
            name="requestorId"
            control={control}
            render={({ field: { ref: _ref, ...field }, fieldState }) => (
              <Field>
                <FieldLabel htmlFor="intervention-requestor">
                  {t('interventions.fields.requestor')}
                </FieldLabel>
                <NativeSelect
                  {...field}
                  id="intervention-requestor"
                  className="w-full"
                  required
                  disabled={!isAdmin() && !isManager()}
                  value={field.value || ''}
                  onChange={(e) => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))}
                  aria-invalid={!!fieldState.error}
                >
                  <NativeSelectOption value="" disabled>
                    {t('interventions.fields.requestor')}
                  </NativeSelectOption>
                  {users.map((user) => (
                    <NativeSelectOption key={user.id} value={user.id}>
                      {user.firstName} {user.lastName} ({user.email})
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                {!isAdmin() && !isManager() && (
                  <FieldDescription className="text-[0.7rem]">
                    {t('interventions.fields.requestorHelper')}
                  </FieldDescription>
                )}
                {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
              </Field>
            )}
          />
        </CardContent>
      </Card>
    );
  }
);

InterventionFormPropertyRequestor.displayName = 'InterventionFormPropertyRequestor';

export default InterventionFormPropertyRequestor;
