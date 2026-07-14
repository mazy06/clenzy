package com.clenzy.service.automation;

import com.clenzy.model.AutomationAction;
import com.clenzy.model.AutomationRule;

import java.time.LocalDateTime;
import java.util.Objects;

/**
 * SPI des actions du moteur AutomationRule (registre central des flux deterministes,
 * fiche 08).
 *
 * <p>Chaque action metier est un bean Spring implementant cette interface ; le moteur
 * les decouvre par injection de {@code List<AutomationActionExecutor>} via
 * {@link AutomationActionRegistry} et route l'execution d'une regle vers l'executeur
 * dont {@link #action()} correspond au {@code actionType} de la regle. Une action = un
 * executeur (doublon → echec au boot ; action sans executeur → statut FAILED explicite).</p>
 *
 * <p>Contrats d'implementation :</p>
 * <ul>
 *   <li><b>Resultat explicite</b> : {@link ExecutionResult#executed()} → statut EXECUTED
 *       + metrique {@code automation.flow.executed{action}} incrementee par le moteur ;
 *       {@link ExecutionResult#skipped(String)} → statut SKIPPED avec raison persistee
 *       (ex. relance d'avis alors que l'avis est deja recu, facture deja payee) ;
 *       {@link ExecutionResult#rescheduled(LocalDateTime, String)} → NON-terminal : le
 *       moteur remet l'execution en PENDING a l'echeance donnee (heure murale serveur,
 *       meme referentiel que {@code scheduled_at}) — pour un guard temporel pas encore
 *       atteint (ex. REVOKE_ACCESS_CODE avant check-out + grace), car SKIPPED/EXECUTED
 *       consommerait l'execution des triggers one-shot ;
 *       exception → statut FAILED avec message persiste. Jamais de no-op silencieux.</li>
 *   <li><b>Idempotence</b> : l'idempotence generique (regle x sujet) est portee par le
 *       moteur via {@code AutomationExecution} ; l'executeur ajoute sa propre cle metier
 *       en filet quand un doublon aurait un effet reel (creation d'entite, envoi).</li>
 *   <li><b>Contexte</b> : le moteur a deja pose le contexte tenant et, pour un sujet
 *       TYPE_RESERVATION, resolu {@code ctx.reservation()}. {@code ctx.data()} est
 *       VOLATILE (vide sur le chemin planifie/draine) — une action doit savoir se
 *       reconstruire a partir du sujet seul.</li>
 *   <li><b>Pas d'appel HTTP externe dans une transaction DB.</b></li>
 * </ul>
 */
public interface AutomationActionExecutor {

    /** Action du moteur que cet executeur implemente (cle du registre). */
    AutomationAction action();

    /**
     * Execute l'action pour une regle declenchee, dans le contexte donne.
     *
     * @throws RuntimeException toute erreur → statut FAILED persiste par le moteur
     */
    ExecutionResult execute(AutomationRule rule, AutomationActionContext ctx);

    /**
     * Resultat explicite d'une execution : effectuee, sautee avec une raison lisible,
     * ou re-planifiee ({@code rescheduledAt} non null → le moteur remet l'execution en
     * PENDING a cette echeance au lieu d'un statut terminal).
     *
     * <p>{@code refId} : reference metier optionnelle produite par l'execution (ex. id du
     * {@code GuestMessageLog} cree par un envoi de message), pour que le moteur puisse la
     * rattacher au journal de la constellation. Null pour la plupart des actions.</p>
     */
    record ExecutionResult(boolean skipped, String detail, LocalDateTime rescheduledAt, Long refId) {

        public static ExecutionResult executed() {
            return new ExecutionResult(false, null, null, null);
        }

        /** Execution effectuee ayant produit une reference metier (ex. id du message envoye). */
        public static ExecutionResult executed(Long refId) {
            return new ExecutionResult(false, null, null, refId);
        }

        public static ExecutionResult skipped(String reason) {
            return new ExecutionResult(true, reason, null, null);
        }

        /**
         * Guard temporel non atteint : re-planifie l'execution (statut PENDING) a
         * {@code at} (heure murale serveur, referentiel de {@code scheduled_at}).
         * Ne consomme PAS l'execution one-shot, contrairement a skipped/executed.
         */
        public static ExecutionResult rescheduled(LocalDateTime at, String reason) {
            return new ExecutionResult(false, reason, Objects.requireNonNull(at, "rescheduledAt"), null);
        }
    }
}
