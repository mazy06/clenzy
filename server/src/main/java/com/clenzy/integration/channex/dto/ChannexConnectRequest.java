package com.clenzy.integration.channex.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Requete de connexion d'une property Clenzy a Channex.
 *
 * <p>Deux modes possibles :</p>
 * <ul>
 *   <li><b>Import IDs existants</b> (mode actuel) — l'utilisateur a deja cree
 *     la property + room_type + rate_plan dans son dashboard Channex et nous
 *     donne les 3 IDs. Cas le plus commun pour une conciergerie qui migre.</li>
 *   <li><b>Auto-create</b> (future iteration) — Clenzy cree automatiquement
 *     property + room_type + rate_plan via l'API Channex.</li>
 * </ul>
 */
public record ChannexConnectRequest(
    @NotBlank(message = "channexPropertyId est obligatoire")
    @Size(min = 1, max = 64, message = "channexPropertyId entre 1 et 64 caracteres")
    String channexPropertyId,

    @NotBlank(message = "channexRoomTypeId est obligatoire")
    @Size(min = 1, max = 64)
    String channexRoomTypeId,

    @NotBlank(message = "channexDefaultRatePlanId est obligatoire")
    @Size(min = 1, max = 64)
    String channexDefaultRatePlanId
) {}
