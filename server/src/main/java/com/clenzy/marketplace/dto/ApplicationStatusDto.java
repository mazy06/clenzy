package com.clenzy.marketplace.dto;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Etat d'une candidature, rendu au porteur du jeton de depot.
 *
 * <p>Volontairement pauvre : le nom que le candidat a lui-meme saisi, l'etat du
 * dossier et ses pieces. Aucune note interne de moderation, aucun identifiant
 * d'organisation — le jeton ouvre un depot, pas une console.</p>
 *
 * @param requiredTypes pieces sans lesquelles le dossier reste incomplet ; les
 *                      annoncer evite un dossier a moitie fourni par ignorance.
 */
public record ApplicationStatusDto(
    String displayName,
    String status,
    LocalDateTime submittedAt,
    List<String> requiredTypes,
    List<ApplicationDocumentDto> documents
) {}
