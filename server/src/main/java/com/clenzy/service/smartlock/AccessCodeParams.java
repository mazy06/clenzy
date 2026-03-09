package com.clenzy.service.smartlock;

import java.time.LocalDateTime;

/**
 * Parametres pour la generation d'un code d'acces sur une serrure connectee.
 *
 * @param code       code d'acces (peut etre null si le provider le genere)
 * @param name       nom descriptif du code (ex: "Clenzy-Jean Dupont")
 * @param validFrom  debut de validite
 * @param validUntil fin de validite
 * @param type       type de code d'acces
 */
public record AccessCodeParams(
        String code,
        String name,
        LocalDateTime validFrom,
        LocalDateTime validUntil,
        AccessCodeType type
) {

    public enum AccessCodeType {
        PERMANENT,
        TEMPORARY,
        ONE_TIME
    }
}
