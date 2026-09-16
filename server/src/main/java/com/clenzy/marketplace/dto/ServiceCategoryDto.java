package com.clenzy.marketplace.dto;

import com.clenzy.marketplace.model.CategoryFamily;
import com.clenzy.marketplace.model.MarketplaceServiceCategory;

import java.util.List;

/**
 * Categorie de service exposee aux interfaces.
 *
 * <p>Les deux libelles voyagent ensemble : l'interface choisit selon la langue
 * active, ce qui evite un aller-retour serveur au changement de langue.</p>
 *
 * <p>Les prestations du metier sont IMBRIQUEES : le formulaire d'inscription et
 * le filtre ont besoin des deux en meme temps, et deux appels separes auraient
 * laisse l'interface afficher des metiers sans leurs prestations le temps du
 * second aller-retour.</p>
 */
public record ServiceCategoryDto(
    Long id,
    String code,
    String labelFr,
    String labelEn,
    String description,
    String iconKey,
    CategoryFamily family,
    /** Metier usuel : reste en tete du filtre meme sans prestataire. */
    boolean common,
    int sortOrder,
    List<ServiceItemDto> items
) {
    public static ServiceCategoryDto from(MarketplaceServiceCategory c, List<ServiceItemDto> items) {
        return new ServiceCategoryDto(
            c.getId(), c.getCode(), c.getLabelFr(), c.getLabelEn(),
            c.getDescription(), c.getIconKey(), c.getFamily(), c.isCommon(), c.getSortOrder(),
            items == null ? List.of() : items);
    }
}
