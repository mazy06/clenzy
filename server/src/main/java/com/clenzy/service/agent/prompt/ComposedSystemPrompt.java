package com.clenzy.service.agent.prompt;

/**
 * System prompt scinde en deux parties pour le prompt caching Anthropic.
 *
 * <p><b>Pourquoi scinder</b> : le cache Anthropic est prefixe-based. Tant que
 * le contenu volatil (RAG, memoire, contexte UI — qui change a chaque tour)
 * est melange dans un unique bloc system, ce bloc differe a chaque requete et
 * casse le cache. En isolant le prefixe STABLE (role, regles, guides, exemples
 * — identique d'un tour a l'autre) du suffixe VOLATIL, le provider peut poser
 * le {@code cache_control} sur le seul prefixe : il est alors relu au tarif
 * cache (~10%) sur les tours suivants, le suffixe restant refacture (petit).</p>
 *
 * @param cacheablePrefix sections stables (jamais null ; peut etre vide)
 * @param volatileSuffix  sections dynamiques (null/vide = pas de suffixe → bloc unique)
 */
public record ComposedSystemPrompt(String cacheablePrefix, String volatileSuffix) {

    /** Separateur de paragraphe entre les deux groupes (aligne sur le composer). */
    private static final String SEPARATOR = "\n\n";

    /** Construit un prompt mono-bloc (pas de suffixe volatil). */
    public static ComposedSystemPrompt of(String prompt) {
        return new ComposedSystemPrompt(prompt, null);
    }

    /** {@code true} si au moins une des deux parties porte du contenu. */
    public boolean hasContent() {
        return !full().isBlank();
    }

    /** {@code true} si un suffixe volatil non vide est present (→ 2 blocs cote provider). */
    public boolean hasVolatileSuffix() {
        return volatileSuffix != null && !volatileSuffix.isBlank();
    }

    /** Reconstitue le prompt complet (prefixe + suffixe), pour les consommateurs mono-string. */
    public String full() {
        boolean prefixBlank = cacheablePrefix == null || cacheablePrefix.isBlank();
        if (!hasVolatileSuffix()) {
            return prefixBlank ? "" : cacheablePrefix;
        }
        return prefixBlank ? volatileSuffix : cacheablePrefix + SEPARATOR + volatileSuffix;
    }
}
