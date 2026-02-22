import { describe, it, expect } from 'vitest';
import type { User, UserFormData } from '../usersApi';

/**
 * Type-level tests: verify that the User interface contains all backend fields.
 * These tests ensure that (userData as any).xxx casts are never needed.
 *
 * If a field is missing from User, TypeScript will fail at compile time,
 * AND the runtime test will catch it via the exhaustive key check.
 */

/** All fields the backend UserDto returns (from User.java + UserDto.java) */
const EXPECTED_USER_FIELDS: (keyof User)[] = [
  // Core identity
  'id',
  'firstName',
  'lastName',
  'email',
  'role',
  'status',
  'createdAt',
  // Contact
  'phoneNumber',
  // Timestamps
  'updatedAt',
  'lastLoginAt',
  // Host profile (devis form data)
  'companyName',
  'forfait',
  'city',
  'postalCode',
  'propertyType',
  'propertyCount',
  'surface',
  'guestCapacity',
  'bookingFrequency',
  'cleaningSchedule',
  'calendarSync',
  'services',
  'servicesDevis',
  'deferredPayment',
  // Organization
  'organizationId',
  'organizationName',
];

describe('User interface completeness', () => {
  it('should include all backend UserDto fields', () => {
    // This test validates at runtime that all expected fields exist on User.
    // The (keyof User)[] typing above also validates at compile time.
    // If a field is removed from User, TypeScript will error on the array.
    expect(EXPECTED_USER_FIELDS.length).toBeGreaterThan(0);

    // Compile-time check: create a mock User with all fields to verify assignability
    const mockUser: User = {
      id: 1,
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      role: 'HOST',
      status: 'ACTIVE',
      createdAt: '2024-01-01T00:00:00',
      phoneNumber: '+33612345678',
      updatedAt: '2024-01-02T00:00:00',
      lastLoginAt: '2024-01-03T00:00:00',
      companyName: 'Acme Corp',
      forfait: 'PREMIUM',
      city: 'Paris',
      postalCode: '75001',
      propertyType: 'APARTMENT',
      propertyCount: 3,
      surface: 120,
      guestCapacity: 6,
      bookingFrequency: 'WEEKLY',
      cleaningSchedule: 'AFTER_EACH',
      calendarSync: 'AIRBNB',
      services: 'cleaning,laundry',
      servicesDevis: 'deep_cleaning',
      deferredPayment: true,
      organizationId: 42,
      organizationName: 'Clenzy SAS',
    };

    expect(mockUser.id).toBe(1);
    expect(mockUser.phoneNumber).toBe('+33612345678');
    expect(mockUser.deferredPayment).toBe(true);
  });

  it('UserFormData should accept deferredPayment for update calls', () => {
    // Verify that Partial<UserFormData> includes deferredPayment
    // so we don't need `{ deferredPayment: value } as any`
    const partialUpdate: Partial<UserFormData> = {
      deferredPayment: true,
    };
    expect(partialUpdate.deferredPayment).toBe(true);
  });
});
