import { useCallback, useEffect, useState } from 'react';
import {
  customServiceTypesApi,
  type CustomServiceType,
  type CustomServiceCategory,
} from '../services/api/customServiceTypesApi';

/**
 * Types de service personnalisés (« Autre ») réutilisables pour une catégorie.
 * Charge la liste de l'org courante et expose une création qui met à jour la
 * liste locale. `category = null` → aucune requête (catégories sans « Autre »).
 */
export function useCustomServiceTypes(category: CustomServiceCategory | null) {
  const [types, setTypes] = useState<CustomServiceType[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!category) {
      setTypes([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    customServiceTypesApi
      .list(category)
      .then((list) => {
        if (!cancelled) setTypes(list);
      })
      .catch(() => {
        if (!cancelled) setTypes([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [category]);

  const createType = useCallback(
    async (label: string): Promise<CustomServiceType | null> => {
      if (!category) return null;
      const created = await customServiceTypesApi.create(category, label);
      setTypes((prev) =>
        prev.some((t) => t.id === created.id)
          ? prev
          : [...prev, created].sort((a, b) => a.label.localeCompare(b.label)),
      );
      return created;
    },
    [category],
  );

  return { types, loading, createType };
}
