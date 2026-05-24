package com.clenzy.integration.channex.dto;

import java.util.List;

/**
 * Resultat d'une operation Smart Disconnect orchestree
 * ({@code POST /api/integrations/channex/properties/{id}/full-disconnect}).
 *
 * <p>Permet a l'UI d'afficher une checklist de ce qui a reussi/echoue/skip
 * pendant la deconnexion sequencee :</p>
 * <ol>
 *   <li>Liste des channels Channex lies a la property</li>
 *   <li>Pour chaque channel : desactivation (PUT is_active=false) puis suppression (DELETE)</li>
 *   <li>Optionnel : suppression de la property Channex elle-meme</li>
 *   <li>Nettoyage local : suppression du mapping + ota_channels rows</li>
 * </ol>
 *
 * <p>Chaque etape est best-effort : un echec n'arrete pas le processus.
 * {@code overallSuccess} = true uniquement si TOUTES les etapes non-SKIPPED
 * sont SUCCESS — l'UI peut alors afficher "Deconnexion complete" ou un
 * mode degrade "Partiellement deconnecte, action manuelle requise".</p>
 *
 * <p><b>Pourquoi orchestre cote backend</b> : la sequence est complexe
 * (Channex refuse DELETE sur channel actif → faut PUT is_active=false d'abord)
 * et necessite plusieurs API calls. Le frontend ne devrait pas avoir a
 * connaitre cette logique — un seul appel REST, un seul reponse atomique.</p>
 */
public record ChannexFullDisconnectResult(
    boolean overallSuccess,
    Long clenzyPropertyId,
    String channexPropertyId,
    List<DisconnectStep> steps
) {

    /** Une etape du processus de deconnexion. */
    public record DisconnectStep(
        String code,
        String label,
        Status status,
        String detail,
        String targetId
    ) {
        public static DisconnectStep success(String code, String label, String detail) {
            return new DisconnectStep(code, label, Status.SUCCESS, detail, null);
        }

        public static DisconnectStep successFor(String code, String label, String detail, String targetId) {
            return new DisconnectStep(code, label, Status.SUCCESS, detail, targetId);
        }

        public static DisconnectStep failed(String code, String label, String detail) {
            return new DisconnectStep(code, label, Status.FAILED, detail, null);
        }

        public static DisconnectStep failedFor(String code, String label, String detail, String targetId) {
            return new DisconnectStep(code, label, Status.FAILED, detail, targetId);
        }

        public static DisconnectStep skipped(String code, String label, String detail) {
            return new DisconnectStep(code, label, Status.SKIPPED, detail, null);
        }
    }

    public enum Status { SUCCESS, FAILED, SKIPPED }
}
