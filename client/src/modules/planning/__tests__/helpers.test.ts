import { describe, it, expect } from 'vitest';

/**
 * Tests for helper/parsing functions used across multiple components.
 * These functions are inline (not exported) in their components, so we
 * replicate them here for thorough unit testing.
 */

// ─── parseCompletedSteps (from PanelInterventionProgress & PanelInterventionDetail) ─

const parseCompletedSteps = (steps?: string): Set<string> => {
  if (!steps) return new Set();
  return new Set(steps.split(',').filter(Boolean));
};

describe('parseCompletedSteps', () => {
  it('should return empty set for undefined', () => {
    expect(parseCompletedSteps(undefined).size).toBe(0);
  });

  it('should return empty set for empty string', () => {
    expect(parseCompletedSteps('').size).toBe(0);
  });

  it('should parse single step', () => {
    const result = parseCompletedSteps('inspection');
    expect(result.has('inspection')).toBe(true);
    expect(result.size).toBe(1);
  });

  it('should parse multiple steps', () => {
    const result = parseCompletedSteps('inspection,rooms,after_photos');
    expect(result.has('inspection')).toBe(true);
    expect(result.has('rooms')).toBe(true);
    expect(result.has('after_photos')).toBe(true);
    expect(result.size).toBe(3);
  });

  it('should handle trailing comma', () => {
    const result = parseCompletedSteps('inspection,');
    expect(result.size).toBe(1);
    expect(result.has('inspection')).toBe(true);
  });

  it('should handle leading comma', () => {
    const result = parseCompletedSteps(',rooms');
    expect(result.size).toBe(1);
    expect(result.has('rooms')).toBe(true);
  });

  it('should deduplicate', () => {
    const result = parseCompletedSteps('inspection,inspection,rooms');
    expect(result.size).toBe(2);
  });
});

// ─── parseValidatedRooms (from PanelInterventionProgress) ───────────────────

const parseValidatedRooms = (rooms?: string): Set<number> => {
  if (!rooms) return new Set();
  return new Set(rooms.split(',').filter(Boolean).map(Number));
};

describe('parseValidatedRooms', () => {
  it('should return empty set for undefined', () => {
    expect(parseValidatedRooms(undefined).size).toBe(0);
  });

  it('should return empty set for empty string', () => {
    expect(parseValidatedRooms('').size).toBe(0);
  });

  it('should parse room indices', () => {
    const result = parseValidatedRooms('0,2,4');
    expect(result.has(0)).toBe(true);
    expect(result.has(2)).toBe(true);
    expect(result.has(4)).toBe(true);
    expect(result.size).toBe(3);
  });

  it('should handle single room', () => {
    const result = parseValidatedRooms('3');
    expect(result.has(3)).toBe(true);
    expect(result.size).toBe(1);
  });

  it('should handle trailing comma', () => {
    const result = parseValidatedRooms('0,1,');
    expect(result.size).toBe(2);
  });
});

// ─── parseSignalements (from PanelInterventionRecap) ────────────────────────

interface Signalement {
  severity: 'basse' | 'moyenne' | 'haute';
  description: string;
}

