import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  whatsappTemplatesApi,
  type PreviewPayload,
  type UpsertOverridePayload,
  type WhatsAppTemplateContent,
  type WhatsAppTemplateGroup,
} from '../services/api/whatsappTemplatesApi';
import type { TemplateVariable } from '../services/api/guestMessagingApi';

// ─── Query keys (stables) ────────────────────────────────────────────────────

/**
 * Cles React Query centralisees pour eviter les typos et faciliter les
 * invalidations. Pattern: namespace > resource > param.
 */
export const whatsappTemplatesKeys = {
  all: ['whatsapp-templates'] as const,
  list: () => [...whatsappTemplatesKeys.all, 'list'] as const,
  detail: (key: string) => [...whatsappTemplatesKeys.all, 'detail', key] as const,
  variables: () => [...whatsappTemplatesKeys.all, 'variables'] as const,
};

// ─── Queries ─────────────────────────────────────────────────────────────────

/**
 * Liste de TOUS les templates visibles par l'org (systeme + overrides), groupes
 * par templateKey. Utilise par la tab "Templates WhatsApp" dans DocumentsPage.
 */
export function useWhatsAppTemplatesList() {
  return useQuery<WhatsAppTemplateGroup[]>({
    queryKey: whatsappTemplatesKeys.list(),
    queryFn: () => whatsappTemplatesApi.list(),
    staleTime: 60_000, // les templates changent rarement, evite les refetch a chaque mount
  });
}

/**
 * Detail d'un template (3 langues). Sert a populater l'editeur quand l'user
 * clique sur un template dans la liste.
 *
 * @param key       cle logique du template (ex: "checkin_instructions")
 * @param enabled   permet de differer le fetch (ex: dialog pas encore ouvert)
 */
export function useWhatsAppTemplateDetail(key: string | null, enabled = true) {
  return useQuery<WhatsAppTemplateGroup>({
    queryKey: whatsappTemplatesKeys.detail(key ?? ''),
    queryFn: () => whatsappTemplatesApi.getByKey(key!),
    enabled: enabled && Boolean(key),
    staleTime: 30_000,
  });
}

/**
 * Liste des variables supportees par le moteur d'interpolation. Stable au cours
 * d'une session — staleTime tres long.
 */
export function useWhatsAppTemplateVariables() {
  return useQuery<TemplateVariable[]>({
    queryKey: whatsappTemplatesKeys.variables(),
    queryFn: () => whatsappTemplatesApi.getVariables(),
    staleTime: 60 * 60 * 1000, // 1h — la liste change avec un deploy backend uniquement
  });
}

// ─── Mutations ───────────────────────────────────────────────────────────────

/**
 * Cree ou met a jour un override per-org. Invalide la liste + le detail apres
 * succes pour que l'UI refleche immediatement le nouveau contenu.
 */
export function useUpsertWhatsAppTemplate() {
  const queryClient = useQueryClient();

  return useMutation<
    WhatsAppTemplateContent,
    Error,
    { key: string; language: string; payload: UpsertOverridePayload }
  >({
    mutationFn: ({ key, language, payload }) =>
      whatsappTemplatesApi.upsertOverride(key, language, payload),
    onSuccess: (_data, variables) => {
      // Invalide la liste pour reflechir le passage en "Personnalise" et le
      // detail pour montrer le nouveau body. La preview se refetch toute seule
      // au prochain trigger UI (pas un cache permanent).
      queryClient.invalidateQueries({ queryKey: whatsappTemplatesKeys.list() });
      queryClient.invalidateQueries({ queryKey: whatsappTemplatesKeys.detail(variables.key) });
    },
  });
}

/**
 * Supprime l'override per-org → retour au defaut systeme. Memes invalidations
 * que upsert pour rafraichir le badge "Systeme".
 */
export function useRemoveWhatsAppTemplateOverride() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { key: string; language: string }>({
    mutationFn: ({ key, language }) => whatsappTemplatesApi.removeOverride(key, language),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: whatsappTemplatesKeys.list() });
      queryClient.invalidateQueries({ queryKey: whatsappTemplatesKeys.detail(variables.key) });
    },
  });
}

/**
 * Preview a la demande (pas une query persistante). On utilise mutation car
 * cote serveur c'est un POST et que le resultat depend des mockValues du moment
 * — pas de notion de "fraicheur" a invalider.
 */
export function useWhatsAppTemplatePreview() {
  return useMutation<
    string,
    Error,
    { key: string; language: string; payload: PreviewPayload }
  >({
    mutationFn: async ({ key, language, payload }) => {
      const response = await whatsappTemplatesApi.preview(key, language, payload);
      return response.renderedBody;
    },
  });
}
