package com.clenzy.util;

import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Objects;

/**
 * Validation centralisee des pieces jointes (email, contact).
 */
public final class AttachmentValidator {

    private AttachmentValidator() {}

    /**
     * Filtre les fichiers null ou vides d'une liste.
     * Retourne une liste immutable vide si l'entree est null.
     */
    public static List<MultipartFile> sanitizeAndFilter(List<MultipartFile> attachments) {
        if (attachments == null || attachments.isEmpty()) {
            return List.of();
        }
        return attachments.stream()
                .filter(Objects::nonNull)
                .filter(a -> !a.isEmpty())
                .toList();
    }

    /**
     * Valide le nombre et la taille des pieces jointes.
     *
     * @throws IllegalArgumentException si les limites sont depassees
     */
    public static void validate(List<MultipartFile> attachments, int maxCount, long maxSizeBytes) {
        if (attachments.size() > maxCount) {
            throw new IllegalArgumentException("Trop de pieces jointes (max " + maxCount + ")");
        }
        for (MultipartFile attachment : attachments) {
            if (attachment.getSize() > maxSizeBytes) {
                throw new IllegalArgumentException(
                        "Piece jointe trop volumineuse: " + StringUtils.sanitizeFileName(attachment.getOriginalFilename())
                );
            }
        }
    }
}
