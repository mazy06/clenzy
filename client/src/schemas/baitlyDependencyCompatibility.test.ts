import { zodResolver } from '@hookform/resolvers/zod';
import { describe, expect, it } from 'vitest';
import { contactSchema } from './contactSchema';
import { propertySchema } from './propertySchema';
import { teamSchema } from './teamSchema';
import { userSchema } from './userSchema';

const options = { criteriaMode: 'all' as const, shouldUseNativeValidation: false, fields: {} };

const property = {
  name: 'Logement de recette', address: 'Adresse synthétique', city: 'Ville de recette',
  postalCode: '00000', country: 'France', type: 'APARTMENT', status: 'ACTIVE',
  bedroomCount: 1, bathroomCount: 1, squareMeters: 40, nightlyPrice: 80,
  minimumNights: 1, description: '', maxGuests: 2, cleaningFrequency: 'AFTER_STAY', ownerId: 7,
};

describe('Baitly form contracts with the compatible Zod security update', () => {
  it('keeps contact defaults and strips unknown values through the real form resolver', async () => {
    const input = { recipientId: '7', subject: 'Recette', message: 'Message synthétique', extra: 'ignored' };
    const result = await zodResolver(contactSchema)(input, undefined, options);
    expect(result.errors).toEqual({});
    expect(result.values).toEqual({ recipientId: '7', subject: 'Recette', message: 'Message synthétique',
      priority: 'MEDIUM', category: 'GENERAL' });
  });

  it('keeps invalid contact errors on the original field without producing submitted values', async () => {
    const result = await zodResolver(contactSchema)(
      { recipientId: '', subject: 'Recette', message: 'Message synthétique' }, undefined, options);
    expect(result.values).toEqual({});
    expect(Object.keys(result.errors)).toEqual(['recipientId']);
    expect(result.errors.recipientId?.message).toEqual(expect.any(String));
  });

  it('preserves the paths of password and organization role cross-field errors', async () => {
    const result = await zodResolver(userSchema)({ firstName: 'Recette', lastName: 'Synthétique',
      email: 'recipe@example.test', password: 'synthetic-only-a', confirmPassword: 'synthetic-only-b',
      role: 'HOST', status: 'ACTIVE', organizationId: '7' }, undefined, options);
    expect(result.values).toEqual({});
    expect(Object.keys(result.errors).sort()).toEqual(['confirmPassword', 'orgRole']);
  });

  it('keeps nested team member and coverage errors addressable by the form', async () => {
    const result = await zodResolver(teamSchema)({ name: 'Équipe de recette', interventionType: 'CLEANING',
      members: [{ userId: 0, role: 'HOUSEKEEPER' }], coverageZones: [{ country: 'FR', department: '' }] },
    undefined, options);
    expect(result.values).toEqual({});
    expect(result.errors.members?.[0]?.userId?.message).toEqual(expect.any(String));
    expect(result.errors.coverageZones?.[0]?.department?.message).toEqual(expect.any(String));
  });

  it('keeps property defaults and rejects fractional deposits and numeric strings', () => {
    expect(propertySchema.parse(property)).toMatchObject({ defaultCurrency: 'EUR', countryCode: 'FR',
      timezone: 'Europe/Paris', securityDepositAmount: 0, bookingEngineVisible: false,
      orgCanCreateVouchers: false });
    expect(propertySchema.safeParse({ ...property, securityDepositAmount: 10.01 }).success).toBe(true);
    expect(propertySchema.safeParse({ ...property, securityDepositAmount: 10.001 }).success).toBe(false);
    expect(propertySchema.safeParse({ ...property, ownerId: '7' }).success).toBe(false);
  });

  it('keeps required tourist tax confirmations on the original form fields', async () => {
    const result = await zodResolver(propertySchema)({ ...property, touristTaxRequired: true }, undefined, options);
    expect(result.values).toEqual({});
    expect(Object.keys(result.errors).sort()).toEqual(['touristTaxConfirmed', 'touristTaxRate']);
  });
});
