package com.clenzy.service.access;

import java.util.Map;

/**
 * Resultat de la resolution du code d'acces pour une reservation.
 * Contient la methode d'acces detectee et les variables de template associees.
 *
 * Les variables sont injectees dans le template via le mecanisme extraVars
 * de TemplateInterpolationService — elles ecrasent les valeurs statiques.
 */
public record AccessCodeResult(
        AccessMethod method,
        Map<String, String> templateVariables
) {

    /**
     * Methode d'acces detectee pour la propriete.
     */
    public enum AccessMethod {
        /** Serrure connectee Tuya avec code temporaire genere */
        SMART_LOCK,
        /** Point d'echange de cles (KeyNest / Clenzy KeyVault) */
        KEY_EXCHANGE,
        /** Pas de systeme automatise — gestion manuelle (ou code statique CheckInInstructions) */
        MANUAL
    }

    /**
     * Resultat vide pour la methode manuelle (aucune variable supplementaire).
     * Le {accessCode} restera la valeur statique de CheckInInstructions.
     */
    public static AccessCodeResult manual() {
        return new AccessCodeResult(AccessMethod.MANUAL, Map.of());
    }
}
