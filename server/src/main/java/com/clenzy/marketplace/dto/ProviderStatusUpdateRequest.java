package com.clenzy.marketplace.dto;

import com.clenzy.marketplace.model.ProviderStatus;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Changement d'etat d'une fiche par l'equipe plateforme.
 *
 * <p>{@code reviewNote} est obligatoire pour un refus : une candidature rejetee
 * sans motif est impossible a reprendre six mois plus tard. La regle est
 * verifiee dans le service, pas ici — elle depend du statut cible.</p>
 */
public record ProviderStatusUpdateRequest(
    @NotNull ProviderStatus status,
    @Size(max = 500) String reviewNote,

    /**
     * Message adresse AU CANDIDAT, envoye par courriel.
     *
     * <p>Facultatif : une suspension interne n'a pas a etre annoncee. Mais un
     * refus sans explication condamne le candidat a redeposer le meme dossier,
     * et la regle correspondante est verifiee dans le service.</p>
     */
    @Size(max = 2000) String decisionMessage
) {}
