package com.clenzy.marketplace.dto;

import com.clenzy.marketplace.model.MarketplaceProvider;

import java.math.BigDecimal;
import java.util.List;

/**
 * Une fiche telle qu'une ORGANISATION la voit.
 *
 * <h2>Ce qui n'y figure pas, et pourquoi</h2>
 * <p>Ni adresse electronique, ni telephone. Un catalogue ouvert a toutes les
 * organisations qui exposerait les coordonnees de chaque prestataire serait un
 * annuaire de prospection : le prestataire s'est inscrit pour recevoir des
 * missions, pas des sollicitations. La mise en relation passe par une demande
 * de devis tracee, ou les deux parties savent qui a contacte qui.</p>
 *
 * <p>Ni note interne de moderation, ni preuve d'acceptation des conditions, ni
 * identifiant de compte : ce sont des donnees d'instruction, elles restent a la
 * plateforme.</p>
 */
public record CatalogProviderDto(
    Long id,
    String publicRef,
    String displayName,
    String headline,
    String bio,
    String avatarUrl,

    String baseCity,
    Integer travelRadiusKm,
    /** Villes couvertes, zone principale en tete. */
    List<String> coverageCities,
    /** Codes ISO 639-1 des langues parlees. */
    List<String> languages,

    /** Codes des metiers couverts. */
    List<String> categoryCodes,
    List<ProviderOfferDto> offers,
    /** Plus bas prix affichable. Vide si tout est sur devis. */
    BigDecimal priceFrom,
    String currency,

    /** Vrai si la plateforme a verifie les justificatifs. */
    boolean verified,
    boolean acceptsUrgent,

    /**
     * Vrai si cette fiche appartient a l'organisation qui regarde.
     *
     * <p>Change ce qu'elle peut en faire : sa propre fiche se modifie, celle
     * d'un tiers se sollicite.</p>
     */
    boolean own,
    BigDecimal ratingAvg,
    int ratingCount
) {
    public static CatalogProviderDto from(MarketplaceProvider provider,
                                          String avatarUrl,
                                          List<String> coverageCities,
                                          List<String> categoryCodes,
                                          List<ProviderOfferDto> offers,
                                          BigDecimal priceFrom,
                                          boolean own) {
        return new CatalogProviderDto(
            provider.getId(),
            provider.getPublicRef() != null ? provider.getPublicRef().toString() : null,
            provider.getDisplayName(),
            provider.getHeadline(),
            provider.getBio(),
            avatarUrl,
            provider.getBaseCity(),
            provider.getTravelRadiusKm(),
            coverageCities,
            splitLanguages(provider.getLanguages()),
            categoryCodes,
            offers,
            priceFrom,
            priceFrom != null ? offers.stream().filter(o -> o.amount() != null)
                    .map(ProviderOfferDto::currency).findFirst().orElse(provider.getCurrency()) : provider.getCurrency(),
            provider.getVerifiedAt() != null,
            provider.isAcceptsUrgent(),
            own, provider.getRatingAvg(), provider.getRatingCount());
    }

    private static List<String> splitLanguages(String packed) {
        if (packed == null || packed.isBlank()) return List.of();
        return List.of(packed.split(","));
    }
}