const parseSignalements = (notes?: string): Signalement[] => {
  if (!notes) return [];
  const regex = /\[SIGNALEMENT:(\w+)\]\s*(.+?)(?=\[SIGNALEMENT|\n---|$)/gs;
  const results: Signalement[] = [];
  let match;
  while ((match = regex.exec(notes)) !== null) {
    results.push({
      severity: (match[1].toLowerCase() as Signalement['severity']) || 'moyenne',
      description: match[2].trim(),
    });
  }
  return results;
};

describe('parseSignalements', () => {
  it('should return empty array for undefined', () => {
    expect(parseSignalements(undefined)).toEqual([]);
  });

  it('should return empty array for empty string', () => {
    expect(parseSignalements('')).toEqual([]);
  });

  it('should return empty array for text without signalements', () => {
    expect(parseSignalements('Just some notes')).toEqual([]);
  });

  it('should parse single signalement', () => {
    const result = parseSignalements('[SIGNALEMENT:haute] Tuyau casse');
    expect(result).toHaveLength(1);
    expect(result[0].severity).toBe('haute');
    expect(result[0].description).toBe('Tuyau casse');
  });

  it('should parse multiple signalements', () => {
    const notes = '[SIGNALEMENT:haute] Fuite eau\n[SIGNALEMENT:basse] Ampoule grillee';
    const result = parseSignalements(notes);
    expect(result).toHaveLength(2);
    expect(result[0].severity).toBe('haute');
    expect(result[0].description).toBe('Fuite eau');
    expect(result[1].severity).toBe('basse');
    expect(result[1].description).toBe('Ampoule grillee');
  });

  it('should handle mixed case severity', () => {
    const result = parseSignalements('[SIGNALEMENT:HAUTE] Urgence');
    expect(result[0].severity).toBe('haute');
  });

  it('should handle signalements surrounded by other text', () => {
    const notes = 'Notes normales\n[SIGNALEMENT:moyenne] Probleme leger\n--- Section suivante';
    const result = parseSignalements(notes);
    expect(result).toHaveLength(1);
    expect(result[0].severity).toBe('moyenne');
    expect(result[0].description).toBe('Probleme leger');
  });
});

// ─── parseStepNotes (from PanelInterventionRecap) ───────────────────────────

const parseStepNotes = (notes?: string): Record<string, string> => {
  if (!notes) return {};
  const result: Record<string, string> = {};
  const sections = notes.split('--- ');
  for (const section of sections) {
    if (section.startsWith('Inspection')) {
      result.inspection = section.replace(/^Inspection\s*-{0,3}\s*\n?/, '').trim();
    } else if (section.startsWith('Pieces') || section.startsWith('Pieces')) {
      result.rooms = section.replace(/^Pi[eè]ces\s*-{0,3}\s*\n?/, '').trim();
    } else if (section.startsWith('Final') || section.startsWith('Photos')) {
      result.after_photos = section.replace(/^(Final|Photos\s*apres)\s*-{0,3}\s*\n?/, '').trim();
    }
  }
  return result;
};

describe('parseStepNotes', () => {
  it('should return empty object for undefined', () => {
    expect(parseStepNotes(undefined)).toEqual({});
  });

  it('should return empty object for empty string', () => {
    expect(parseStepNotes('')).toEqual({});
  });

  it('should parse inspection section', () => {
    const notes = '--- Inspection\nRAS logement propre';
    const result = parseStepNotes(notes);
    expect(result.inspection).toBe('RAS logement propre');
  });

  it('should parse pieces section', () => {
    const notes = '--- Pieces\nToutes validees';
    const result = parseStepNotes(notes);
    expect(result.rooms).toBe('Toutes validees');
  });

  it('should parse final section', () => {
    const notes = '--- Final\nTout est OK';
    const result = parseStepNotes(notes);
    expect(result.after_photos).toBe('Tout est OK');
  });

  it('should parse multiple sections', () => {
    const notes = '--- Inspection\nRAS\n--- Pieces\n3/5 OK\n--- Final\nTermine';
    const result = parseStepNotes(notes);
    expect(result.inspection).toBe('RAS');
    expect(result.rooms).toBe('3/5 OK');
    expect(result.after_photos).toBe('Termine');
  });

  it('should return empty for unrecognized sections', () => {
    const notes = '--- Random\nSome text';
    const result = parseStepNotes(notes);
    expect(Object.keys(result)).toHaveLength(0);
  });
});

// ─── Progress calculation ────────────────────────────────────────────────────

describe('progress calculation', () => {
  const calculateProgress = (completedSteps: Set<string>): number => {
    let progress = 0;
    if (completedSteps.has('inspection')) progress += 33;
    if (completedSteps.has('rooms')) progress += 33;
    if (completedSteps.has('after_photos')) progress += 34;
    return progress;
  };

  it('should be 0 for no completed steps', () => {
    expect(calculateProgress(new Set())).toBe(0);
  });

  it('should be 33 for inspection only', () => {
    expect(calculateProgress(new Set(['inspection']))).toBe(33);
  });

  it('should be 66 for inspection + rooms', () => {
    expect(calculateProgress(new Set(['inspection', 'rooms']))).toBe(66);
  });

  it('should be 100 for all steps', () => {
    expect(calculateProgress(new Set(['inspection', 'rooms', 'after_photos']))).toBe(100);
  });

  it('should be 34 for after_photos only (skip scenario)', () => {
    expect(calculateProgress(new Set(['after_photos']))).toBe(34);
  });

  it('should be 67 for inspection + after_photos (skip rooms)', () => {
    expect(calculateProgress(new Set(['inspection', 'after_photos']))).toBe(67);
  });
});

// ─── Active step calculation ─────────────────────────────────────────────────

describe('active step calculation', () => {
  const calculateActiveStep = (inspectionDone: boolean, roomsDone: boolean, photosDone: boolean): number => {
    return photosDone ? 3 : roomsDone ? 2 : inspectionDone ? 1 : 0;
  };

  it('should be 0 when nothing is done', () => {
    expect(calculateActiveStep(false, false, false)).toBe(0);
  });

  it('should be 1 when inspection is done', () => {
    expect(calculateActiveStep(true, false, false)).toBe(1);
  });

  it('should be 2 when rooms are done', () => {
    expect(calculateActiveStep(true, true, false)).toBe(2);
  });

  it('should be 3 when all done', () => {
    expect(calculateActiveStep(true, true, true)).toBe(3);
  });
});

// ─── Cart total calculation ──────────────────────────────────────────────────

describe('cart total calculation', () => {
  it('should calculate total for selected items', () => {
    const items = [
      { interventionId: 1, title: 'A', cost: 50, selected: true },
      { interventionId: 2, title: 'B', cost: 75, selected: false },
      { interventionId: 3, title: 'C', cost: 30, selected: true },
    ];
    const total = items.filter((i) => i.selected).reduce((sum, i) => sum + i.cost, 0);
    expect(total).toBe(80);
  });

  it('should return 0 for no selected items', () => {
    const items = [
      { interventionId: 1, title: 'A', cost: 50, selected: false },
    ];
    const total = items.filter((i) => i.selected).reduce((sum, i) => sum + i.cost, 0);
    expect(total).toBe(0);
  });

  it('should return 0 for empty cart', () => {
    const items: { selected: boolean; cost: number }[] = [];
    const total = items.filter((i) => i.selected).reduce((sum, i) => sum + i.cost, 0);
    expect(total).toBe(0);
  });
});

// ─── Cost estimation ─────────────────────────────────────────────────────────

describe('cost estimation', () => {
  it('should calculate cost as hours x 25', () => {
    const hours = 2;
    expect(hours * 25).toBe(50);
  });

  it('should return 0 when no hours', () => {
    const hours = undefined;
    expect(hours ? hours * 25 : 0).toBe(0);
  });
});
