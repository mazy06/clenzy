package com.clenzy.marketplace.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * Candidature deposee depuis le site public.
 *
 * <p>Surface NON authentifiee : tout ce qui arrive ici est hostile par defaut.
 * Le statut, la source et l'organisation porteuse sont decides par le SERVEUR
 * et ne figurent pas dans ce contrat — les exposer aurait laisse n'importe qui
 * s'auto-publier au catalogue.</p>
 */
public record ProviderApplicationRequest(
    @NotBlank @Size(max = 150) String displayName,
    @Size(max = 200) String legalName,
    @Size(max = 80) String contactFirstName,
    @Size(max = 80) String contactLastName,
    @NotBlank @Email @Size(max = 320) String email,
    @Size(max = 40) String phone,
    @Size(max = 300) String website,
    @Size(max = 200) String headline,
    @Size(max = 4000) String bio,

    @Size(max = 200) String baseAddress,
    @Size(max = 80) String baseCity,
    @Size(max = 10) String basePostalCode,
    @Size(max = 2) String baseCountryCode,
    Integer travelRadiusKm,

    /** Codes ISO 639-1. Les valeurs inconnues sont ignorees cote serveur. */
    List<String> languages,

    @Size(max = 40) String registrationNumber,

    /** Codes de categories souhaitees. Les codes inconnus sont ignores. */
    List<String> categoryCodes,

    /** Prestations proposees, avec leurs prix. */
    @jakarta.validation.Valid @Size(max = 40) List<OfferInput> offers,

    /** Zones d'intervention. */
    @jakarta.validation.Valid @Size(max = 40) List<ZoneInput> zones,

    /** Creneaux hebdomadaires. Liste vide = disponible sans contrainte declaree. */
    @jakarta.validation.Valid @Size(max = 60) List<AvailabilityInput> availability,

    /** Acceptation des conditions prestataire. Refusee si absente. */
    boolean acceptedTerms,

    /**
     * Version du document affichee au candidat.
     *
     * <p>Le serveur ne la croit pas sur parole : si elle ne correspond pas a la
     * version courante, c'est que le formulaire etait en cache et montrait un
     * ancien texte — la candidature est refusee plutot que d'enregistrer une
     * preuve qui designe le mauvais document.</p>
     */
    @Size(max = 20) String termsVersion,

    /**
     * Jeton Cloudflare Turnstile.
     *
     * <p>Le formulaire est ouvert a tous : sans lui, remplir le catalogue de
     * fausses fiches ne coute qu'un script. La limite de debit borne la cadence
     * par adresse ; le captcha, lui, coute quelque chose a chaque envoi.</p>
     */
    @Size(max = 4000) String captchaToken
) {
    public record OfferInput(
        @NotBlank @Size(max = 40) String categoryCode,

        /**
         * Prestation du catalogue, quand le candidat l'a choisie dans la liste
         * plutot que saisie librement.
         *
         * <p>Sans elle, une offre deposee depuis le site public reste du texte :
         * le filtre « par prestation » de la console ne la trouve pas, et deux
         * candidats proposant la meme chose ecrivent deux libelles differents.
         * Un code inconnu est refusé : le candidat doit recharger le référentiel
         * avant de soumettre, sans perte silencieuse de sa prestation.</p>
         */
        @Size(max = 60) String serviceItemCode,

        @NotBlank @Size(max = 120) String label,
        @Size(max = 500) String description,
        @Size(max = 20) String pricingModel,
        java.math.BigDecimal amount,
        @Size(max = 3) String currency,
        @Size(max = 40) String unitLabel,
        Integer minDurationMinutes
    ) {}

    public record ZoneInput(
        @Size(max = 2) String countryCode,
        @Size(max = 3) String department,
        @Size(max = 80) String city,
        @Size(max = 10) String postalCode,
        Integer radiusKm,
        boolean primary
    ) {}

    public record AvailabilityInput(
        short dayOfWeek,
        @NotBlank String startTime,
        @NotBlank String endTime
    ) {}
}
