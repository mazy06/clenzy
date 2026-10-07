package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.payment.StripeAmounts;
import com.clenzy.payment.StripeGateway;
import com.clenzy.repository.PaymentTransactionRepository;
import com.clenzy.tenant.TenantScopedExecutor;
import com.stripe.model.checkout.Session;
import org.springframework.stereotype.Service;
import java.util.*;
import static com.clenzy.service.InterventionPaymentBatch.require;

/** L'acompte possède sa session propre ; il ne passe jamais par la confirmation d'un solde. */
@Service
public class BaitlyMaintenanceDepositCheckout {
    private final PaymentTransactionRepository payments;
    private final StripeGateway stripe;
    private final BaitlyMaintenanceDepositWriter writer;
    private final TenantScopedExecutor tenants;
    public BaitlyMaintenanceDepositCheckout(PaymentTransactionRepository payments,StripeGateway stripe,
            BaitlyMaintenanceDepositWriter writer,TenantScopedExecutor tenants) {
        this.payments=payments;this.stripe=stripe;this.writer=writer;this.tenants=tenants;
    }
    public boolean handleWebhook(Session incoming) {
        var found=payments.findByProviderTxId(incoming.getId()).filter(BaitlyMaintenanceDepositCheckout::handles);
        boolean announced=incoming.getMetadata()!=null && "INTERVENTION".equals(incoming.getMetadata().get("sourceType"))
                && "DEPOSIT".equals(incoming.getMetadata().get("purpose"));
        if(found.isEmpty()){require(!announced,"Session d'acompte pas encore rattachée");return false;}
        refresh(found.get());return true;
    }
    public Optional<Map<String,Object>> sessionStatus(String sessionId,Long orgId) {
        return payments.findByProviderTxId(sessionId).filter(tx->Objects.equals(orgId,tx.getOrganizationId()))
                .filter(BaitlyMaintenanceDepositCheckout::handles).map(this::refresh);
    }
    private Map<String,Object> refresh(PaymentTransaction tx) {
        final Session session;
        try{session=stripe.retrieveSession(tx.getProviderTxId());}
        catch(com.stripe.exception.StripeException failure){throw new IllegalStateException("Vérification de l'acompte indisponible",failure);}
        verify(tx,session);
        return tenants.callAsOrganization(tx.getOrganizationId(),()->{
            if("complete".equals(session.getStatus()) && "paid".equals(session.getPaymentStatus())) {
                require(session.getPaymentIntent()!=null && session.getPaymentIntent().startsWith("pi_"),"Intention de paiement d'acompte absente");
                writer.confirm(tx.getTransactionRef(),session.getId());
                return Map.of("paymentStatus","PAID","interventionStatus","DEPOSIT_PAID");
            }
            if("expired".equals(session.getStatus()) && "unpaid".equals(session.getPaymentStatus())) {
                require(session.getPaymentIntent()==null,"Intention d'acompte à rapprocher avant reprise");
                writer.expire(tx.getTransactionRef(),session.getId());
                return Map.of("paymentStatus","FAILED","interventionStatus","DEPOSIT_EXPIRED");
            }
            return Map.of("paymentStatus","PROCESSING","interventionStatus","DEPOSIT_PENDING");
        });
    }
    static boolean handles(PaymentTransaction tx){return "INTERVENTION".equals(tx.getSourceType()) && DepositReconciler.isDeposit(tx);}
    static void verify(PaymentTransaction tx,Session session) {
        var meta=session==null?null:session.getMetadata();
        require(handles(tx) && session!=null && Objects.equals(tx.getProviderTxId(),session.getId())
                && tx.getPaymentType()==TransactionType.CHECKOUT && tx.getProviderType()==PaymentProviderType.STRIPE
                && "payment".equals(session.getMode()) && tx.getAmount()!=null && tx.getAmount().signum()>0
                && Objects.equals(StripeAmounts.toMinorUnits(tx.getAmount()),session.getAmountTotal())
                && tx.getCurrency()!=null && tx.getCurrency().equalsIgnoreCase(session.getCurrency())
                && meta!=null && Objects.equals(tx.getTransactionRef(),meta.get("transactionRef"))
                && "INTERVENTION".equals(meta.get("sourceType")) && "DEPOSIT".equals(meta.get("purpose"))
                && Objects.equals(String.valueOf(tx.getSourceId()),meta.get("sourceId"))
                && Objects.equals(String.valueOf(tx.getOrganizationId()),meta.get("orgId")),"Preuve d'acompte incohérente");
    }
}
