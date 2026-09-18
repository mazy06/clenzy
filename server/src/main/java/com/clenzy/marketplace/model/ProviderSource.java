package com.clenzy.marketplace.model;

/** Origine d'une fiche : d'ou vient le professionnel. */
public enum ProviderSource {
    /** Candidature spontanee depuis le site public. */
    LANDING,
    /** Saisie par l'equipe plateforme. */
    ADMIN,
    /** Invite par une organisation cliente. */
    INVITATION,
    /** Converti depuis le pipeline de prospection. */
    PROSPECT
}
