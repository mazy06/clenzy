package com.clenzy.dto;

import com.clenzy.model.MarketingContactSource;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

/**
 * Requête publique de capture d'un lead (CLZ Domaine 2). Le consentement RGPD est obligatoire
 * (la capture est refusée sans consentement explicite).
 */
public record CaptureLeadRequest(
        @NotBlank @Email String email,
        String name,
        MarketingContactSource source,
        String locale,
        boolean consent
) {}
