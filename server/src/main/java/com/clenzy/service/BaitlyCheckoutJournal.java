package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.payment.StripeAmounts;
import com.clenzy.repository.PaymentTransactionRepository;
import com.stripe.model.checkout.Session;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.Objects;
import static com.clenzy.service.InterventionPaymentBatch.require;

/** Un webhook signé n'acquitte que le dossier, le montant et la devise réellement vendus. */
@Service
public class BaitlyCheckoutJournal {
    private final PaymentTransactionRepository payments;
    private final PaymentPersistence persistence;
    public BaitlyCheckoutJournal(PaymentTransactionRepository payments, PaymentPersistence persistence) {
        this.payments=payments;this.persistence=persistence;
    }
    @Transactional
    public void apply(Session session, boolean success) {
        require(session!=null && session.getId()!=null && session.getMetadata()!=null, "Preuve Checkout absente");
        var found=payments.findByProviderTxId(session.getId())
                .orElseThrow(()->new IllegalStateException("Encaissement Checkout introuvable"));
        var tx=payments.lockByReference(found.getOrganizationId(),found.getTransactionRef()).orElseThrow();
        var metadata=session.getMetadata();
        require(tx.getPaymentType()==TransactionType.CHECKOUT && tx.getProviderType()==PaymentProviderType.STRIPE
                && Objects.equals(session.getId(),tx.getProviderTxId()) && "payment".equals(session.getMode())
                && tx.getAmount()!=null && Objects.equals(StripeAmounts.toMinorUnits(tx.getAmount()),session.getAmountTotal())
                && tx.getCurrency()!=null && tx.getCurrency().equalsIgnoreCase(session.getCurrency())
                && Objects.equals(tx.getTransactionRef(),metadata.get("transactionRef"))
                && Objects.equals(tx.getSourceType(),metadata.get("sourceType"))
                && Objects.equals(String.valueOf(tx.getSourceId()),metadata.get("sourceId"))
                && Objects.equals(String.valueOf(tx.getOrganizationId()),metadata.get("orgId")),
                "La preuve Checkout ne correspond pas à la transaction");
        if(success) {
            require("complete".equals(session.getStatus())
                    && (("paid".equals(session.getPaymentStatus()) && session.getPaymentIntent()!=null && session.getPaymentIntent().startsWith("pi_"))
                    || ("no_payment_required".equals(session.getPaymentStatus()) && tx.getAmount().signum()==0)),
                    "Encaissement Checkout non confirmé");
            persistence.completeTransaction(tx.getTransactionRef());
        } else {
            require("unpaid".equals(session.getPaymentStatus()), "Un paiement confirmé ne peut pas être déclaré en échec");
            persistence.failTransaction(tx.getTransactionRef(),"Stripe async payment failed");
        }
    }
}
