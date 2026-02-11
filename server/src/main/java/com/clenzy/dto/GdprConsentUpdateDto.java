package com.clenzy.dto;

import java.util.Map;

/**
 * DTO pour la mise a jour des consentements RGPD.
 * Le client envoie un map de type de consentement → granted (true/false).
 *
 * Exemple :
 * {
 *   "consents": {
 *     "MARKETING": true,
 *     "ANALYTICS": false,
 *     "THIRD_PARTY_SHARING": true
 *   }
 * }
 */
public class GdprConsentUpdateDto {

    /**
     * Map des consentements a mettre a jour.
     * Cle = ConsentType (String), Valeur = granted (boolean).
     */
    private Map<String, Boolean> consents;

    public GdprConsentUpdateDto() {}

    public GdprConsentUpdateDto(Map<String, Boolean> consents) {
        this.consents = consents;
    }

    public Map<String, Boolean> getConsents() {
        return consents;
    }

    public void setConsents(Map<String, Boolean> consents) {
        this.consents = consents;
    }
}
