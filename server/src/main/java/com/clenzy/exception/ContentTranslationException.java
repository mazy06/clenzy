package com.clenzy.exception;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

/**
 * Échec d'une auto-traduction IA de contenu de site (page / article). Levée — jamais avalée — quand le
 * provider IA ne renvoie pas une traduction exploitable (audit règle #7 : un échec produit un statut
 * explicite, pas un log silencieux). 502 : la cause est l'IA en aval, pas la requête de l'exploitant ;
 * il peut relancer la traduction.
 */
@ResponseStatus(HttpStatus.BAD_GATEWAY)
public class ContentTranslationException extends RuntimeException {
    public ContentTranslationException(String message) {
        super(message);
    }
}
