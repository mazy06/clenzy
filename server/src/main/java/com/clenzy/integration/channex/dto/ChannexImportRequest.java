package com.clenzy.integration.channex.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

/**
 * Body de {@code POST /api/integrations/channex/import}.
 *
 * <p>Liste des properties Channex selectionnees par l'utilisateur a importer
 * comme nouvelles Properties Clenzy, avec leur type Clenzy (overridable depuis
 * la suggestion {@link ChannexDiscoveredProperty#suggestedType()}).</p>
 *
 * <p><b>Multi-tenant override (platform staff uniquement) :</b></p>
 * <ul>
 *   <li>{@code targetOrganizationId} : si renseigne, la Property est creee dans
 *       cette org au lieu de celle du tenant courant. Reserve aux SUPER_ADMIN
 *       et SUPER_MANAGER (sinon ignore + warning).</li>
 *   <li>{@code targetOwnerId} : si renseigne, ce User devient l'owner au lieu
 *       du user qui clique. Doit appartenir a l'org cible. Idem reserve staff.</li>
 * </ul>
 *
 * @param imports              listes des properties Channex a importer
 * @param targetOrganizationId (optionnel, staff only) override de l'org cible
 * @param targetOwnerId        (optionnel, staff only) override de l'owner cible
 */
public record ChannexImportRequest(
    @NotEmpty List<Item> imports,
    Long targetOrganizationId,
    Long targetOwnerId
) {
    /**
     * @param channexPropertyId UUID Channex (cf. {@link ChannexDiscoveredProperty})
     * @param propertyType      type Clenzy a creer ("APARTMENT", "HOUSE", "STUDIO", ...)
     */
    public record Item(
        @NotBlank String channexPropertyId,
        @NotBlank String propertyType
    ) {}
}
