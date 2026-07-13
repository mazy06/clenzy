package com.clenzy.payment;

/**
 * Comment le front doit présenter le checkout renvoyé par un provider.
 *
 * <p>Rend le {@link PaymentResult} <strong>auto-descriptif</strong> : le front lit
 * ce mode plutôt que de déduire le rendu du provider ou de la présence d'un
 * {@code clientSecret}. Chaque provider peut ainsi exposer son meilleur mode
 * « in-page » sans que le contrat front/back change — les intégrations futures
 * (iframe régional, hosted fields) s'ajoutent sans rework du port.</p>
 *
 * <p>Panorama providers (recherche 2026) : Stripe → {@link #CLIENT_SECRET}
 * (Embedded Checkout) ; PayTabs (framed), CMI (« CMI Pay »), PayZone → {@link #IFRAME}
 * (leur page hébergée rendue dans une iframe + {@code postMessage}) ;
 * PayPal/Braintree → {@link #HOSTED_FIELDS} (iframes au niveau des champs).</p>
 */
public enum PaymentPresentationMode {

    /** Redirection pleine page vers l'URL hébergée du provider ({@code redirectUrl}). */
    REDIRECT,

    /**
     * Page hébergée du provider rendue dans une {@code <iframe>} sur notre page
     * ({@code redirectUrl}), la complétion étant signalée par {@code postMessage}.
     * Mode « in-page » des PSP régionaux (PayTabs framed, CMI Pay, PayZone).
     */
    IFRAME,

    /**
     * Composant de paiement du provider monté inline à partir d'un {@code clientSecret}
     * (Stripe Embedded Checkout).
     */
    CLIENT_SECRET,

    /**
     * Champs de carte hébergés (iframes au niveau des champs) via le SDK JS du provider,
     * avec collecte d'un token/orderId côté client (PayPal Card Fields, Braintree Hosted
     * Fields, Stripe Payment Element). Réservé aux intégrations futures.
     */
    HOSTED_FIELDS
}
