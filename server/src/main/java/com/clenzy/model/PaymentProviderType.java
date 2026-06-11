package com.clenzy.model;

public enum PaymentProviderType {
    STRIPE,
    PAYTABS,
    CMI,
    PAYZONE,
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
