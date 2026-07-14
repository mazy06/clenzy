package com.clenzy.payment.provider;

import com.clenzy.payment.PaymentRequest;

/**
 * Aides partagées par les adaptateurs de paiement régionaux.
 *
 * <p>Extrait de code dupliqué à l'identique dans PayZone / PayTabs / CMI
 * (Rule of Three).</p>
 */
public final class PaymentAdapterSupport {

    private PaymentAdapterSupport() {
    }

    /**
     * Récupère l'{@code orgId} injecté par l'orchestrateur dans la metadata de la
     * requête. Échoue vite (fail-fast) si absent : un adaptateur ne peut pas
     * résoudre les credentials marchand sans l'organisation.
     *
     * @param providerName nom lisible du fournisseur pour le message d'erreur
     */
    public static Long requireOrgId(PaymentRequest request, String providerName) {
        if (request.metadata() == null || !request.metadata().containsKey("orgId")) {
            throw new IllegalStateException(
                providerName + " createPayment called without orgId metadata — orchestrator must inject it");
        }
        return Long.parseLong(request.metadata().get("orgId"));
    }
}
