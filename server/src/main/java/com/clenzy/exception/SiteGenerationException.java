package com.clenzy.exception;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

/**
 * Échec de la génération complète d'un site par IA (P2.a booking engine). Levée — jamais avalée — quand
 * le provider IA ne répond pas ou que sa sortie n'est pas exploitable (JSON illisible, aucune page valide)
 * (audit règle #7 : un échec produit un statut explicite, pas un log silencieux ni un site partiel
 * incohérent). 502 : la cause est l'IA en aval, pas la requête de l'exploitant ; il peut relancer.
 */
@ResponseStatus(HttpStatus.BAD_GATEWAY)
public class SiteGenerationException extends RuntimeException {

    public SiteGenerationException(String message) {
        super(message);
    }

    public SiteGenerationException(String message, Throwable cause) {
        super(message, cause);
    }
}
