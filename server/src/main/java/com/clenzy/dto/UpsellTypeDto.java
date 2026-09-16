package com.clenzy.dto;

import com.clenzy.model.UpsellTypeDef;

/**
 * Type de vente additionnelle propose a l'hote.
 *
 * <p>{@code platform} distingue les types servis a tout le monde de ceux que
 * l'organisation a ajoutes : seuls les siens sont modifiables, et l'interface
 * doit pouvoir le dire sans deviner.</p>
 */
public record UpsellTypeDto(
    Long id,
    String code,
    String labelFr,
    String labelEn,
    String description,
    String iconKey,
    /** Prestation correspondante du catalogue place de marche, quand il y en a une. */
    String serviceItemCode,
    boolean platform,
    boolean system,
    int sortOrder
) {
    public static UpsellTypeDto from(UpsellTypeDef t) {
        return new UpsellTypeDto(
            t.getId(), t.getCode(), t.getLabelFr(), t.getLabelEn(), t.getDescription(),
            t.getIconKey(), t.getServiceItemCode(),
            t.getOrganizationId() == null, t.isSystem(), t.getSortOrder());
    }
}
