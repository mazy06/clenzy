package com.clenzy.integration.channex.dto;

import java.util.List;

/**
 * Rapport de pre-flight check Channex — Quick Win #3.
 *
 * <p><b>Objectif</b> : repondre a la question "si je clique 'Connecter' maintenant,
 * ca va passer ou pas ?" AVANT que l'utilisateur n'investisse 5 minutes dans
 * un wizard OAuth pour decouvrir un blocage trivial (cle API invalide, property
 * deja mappee, etc.).</p>
 *
 * <p>Le report est une serie de {@link PreflightCheck} avec severite :</p>
 * <ul>
 *   <li><b>OK</b> : tout va bien, info purement positive</li>
 *   <li><b>WARNING</b> : on peut continuer mais avec un defaut applique (ex : devise
 *       non renseignee → EUR par defaut)</li>
 *   <li><b>BLOCKER</b> : impossible de continuer (ex : API Channex inaccessible,
 *       property deja mappee). {@link #canProceed} = false des qu'un BLOCKER existe.</li>
 * </ul>
 *
 * <p>Chaque check a un {@code code} stable pour l'affichage UI (icone + couleur)
 * et un {@code remediation} optionnel donnant la marche a suivre cote user.</p>
 */
public record ChannexPreflightReport(
    boolean canProceed,
    List<PreflightCheck> checks
) {

    /**
     * Un check individuel du pre-flight.
     *
     * <p>Codes possibles (stables pour mapping UI) :</p>
     * <ul>
     *   <li>{@code API_REACHABLE}        : Channex API ping (BLOCKER si KO)</li>
     *   <li>{@code WHITELABEL_CAPABILITIES} : snapshot des capabilities WL (INFO)</li>
     *   <li>{@code HUB_STATE}            : nb properties dans le hub (INFO)</li>
     *   <li>{@code PROPERTY_EXISTS}      : property Clenzy existe + meme org (BLOCKER si KO)</li>
     *   <li>{@code PROPERTY_NOT_MAPPED}  : pas de mapping existant (BLOCKER si KO)</li>
     *   <li>{@code PROPERTY_NAME}        : nom defini (WARNING si missing)</li>
     *   <li>{@code PROPERTY_CURRENCY}    : devise definie (WARNING si missing)</li>
     *   <li>{@code PROPERTY_COUNTRY}     : pays defini (WARNING si missing)</li>
     * </ul>
     */
    public record PreflightCheck(
        String code,
        String label,
        Severity severity,
        String detail,
        String remediation
    ) {
        public static PreflightCheck ok(String code, String label, String detail) {
            return new PreflightCheck(code, label, Severity.OK, detail, null);
        }

        public static PreflightCheck warning(String code, String label, String detail,
                                              String remediation) {
            return new PreflightCheck(code, label, Severity.WARNING, detail, remediation);
        }

        public static PreflightCheck blocker(String code, String label, String detail,
                                              String remediation) {
            return new PreflightCheck(code, label, Severity.BLOCKER, detail, remediation);
        }
    }

    public enum Severity { OK, WARNING, BLOCKER }
}
