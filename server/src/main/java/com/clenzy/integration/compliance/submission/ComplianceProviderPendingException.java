package com.clenzy.integration.compliance.submission;

import com.clenzy.integration.compliance.model.ComplianceProviderType;

/**
 * Levée par une stratégie de soumission dont le provider n'est pas encore
 * intégrable techniquement : système gouvernemental <b>sans API publique</b>
 * (DGSN Maroc, Absher KSA). Une vraie intégration nécessite un partenariat
 * officiel (specs + credentials délivrés par l'autorité).
 *
 * <p>Honnêteté d'intégration : on ne devine PAS un contrat HTTP. L'orchestrateur
 * trace cet échec explicitement (la déclaration reste non SUBMITTED) plutôt que
 * de simuler une soumission qui n'a pas lieu.</p>
 */
public class ComplianceProviderPendingException extends RuntimeException {

    private final ComplianceProviderType provider;

    public ComplianceProviderPendingException(ComplianceProviderType provider, String message) {
        super(message);
        this.provider = provider;
    }

    public ComplianceProviderType getProvider() {
        return provider;
    }
}
