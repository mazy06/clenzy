import { describe, it, expect } from 'vitest';
import { mapSpecialistToAgent } from '../specialistMapping';

describe('mapSpecialistToAgent — moteur multi-agent → constellation', () => {
  it('mappe les specialists métier vers leur agent constellation', () => {
    expect(mapSpecialistToAgent('communication')).toBe('com');
    expect(mapSpecialistToAgent('data_analyst')).toBe('rev');
    expect(mapSpecialistToAgent('operations')).toBe('ops');
    expect(mapSpecialistToAgent('workflow')).toBe('ops');
    expect(mapSpecialistToAgent('insights')).toBe('rep');
  });

  it('masque les specialists techniques (null → aucun event constellation)', () => {
    expect(mapSpecialistToAgent('context')).toBeNull();
    expect(mapSpecialistToAgent('memory')).toBeNull();
    expect(mapSpecialistToAgent('navigation')).toBeNull();
  });

  it('retourne null pour un nom inconnu, vide ou nul (robustesse)', () => {
    expect(mapSpecialistToAgent('ghost')).toBeNull();
    expect(mapSpecialistToAgent('')).toBeNull();
    expect(mapSpecialistToAgent(null)).toBeNull();
    expect(mapSpecialistToAgent(undefined)).toBeNull();
  });
});
