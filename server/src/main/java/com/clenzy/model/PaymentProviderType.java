package com.clenzy.model;

public enum PaymentProviderType {
    STRIPE,
    PAYTABS,
    CMI,
    PAYZONE,
    /**
     * Attijari Payment (établissement de paiement d'Attijariwafa Bank, Maroc).
     * Acquéreur carte MAD post-libéralisation CMI (2026). Utilise le même
     * protocole que le CMI (passerelle Maroc Telecommerce est3Dgate : clientid +
     * store_key + hash SHA-512 ver3 + callback), d'où la réutilisation de
     * {@code CmiHashService} et du rendu {@code Est3DGateHtml}.
     */
    ATTIJARI,
    /**
     * YouCan Pay (PSP marocain self-serve). Seule passerelle MAD avec un
     * onboarding sans conventionnement bancaire : clés API publique/privée
     * obtenues en ligne, sandbox incluse. Flux : tokenize (clé privée) →
     * redirection sur la page de paiement hébergée → webhook signé HMAC.
     */
    YOUCAN_PAY,
    /**
     * Provider PayPal retiré (décision produit — flux inopérant). Plus aucun
     * {@code PaymentProvider} actif ni endpoint de retour/webhook associé.
     *
     * <p>La valeur est <strong>conservée volontairement</strong> : la colonne
     * {@code provider_type} (mappée {@code @Enumerated(EnumType.STRING)} sur
     * {@code payment_transactions} et {@code payment_method_config}) peut
     * encore contenir {@code "PAYPAL"} pour des lignes historiques. La
     * supprimer ferait planter Hibernate à la lecture
     * ({@code No enum constant PAYPAL}). Ne pas réutiliser pour un nouveau
     * provider.</p>
     */
    PAYPAL
}
