package com.clenzy.integration.channex.dto;

import java.util.List;

/**
 * Bilan d'un push de contenu Clenzy → Channex (B4).
 *
 * @param descriptionPushed        description marketing poussee (PUT /properties)
 * @param photosCreated            photos creees cote Channex (POST /photos)
 * @param photosAlreadyPresent     photos deja presentes (meme URL) — non re-poussees
 * @param photosSkippedNoPublicUrl photos Clenzy SANS URL publique stable (stockage
 *                                 interne BYTEA/S3 prive) : Channex exige des URLs
 *                                 perennes accessibles — non poussables en l'etat
 * @param photoErrors              echecs unitaires (voir logs)
 * @param notes                    limites connues (policies/taxes non poussees...)
 */
public record ChannexContentPushResult(
    boolean descriptionPushed,
    int photosCreated,
    int photosAlreadyPresent,
    int photosSkippedNoPublicUrl,
    int photoErrors,
    List<String> notes
) {}
