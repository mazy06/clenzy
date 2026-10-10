export interface BaitlySignalement {
  severity: 'basse' | 'moyenne' | 'haute';
  description: string;
}

export const parseSignalements = (notes?: string): BaitlySignalement[] => {
  if (!notes) return [];
  const regex = /\[SIGNALEMENT:(\w+)\]\s*(.+?)(?=\[SIGNALEMENT|\n---|$)/gs;
  const results: BaitlySignalement[] = [];
  let match;
  while ((match = regex.exec(notes)) !== null) {
    results.push({
      severity: (match[1].toLowerCase() as BaitlySignalement['severity']) || 'moyenne',
      description: match[2].trim(),
    });
  }
  return results;
};

export const parseStepNotes = (notes?: string): Record<string, string> => {
  if (!notes) return {};
  const result: Record<string, string> = {};
  const sections = notes.split('--- ');
  for (const section of sections) {
    if (section.startsWith('Inspection')) {
      result.inspection = section.replace(/^Inspection\s*(?:---?)?\s*\n?/, '').trim();
    } else if (section.startsWith('Pieces') || section.startsWith('Pièces')) {
      result.rooms = section.replace(/^Pi[eè]ces\s*(?:---?)?\s*\n?/, '').trim();
    } else if (section.startsWith('Final') || section.startsWith('Photos')) {
      result.after_photos = section.replace(/^(Final|Photos\s*après)\s*(?:---?)?\s*\n?/, '').trim();
    }
  }
  return result;
};

export const parseCompletedSteps = (steps?: string): Set<string> => {
  if (!steps) return new Set();
  return new Set(steps.split(',').filter(Boolean));
};

export const parseValidatedRooms = (rooms?: string): Set<number> => {
  if (!rooms) return new Set();
  return new Set(rooms.split(',').filter(Boolean).map(Number));
};

export function parseBaitlyPhotoUrls(photos?: string | string[] | null): string[] {
  const entries = typeof photos === 'string' ? photos.split(',') : photos ?? [];
  return entries.map((photo) => photo.trim()).filter(Boolean);
}
