package com.clenzy.exception;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

/**
 * Levée quand l'endpoint public de capture de leads est appelé alors que l'organisation
 * a désactivé la capture de leads (réglage de croissance org-level).
 * <p>
 * Renvoyée en 403 : le booking engine ne devrait pas exposer le formulaire dans ce cas ;
 * l'appel direct est rejeté côté serveur (enforcement réel du réglage).
 */
@ResponseStatus(HttpStatus.FORBIDDEN)
public class LeadCaptureDisabledException extends RuntimeException {
    public LeadCaptureDisabledException(String message) {
        super(message);
    }
}
