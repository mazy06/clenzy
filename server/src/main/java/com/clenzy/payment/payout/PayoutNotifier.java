package com.clenzy.payment.payout;

import com.clenzy.model.NotificationKey;
import com.clenzy.model.OwnerPayout;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.NotificationService;
import org.springframework.stereotype.Component;

/**
 * Composant utilitaire partagé par les {@link PayoutExecutor} pour envoyer
 * les notifications standardisées (succès / échec / SEPA pending).
 *
 * <p>Évite la duplication des appels {@code notificationService.*} dans
 * chaque exécuteur — un seul point pour ajuster le wording, les canaux ou
 * la cible (admin / propriétaire).</p>
 */
@Component
public class PayoutNotifier {

    private final NotificationService notificationService;
    private final UserRepository userRepository;

    public PayoutNotifier(NotificationService notificationService, UserRepository userRepository) {
        this.notificationService = notificationService;
        this.userRepository = userRepository;
    }

    /** Notification "reversement effectue avec succes". */
    public void notifySuccess(OwnerPayout payout) {
        String amount = payout.getNetAmount() + " " + payout.getCurrency();
        notificationService.notifyAdminsAndManagersByOrgId(
            payout.getOrganizationId(),
            NotificationKey.PAYOUT_EXECUTED,
            "Reversement execute",
            "Le reversement #" + payout.getId() + " (" + amount + ") a ete execute avec succes.",
            "/billing"
        );
        notifyOwner(payout, NotificationKey.PAYOUT_EXECUTED,
            "Reversement effectue",
            "Votre reversement de " + amount + " a ete effectue. Reference: " + payout.getPaymentReference());
    }

    /** Notification "echec du reversement". */
    public void notifyFailure(OwnerPayout payout, String errorMessage) {
        notificationService.notifyAdminsAndManagersByOrgId(
            payout.getOrganizationId(),
            NotificationKey.PAYOUT_FAILED,
            "Echec du reversement",
            "Le reversement #" + payout.getId() + " a echoue: " + errorMessage,
            "/billing"
        );
        notifyOwner(payout, NotificationKey.PAYOUT_FAILED,
            "Echec du reversement",
            "Votre reversement de " + payout.getNetAmount() + " " + payout.getCurrency()
                + " n'a pas pu etre execute. Notre equipe a ete notifiee.");
    }

    /**
     * Alerte de reconciliation : le transfert externe a REUSSI mais la
     * persistance du resultat en base a echoue (incoherence transfert-emis /
     * DB-non-persistee). Un humain doit reconcilier — sans cette alerte la
     * divergence n'etait visible que dans les logs (regle audit n°7).
     *
     * <p>Le re-essai du payout est sans risque (idempotency key Stripe), mais
     * il faut un humain pour le declencher et verifier l'etat reel.</p>
     */
    public void notifyReconciliationRequired(OwnerPayout payout, String transferReference) {
        notificationService.notifyAdminsAndManagersByOrgId(
            payout.getOrganizationId(),
            NotificationKey.RECONCILIATION_FAILED,
            "Reconciliation reversement requise",
            "Le reversement #" + payout.getId() + " (" + payout.getNetAmount() + " " + payout.getCurrency()
                + ") a ete transfere (ref " + transferReference + ") mais son enregistrement a echoue. "
                + "Verifier l'etat du payout avant tout re-essai (le re-essai est sans risque : idempotence du virement).",
            "/billing"
        );
    }

    /** Notification "virement SEPA a effectuer manuellement". */
    public void notifySepaPending(OwnerPayout payout) {
        notificationService.notifyAdminsAndManagersByOrgId(
            payout.getOrganizationId(),
            NotificationKey.PAYOUT_PENDING_APPROVAL,
            "Virement SEPA a effectuer",
            "Le reversement #" + payout.getId() + " (" + payout.getNetAmount() + " " + payout.getCurrency()
                + ") est pret pour virement SEPA.",
            "/billing"
        );
    }

    private void notifyOwner(OwnerPayout payout, NotificationKey key, String title, String message) {
        userRepository.findById(payout.getOwnerId()).ifPresent(owner -> {
            if (owner.getKeycloakId() != null) {
                notificationService.sendByOrgId(
                    owner.getKeycloakId(), key, title, message,
                    "/billing", payout.getOrganizationId()
                );
            }
        });
    }
}
