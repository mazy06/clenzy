package com.clenzy.service;

import com.clenzy.model.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Trace persistée dans le fil contractuel, dans la transaction de décision. */
@Service
@Transactional(propagation = Propagation.MANDATORY)
public class ServiceQuoteAmendmentDiscussion {
    private final ContactThreadService threads;
    public ServiceQuoteAmendmentDiscussion(ContactThreadService threads) { this.threads = threads; }

    public void proposed(ServiceQuote quote, ServiceQuoteAmendment amendment, String actorKeycloakId) {
        if (amendment.getStatus() != ServiceQuoteAmendment.Status.PROPOSED) {
            throw new IllegalStateException("Une proposition en attente est requise");
        }
        post(quote, actorKeycloakId, "Avenant proposé au devis #" + quote.getId(),
                "Avenant #" + amendment.getId() + " proposé.\n"
                + "Montant de référence : " + amendment.getOriginalAmount().toPlainString() + " " + amendment.getCurrency() + "\n"
                + "Montant proposé : " + amendment.getProposedAmount().toPlainString() + " " + amendment.getCurrency() + "\n"
                + "Motif : " + amendment.getReason() + "\n"
                + "Proposition enregistrée le " + amendment.getCreatedAt() + ". L'accord courant reste en vigueur jusqu'à acceptation.");
    }

    public void closed(ServiceQuote quote, ServiceQuoteAmendment amendment, String actorKeycloakId) {
        String decision = switch (amendment.getStatus()) {
            case REJECTED -> "refusé";
            case WITHDRAWN -> "retiré";
            default -> throw new IllegalStateException("Un refus ou un retrait est requis");
        };
        post(quote, actorKeycloakId, "Avenant " + decision + " au devis #" + quote.getId(),
                "Avenant #" + amendment.getId() + " " + decision + ".\n"
                + "Montant proposé : " + amendment.getProposedAmount().toPlainString() + " " + amendment.getCurrency() + "\n"
                + "Motif de la proposition : " + amendment.getReason() + "\n"
                + "Décision enregistrée le " + amendment.getDecidedAt() + ". L'accord courant est conservé.");
    }

    public void accepted(ServiceQuote quote, ServiceQuoteAmendment amendment, String actorKeycloakId) {
        String subject = "Avenant accepté au devis #" + quote.getId();
        String body = "Avenant #" + amendment.getId() + " accepté.\n"
                + "Montant précédent : " + amendment.getOriginalAmount().toPlainString() + " " + amendment.getCurrency() + "\n"
                + "Nouveau montant convenu : " + amendment.getProposedAmount().toPlainString() + " " + amendment.getCurrency() + "\n"
                + "Motif : " + amendment.getReason() + "\n"
                + "Décision enregistrée le " + amendment.getDecidedAt() + ". Le devis initial est conservé.";
        post(quote, actorKeycloakId, subject, body);
    }

    public void cancelled(ServiceQuote quote, ServiceQuoteCancellation cancellation, String actorKeycloakId) {
        post(quote, actorKeycloakId, (cancellation.getInterventionId() == null ? "Accord annulé pour le devis #" : "Mission annulée pour le devis #") + quote.getId(),
                "Le gestionnaire a annulé l'accord" + (cancellation.getInterventionId() == null ? "" : " et la mission #" + cancellation.getInterventionId()) + ".\n"
                + "Motif : " + cancellation.getReason() + "\n"
                + "Décision enregistrée le " + cancellation.getCancelledAt() + ".\n"
                + "Le devis initial et les avenants acceptés sont conservés dans l'historique. "
                + "Tout remplacement nécessite une nouvelle proposition et une nouvelle acceptation.");
    }

    public void financial(ServiceQuote quote, String actorKeycloakId, String subject, String body) {
        post(quote, actorKeycloakId, subject, body);
    }

    private void post(ServiceQuote quote, String actorKeycloakId, String subject, String body) {
        var thread = threads.findByReference(quote.getOrganizationId(), QuoteDiscussionScope.referenceType(quote),
                QuoteDiscussionScope.referenceId(quote))
                .orElseThrow(() -> new IllegalStateException("Le fil du devis doit être disponible avant d'enregistrer l'avenant"));
        // post vérifie la participation et le périmètre actuel de l'équipe, puis diffuse seulement aux parties autorisées.
        threads.post(thread, actorKeycloakId, subject, body, ContactMessagePriority.MEDIUM);
    }
}
