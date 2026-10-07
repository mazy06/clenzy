package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.PaymentTransactionRepository;
import com.clenzy.service.ai.*;
import jakarta.persistence.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.util.*;
import static com.clenzy.service.BaitlyRefundSeries.require;

/** Même décision durable et preuve PSP que les prestations ; répartition conservée au centime. */
@Service
public class BaitlyCommerceRefunds {
    private final EntityManager em;
    private final PaymentTransactionRepository payments;
    private final WalletService wallets;
    private final LedgerService ledger;
    private final BaitlyCreditFunding credits;
    private final com.clenzy.service.payout.BaitlyCommercePayoutStore payouts;
    public BaitlyCommerceRefunds(EntityManager em,PaymentTransactionRepository payments,WalletService wallets,LedgerService ledger,BaitlyCreditFunding credits,com.clenzy.service.payout.BaitlyCommercePayoutStore payouts) {
        this.em=em;this.payments=payments;this.wallets=wallets;this.ledger=ledger;this.credits=credits;this.payouts=payouts;
    }
    public static boolean supports(String source) {return source!=null && Set.of("UPSELL","HARDWARE_ORDER",AiCreditPurchaseService.SOURCE_TYPE).contains(source);}
    public record RefundView(String reference,String status,BigDecimal amount,String reason,boolean applied) {}
    public record ReceiptView(String reference,BigDecimal amount,String currency,String label) {}
    @Transactional(readOnly=true)
    public List<ReceiptView> creditPurchases(Long org) {
        return em.createQuery("from PaymentTransaction where organizationId=:org and sourceType='AI_CREDIT_TOPUP' and paymentType=com.clenzy.model.TransactionType.CHECKOUT and status=com.clenzy.model.TransactionStatus.COMPLETED order by id desc",PaymentTransaction.class)
            .setParameter("org",org).setMaxResults(100).getResultList().stream().map(p->new ReceiptView(p.getTransactionRef(),p.getAmount(),p.getCurrency(),Objects.toString(p.getMetadata()==null?null:p.getMetadata().get("pack_key"),p.getTransactionRef()))).toList();
    }
    public record View(String reference,String source,Long sourceId,String currency,BigDecimal paid,BigDecimal refunded,BigDecimal reserved,BigDecimal available,List<RefundView> refunds) {}
    @Transactional(readOnly=true)
    public View view(Long org,String source,Long id) {
        require(supports(source),"Source commerciale inconnue");
        var originals=payments.findByOrganizationIdAndSourceTypeAndSourceId(org,source,id).stream()
                .filter(p->p.getPaymentType()==TransactionType.CHECKOUT && p.getStatus()==TransactionStatus.COMPLETED).toList();
        require(originals.size()==1,"Sélectionnez l'encaissement à rembourser");return view(org,originals.getFirst().getTransactionRef());
    }
    @Transactional(readOnly=true)
    public View view(Long org,String ref) {
        var original=payments.findByTransactionRef(ref).orElseThrow();requireOriginal(org,original);
        var rows=related(original);var history=BaitlyRefundSeries.history(original,rows);
        BigDecimal refunded=BigDecimal.ZERO,reserved=BigDecimal.ZERO;
        for(var refund:history) if(refund.getStatus()==TransactionStatus.COMPLETED) refunded=refunded.add(refund.getAmount());else reserved=reserved.add(refund.getAmount());
        return new View(ref,original.getSourceType(),original.getSourceId(),original.getCurrency(),original.getAmount(),refunded,reserved,
                original.getAmount().subtract(refunded).subtract(reserved),history.stream().map(p->new RefundView(p.getTransactionRef(),p.getStatus().name(),p.getAmount(),Objects.toString(p.getMetadata().get("refundReason"),""),Boolean.TRUE.equals(p.getMetadata().get("commerceApplied")))).toList());
    }
    @Transactional
    public String prepare(Long org,String ref,BigDecimal amount,UUID request,String reason,String actor) {
        require(request!=null && amount!=null && amount.signum()>0 && amount.scale()<=2 && amount.precision()<=12
                && reason!=null && !reason.isBlank() && reason.length()<=1000 && actor!=null && !actor.isBlank(),"Montant, demande, motif et auteur requis");
        var original=payments.lockByReference(org,ref).orElseThrow();em.refresh(original);requireOriginal(org,original);
        var history=BaitlyRefundSeries.history(original,related(original));
        for(var prior:history) if(request.toString().equals(prior.getMetadata().get("refundRequestId"))) {
            require(amount.compareTo(prior.getAmount())==0 && reason.trim().equals(prior.getMetadata().get("refundReason")),"Cette demande existe avec un autre montant ou motif");return prior.getTransactionRef();
        }
        require(history.stream().allMatch(p->p.getStatus()==TransactionStatus.COMPLETED && Boolean.TRUE.equals(p.getMetadata().get("commerceApplied"))),"Restitution précédente à rapprocher");
        BigDecimal before=history.stream().map(PaymentTransaction::getAmount).reduce(BigDecimal.ZERO,BigDecimal::add);
        require(before.add(amount).compareTo(original.getAmount())<=0,"Le montant dépasse le solde remboursable");
        validateOrder(original);
        var refund=new PaymentTransaction();refund.setOrganizationId(org);refund.setTransactionRef("REF-"+UUID.randomUUID());
        refund.setProviderType(PaymentProviderType.STRIPE);refund.setPaymentType(TransactionType.REFUND);refund.setStatus(TransactionStatus.PROCESSING);
        refund.setSourceType(original.getSourceType());refund.setSourceId(original.getSourceId());refund.setCurrency(original.getCurrency());refund.setAmount(amount);
        refund.setIdempotencyKey("REFUND-"+org+"-"+original.getId()+"-"+request);
        refund.setMetadata(Map.of("managedRefund",true,"cumulativeRefund",true,"commerceRefund",true,"originalTransactionRef",ref,
                "refundRequestId",request.toString(),"refundBefore",before.toPlainString(),"refundAfter",before.add(amount).toPlainString(),"refundReason",reason.trim(),"refundActor",actor));
        payments.saveAndFlush(refund);credits.sync(original);return refund.getTransactionRef();
    }
    /** Rejouable par outbox ; une notification hors ordre reprend les restitutions confirmées précédentes. */
    @Transactional
    public void reconcile(String refundRef) {
        var incoming=payments.findByTransactionRef(refundRef).orElseThrow();
        require(supports(incoming.getSourceType()) && incoming.getMetadata()!=null,"Restitution commerciale absente");
        String ref=Objects.toString(incoming.getMetadata().get("originalTransactionRef"),"");
        var original=payments.lockByReference(incoming.getOrganizationId(),ref).orElseThrow();em.refresh(original);requireOriginal(incoming.getOrganizationId(),original);
        validateOrder(original);var history=BaitlyRefundSeries.history(original,related(original));BigDecimal before=BigDecimal.ZERO;
        for(var refund:history) {
            if(refund.getStatus()!=TransactionStatus.COMPLETED)break;
            require(refund.getProviderTxId()!=null && refund.getProviderTxId().startsWith("re_"),"Preuve de restitution manquante");
            BigDecimal after=before.add(refund.getAmount());
            if(!Boolean.TRUE.equals(refund.getMetadata().get("commerceApplied"))) {
                if("UPSELL".equals(original.getSourceType())) reverseUpsell(original,refund,before,after);
                var metadata=new HashMap<>(refund.getMetadata());metadata.put("commerceApplied",true);refund.setMetadata(metadata);
            }
            before=after;
        }
        credits.sync(original);
        em.flush();
        if("UPSELL".equals(original.getSourceType()))payouts.prepareRecoveries(original.getOrganizationId(),"UPSELL",original.getSourceId());
    }
    public static List<PaymentTransaction> forReceipt(PaymentTransaction original,List<PaymentTransaction> rows) {
        return rows.stream().filter(p->p.getPaymentType()!=TransactionType.REFUND || (p.getMetadata()!=null && original.getTransactionRef().equals(p.getMetadata().get("originalTransactionRef")))).toList();
    }
    private List<PaymentTransaction> related(PaymentTransaction original) {
        var rows=payments.findByOrganizationIdAndSourceTypeAndSourceId(original.getOrganizationId(),original.getSourceType(),original.getSourceId());rows.forEach(em::refresh);return forReceipt(original,rows);
    }
    private void requireOriginal(Long org,PaymentTransaction p) {
        require(Objects.equals(org,p.getOrganizationId()) && supports(p.getSourceType()) && p.getSourceId()!=null
                && p.getPaymentType()==TransactionType.CHECKOUT && p.getStatus()==TransactionStatus.COMPLETED
                && p.getProviderType()==PaymentProviderType.STRIPE && p.getProviderTxId()!=null && p.getProviderTxId().startsWith("cs_")
                && p.getAmount()!=null && p.getAmount().signum()>0 && !p.hasDisputeRisk(),"Encaissement absent, contesté ou à rapprocher");
    }
    private void validateOrder(PaymentTransaction p) {
        if("UPSELL".equals(p.getSourceType())) {
            var order=em.find(UpsellOrder.class,p.getSourceId(),LockModeType.PESSIMISTIC_WRITE);require(order!=null,"Commande absente");em.refresh(order);
            require(p.getOrganizationId().equals(order.getOrganizationId()) && p.getAmount().compareTo(order.getAmount())==0 && p.getCurrency().equals(order.getCurrency())
                    && p.getProviderTxId().equals(order.getStripeSessionId()) && Set.of(UpsellOrderStatus.PAID,UpsellOrderStatus.REFUNDED).contains(order.getStatus())
                    && order.getBeneficiaryOwnerId()!=null && order.getHostAmount()!=null && order.getConciergeAmount()!=null && order.getPlatformFeeAmount()!=null
                    && order.getHostAmount().add(order.getConciergeAmount()).add(order.getPlatformFeeAmount()).compareTo(p.getAmount())==0,"Vente ou répartition à rapprocher");
        } else if("HARDWARE_ORDER".equals(p.getSourceType())) {
            var order=em.find(HardwareOrder.class,p.getSourceId(),LockModeType.PESSIMISTIC_WRITE);require(order!=null,"Commande absente");em.refresh(order);
            require(p.getOrganizationId().equals(order.getOrganizationId()) && p.getAmount().compareTo(BigDecimal.valueOf(order.getTotalAmount(),2))==0
                    && p.getCurrency().equalsIgnoreCase(order.getCurrency()) && p.getProviderTxId().equals(order.getStripeSessionId())
                    && Set.of(OrderStatus.PAID,OrderStatus.SHIPPED,OrderStatus.DELIVERED).contains(order.getStatus()),"Commande de matériel à rapprocher");
        } else AiCreditPurchaseService.purchasedMillicredits(p);
    }
    private void reverseUpsell(PaymentTransaction original,PaymentTransaction refund,BigDecimal before,BigDecimal after) {
        var order=em.find(UpsellOrder.class,original.getSourceId());var platform=wallets.getOrCreatePlatformWallet(original.getOrganizationId(),original.getCurrency());
        reversePart(order,refund,platform,WalletType.OWNER,order.getBeneficiaryOwnerId(),order.getHostAmount(),before,after);
        reversePart(order,refund,platform,WalletType.CONCIERGE,null,order.getConciergeAmount(),before,after);
        if(after.compareTo(original.getAmount())==0)order.setStatus(UpsellOrderStatus.REFUNDED);
    }
    private void reversePart(UpsellOrder order,PaymentTransaction refund,Wallet platform,WalletType type,Long beneficiary,BigDecimal share,BigDecimal before,BigDecimal after) {
        require(share.signum()>=0,"Part négative");if(share.signum()==0)return;
        var target=wallets.getOrCreateWallet(order.getOrganizationId(),type,beneficiary,order.getCurrency());
        var original=ledger.getEntriesByReference(LedgerReferenceType.UPSELL,"UPSELL-"+order.getId()).stream()
                .filter(e->e.getWalletId().equals(target.getId()) && e.getEntryType()==LedgerEntryType.CREDIT && order.getOrganizationId().equals(e.getOrganizationId()) && order.getCurrency().equals(e.getCurrency())).toList();
        require(original.size()==1 && original.getFirst().getAmount().compareTo(share)==0,"Attribution historique à rapprocher");
        var delta=BaitlyRefundSeries.delta(share,before,after,order.getAmount());
        if(delta.signum()>0)ledger.recordTransfer(target,platform,delta,LedgerReferenceType.REFUND,refund.getTransactionRef(),"Restitution de la part "+type+" de la vente "+order.getId());
    }
}
