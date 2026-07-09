package com.clenzy.booking.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Corps d'une retouche IA de page (« Retoucher avec l'IA »). {@code instruction} = consigne en langage
 * naturel. {@code sectionId} réservé à un ciblage de section ultérieur (non consommé en première passe).
 */
public record SiteRefineRequest(
    @NotBlank @Size(max = 1000) String instruction,
    String sectionId
) {}
