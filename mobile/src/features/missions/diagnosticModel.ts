export const DIAGNOSTIC_CAUSES = ['wear', 'breakage', 'leak', 'electrical', 'clogging', 'misuse', 'unknown'] as const;

/** Splits the stored notes "[cause] finding" and materials "name × qty, …" back into the form. */
export function parseDiagnostic(notes?: string | null, materials?: string | null) {
  const match = notes?.match(/^\[([a-z]+)\]\s*([\s\S]*)$/);
  return {
    cause: match ? match[1] : undefined,
    finding: match ? match[2] : notes ?? '',
    materials: (materials ?? '').split(', ').filter(Boolean).map(item => {
      const parts = item.split(' × ');
      return { name: parts[0], quantity: Number(parts[1]) || 1 };
    }),
  };
}
