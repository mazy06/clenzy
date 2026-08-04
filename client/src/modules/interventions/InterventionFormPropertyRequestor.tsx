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
import { Controller } from 'react-hook-form';
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

    return (
      <Card className="mb-[9px]">
        <CardContent>
          <h6 className="cn-text-subtitle1 font-semibold mb-2">
            {t('interventions.sections.propertyRequestor')}
          </h6>

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
                  value={field.value ?? ''}
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
                      {property.name} - {property.address}, {property.city}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
              </Field>
            )}
          />

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
                  value={field.value ?? ''}
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
