package com.clenzy.service.payout;

import com.clenzy.dto.PayoutTransferDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.PayoutTransfer;
import com.clenzy.payment.StripeGateway;
import com.clenzy.repository.PayoutTransferRepository;
import com.stripe.exception.StripeException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/** La lecture PSP précède la transaction de confirmation ; aucune émission ni annulation PSP ici. */
@Service
@Transactional(propagation = Propagation.NEVER)
public class PayoutReconciliationService {
    private final PayoutTransferRepository transfers;
    private final StripeGateway stripe;
    private final PayoutReconciliationWriter writer;
    public PayoutReconciliationService(PayoutTransferRepository transfers, StripeGateway stripe, PayoutReconciliationWriter writer) {
        this.transfers = transfers; this.stripe = stripe; this.writer = writer;
    }
    public PayoutTransferEvidence verify(Long orgId, Long id, String reference) {
        if (orgId == null || reference == null || !reference.matches("tr_[A-Za-z0-9]{1,61}")) {
            throw new IllegalArgumentException("Organisation et référence Stripe valides requises.");
        }
        var transfer = transfers.findByIdAndOrganizationId(id, orgId)
                .orElseThrow(() -> new NotFoundException("Transfert introuvable dans cette organisation."));
        requireReconcilable(transfer);
        try {
            var proof = PayoutTransferEvidence.from(stripe.retrieveTransfer(reference), reference);
            proof.verify(transfer);
            return proof;
        } catch (StripeException failure) {
            // Une erreur PSP, y compris 404, ne constitue jamais une autorisation de réémettre.
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Vérification Stripe indisponible. Aucun changement effectué.");
        }
    }
    public PayoutTransferDto confirm(Long orgId, Long id, String reference, String actor) {
        if (actor == null || actor.isBlank() || actor.length() > 255) throw new IllegalArgumentException("Opérateur requis.");
        return writer.confirm(orgId, id, verify(orgId, id, reference), actor);
    }
    static void requireReconcilable(PayoutTransfer transfer) {
        if (transfer.getState() == PayoutTransfer.State.SUBMITTING) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Émission encore en cours. Confirmation indisponible.");
        }
    }
}
