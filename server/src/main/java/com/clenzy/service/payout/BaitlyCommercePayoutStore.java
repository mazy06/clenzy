package com.clenzy.service.payout;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.service.*;
import jakarta.persistence.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.util.*;
import static com.clenzy.service.BaitlyRefundSeries.require;

/** Les droits commerciaux restent distincts de l'émission PSP et de l'arrivée bancaire. */
@Service @Transactional
public class BaitlyCommercePayoutStore {
    private final EntityManager em;
    private final WalletService wallets;
    private final LedgerService ledger;
    private final PaymentConnectionRepository connections;
    public BaitlyCommercePayoutStore(EntityManager em,WalletService wallets,LedgerService ledger,PaymentConnectionRepository connections) {
        this.em=em;this.wallets=wallets;this.ledger=ledger;this.connections=connections;
    }
    record Basis(String source,Long sourceId,Long org,Long owner,String currency,BigDecimal ownerAmount,BigDecimal conciergeAmount,String cause) {
        BigDecimal entitlement(String party){return "OWNER".equals(party)?ownerAmount:conciergeAmount;}
    }
    public record TransferView(Long id,UUID requestId,String party,BigDecimal amount,String state,String reference,Long journalId) {}
    public record RecoveryView(Long id,BigDecimal amount,String state,String reference,String failure) {}
    public record View(String currency,BigDecimal ownerAvailable,BigDecimal conciergeAvailable,List<TransferView> transfers,List<RecoveryView> recoveries) {}

    public View view(Long org,String source,Long id) {
        var basis=basis(org,source,id);var rows=payouts(basis);var recoveries=recoveries(rows);
        return new View(basis.currency(),available(basis,"OWNER",rows,recoveries,null).max(BigDecimal.ZERO),available(basis,"CONCIERGE",rows,recoveries,null).max(BigDecimal.ZERO),
                rows.stream().map(p->{var t=transfer(p);return new TransferView(p.getId(),p.getRequestId(),p.getParty(),p.getAmount(),p.isCancelled()?"CANCELLED":t==null?"PREPARED":t.getState().name(),t==null?null:t.getExternalReference(),t==null?null:t.getId());}).toList(),
                recoveries.stream().map(r->new RecoveryView(r.getId(),r.getAmount(),r.getState(),r.getReference(),r.getFailure())).toList());
    }
    public PayoutTransferInstruction prepareAccepted(Long org,String source,Long id,String party,UUID request,String actor,BigDecimal accepted,String currency) {
        require(accepted!=null && currency!=null,"Montant présenté et devise requis");
        var instruction=prepare(org,source,id,party,request,actor);
        require(instruction.amount().compareTo(accepted)==0 && instruction.currency().equals(currency),"Le montant a changé : relisez le solde avant confirmation");
        return instruction;
    }
    public PayoutTransferInstruction prepare(Long org,String source,Long id,String party,UUID request,String actor) {
        require(request!=null && actor!=null && !actor.isBlank() && Set.of("OWNER","CONCIERGE").contains(Objects.toString(party,"")),"Bénéficiaire et demande requis");
        var basis=basis(org,source,id);var rows=payouts(basis);
        var previous=em.createQuery("from BaitlyCommercePayout where organizationId=:org and requestId=:request",BaitlyCommercePayout.class).setParameter("org",org).setParameter("request",request).getResultList();
        if(!previous.isEmpty()) {
            var p=previous.getFirst();require(p.getSource().equals(source) && p.getSourceId().equals(id) && p.getParty().equals(party),"Cette demande désigne un autre versement");require(!p.isCancelled(),"Cette préparation a été annulée");return instruction(p);
        }
        var recoveries=recoveries(rows);
        require(recoveries.stream().allMatch(r->r.getState().equals("RECOVERED")),"Récupération du bénéficiaire à confirmer avant un nouveau versement");
        require(rows.stream().filter(p->!p.isCancelled()).allMatch(p->{var t=transfer(p);return t!=null && t.getState()==PayoutTransfer.State.TRANSFERRED;}),"Versement antérieur à terminer ou rapprocher");
        BigDecimal amount=available(basis,party,rows,recoveries,null);require(amount.signum()>0,"Aucun solde disponible pour ce bénéficiaire");
        var target=target(basis,party);em.refresh(target,LockModeType.PESSIMISTIC_WRITE);
        require(ledger.calculateBalance(target.getId()).compareTo(amount)>=0,"Solde du bénéficiaire insuffisant ou dette à régulariser");
        String destination=destination(basis,party);
        require(basis.currency().equals("EUR"),"Devise non prise en charge par le PSP configuré");
        var payout=new BaitlyCommercePayout(org,source,id,party,party.equals("OWNER")?basis.owner():null,party.equals("CONCIERGE")?org:null,
                request,amount,basis.currency(),destination,actor);em.persist(payout);em.flush();return instruction(payout);
    }
    private String destination(Basis basis,String party) {
        if(party.equals("OWNER")) {
            var account=connections.findCommerceOwnerAccount(basis.org(),basis.source(),basis.sourceId(),basis.owner())
                .orElseThrow(()->new IllegalStateException("Le bénéficiaire doit connecter son compte de versement"));
            require(account.getReady(),"Compte de versement incomplet ou suspendu");return account.getAccountId();
        }
        var account=connections.findByOrganizationIdAndBeneficiaryKey(basis.org(),"organization")
            .orElseThrow(()->new IllegalStateException("La conciergerie doit connecter son compte de versement"));
        require(account.isReady() && "FR".equals(account.getCountry()) && "STRIPE".equals(account.getProvider())
            && account.getUserId()==null,"Compte de versement incomplet ou suspendu");return account.getProviderAccountId();
    }
    /** Même verrou que remboursement/correction ; dernière décision atomique juste avant l'émission. */
    public void requireInstruction(PayoutTransferInstruction instruction) {
        var p=em.find(BaitlyCommercePayout.class,instruction.sourceId());require(p!=null && p.getOrganizationId().equals(instruction.organizationId()),"Versement inaccessible");
        var basis=basis(p.getOrganizationId(),p.getSource(),p.getSourceId());var rows=payouts(basis);var recoveries=recoveries(rows);
        require(!p.isCancelled() && instruction(p).equals(instruction) && available(basis,p.getParty(),rows,recoveries,p.getId()).compareTo(p.getAmount())>=0
                && recoveries.stream().allMatch(r->r.getState().equals("RECOVERED")),"Le financement du versement a changé");
        require(p.getDestination().equals(destination(basis,p.getParty())),"Compte de versement modifié ou suspendu");
        var wallet=target(basis,p.getParty());em.refresh(wallet,LockModeType.PESSIMISTIC_WRITE);
        var otherReservations=em.createQuery("from BaitlyCommercePayout where organizationId=:org and party=:party and currency=:currency and id<>:id",BaitlyCommercePayout.class)
                .setParameter("org",p.getOrganizationId()).setParameter("party",p.getParty()).setParameter("currency",p.getCurrency()).setParameter("id",p.getId()).getResultList().stream()
                .filter(other->!other.isCancelled() && Objects.equals(other.getBeneficiaryUserId(),p.getBeneficiaryUserId()) && Objects.equals(other.getBeneficiaryOrganizationId(),p.getBeneficiaryOrganizationId()))
                .filter(other->{var t=transfer(other);return t!=null && t.getState()!=PayoutTransfer.State.TRANSFERRED;}).map(BaitlyCommercePayout::getAmount).reduce(BigDecimal.ZERO,BigDecimal::add);
        require(ledger.calculateBalance(wallet.getId()).subtract(otherReservations).compareTo(p.getAmount())>=0,"Solde bénéficiaire à rapprocher");
    }
    /** Une préparation n'est libérable que si aucune intention d'émission PSP n'a été journalisée. */
    public void cancel(Long org,Long id,String actor) {
        var p=em.find(BaitlyCommercePayout.class,id);
        require(p!=null && org.equals(p.getOrganizationId()) && actor!=null && !actor.isBlank(),"Versement inaccessible");
        basis(org,p.getSource(),p.getSourceId()); // Même verrou que requireInstruction et les corrections.
        em.refresh(p,LockModeType.PESSIMISTIC_WRITE);
        require(transfer(p)==null,"Une émission existe : rapprochez-la avant toute autre décision");
        p.cancel(actor);
    }
    public void settle(PayoutTransfer transfer) {
        if(transfer.getSource()!=PayoutTransfer.Source.COMMERCE)return;
        var p=em.find(BaitlyCommercePayout.class,transfer.getSourceId());require(p!=null && instruction(p).matches(transfer) && transfer.getState()==PayoutTransfer.State.TRANSFERRED,"Preuve commerciale incompatible");
        var basis=basis(p.getOrganizationId(),p.getSource(),p.getSourceId());var target=target(basis,p.getParty());em.refresh(target,LockModeType.PESSIMISTIC_WRITE);
        String ref="COMMERCE-PAYOUT-"+p.getId();
        if(!ledger.hasEntriesForReference(LedgerReferenceType.PAYOUT,ref))ledger.recordTransfer(target,wallets.getOrCreatePlatformWallet(p.getOrganizationId(),p.getCurrency()),p.getAmount(),LedgerReferenceType.PAYOUT,ref,"Transfert commercial confirmé "+transfer.getExternalReference());
        // Un remboursement peut avoir été rapproché pendant que ce transfert était incertain.
        // Sa confirmation tardive doit aussi réserver la récupération du trop-versé.
        em.flush();
        prepareRecoveries(p.getOrganizationId(),p.getSource(),p.getSourceId());
    }

    /** Réserve la dette réellement excédentaire, sans modifier une preuve de versement passée. */
    public void prepareRecoveries(Long org,String source,Long id) {
        var basis=basis(org,source,id);var rows=payouts(basis);var recoveries=recoveries(rows);
        for(String party:List.of("OWNER","CONCIERGE")) {
            BigDecimal paid=rows.stream().filter(p->p.getParty().equals(party) && transfer(p)!=null && transfer(p).getState()==PayoutTransfer.State.TRANSFERRED).map(BaitlyCommercePayout::getAmount).reduce(BigDecimal.ZERO,BigDecimal::add);
            BigDecimal reserved=recoveries.stream().filter(r->rows.stream().anyMatch(p->p.getId().equals(r.getPayoutId()) && p.getParty().equals(party))).map(BaitlyCommerceRecovery::getAmount).reduce(BigDecimal.ZERO,BigDecimal::add);
            BigDecimal surplus=paid.subtract(reserved).subtract(basis.entitlement(party));
            for(var p:rows.reversed()) {
                if(surplus.signum()<=0)break;if(!p.getParty().equals(party))continue;var t=transfer(p);if(t==null || t.getState()!=PayoutTransfer.State.TRANSFERRED)continue;
                require(t.getStripeLivemode()!=null && t.getDestinationPayment()!=null && t.getExternalReference()!=null,"Preuve de transfert incomplète avant récupération");
                BigDecimal prior=recoveries.stream().filter(r->r.getPayoutId().equals(p.getId())).map(BaitlyCommerceRecovery::getAmount).reduce(BigDecimal.ZERO,BigDecimal::add);
                BigDecimal amount=p.getAmount().subtract(prior).min(surplus);
                if(amount.signum()>0){em.persist(new BaitlyCommerceRecovery(org,p.getId(),t.getId(),amount,basis.cause()));surplus=surplus.subtract(amount);}
            }
        }
    }
    Basis basis(Long org,String source,Long id) {
        require(org!=null && id!=null && ("UPSELL".equals(source)||"AFFILIATE".equals(source)),"Source inaccessible");
        if(source.equals("UPSELL")) {
            var payments=em.createQuery("from PaymentTransaction where organizationId=:org and sourceType='UPSELL' and sourceId=:id and paymentType=com.clenzy.model.TransactionType.CHECKOUT",PaymentTransaction.class).setParameter("org",org).setParameter("id",id).setLockMode(LockModeType.PESSIMISTIC_WRITE).getResultList();
            require(payments.size()==1,"Encaissement unique à rapprocher");var receipt=payments.getFirst();em.refresh(receipt);
            var order=em.find(UpsellOrder.class,id,LockModeType.PESSIMISTIC_WRITE);require(order!=null && org.equals(order.getOrganizationId()),"Vente inaccessible");em.refresh(order);
            require(receipt.getStatus()==TransactionStatus.COMPLETED && receipt.getProviderType()==PaymentProviderType.STRIPE && !receipt.hasDisputeRisk()
                    && Objects.equals(receipt.getProviderTxId(),order.getStripeSessionId()) && receipt.getProviderTxId()!=null && receipt.getProviderTxId().startsWith("cs_")
                    && receipt.getAmount().compareTo(order.getAmount())==0 && receipt.getCurrency().equals(order.getCurrency())
                    && Set.of(UpsellOrderStatus.PAID,UpsellOrderStatus.REFUNDED).contains(order.getStatus()) && order.getBeneficiaryOwnerId()!=null
                    && order.getHostAmount()!=null && order.getConciergeAmount()!=null && order.getPlatformFeeAmount()!=null
                    && order.getHostAmount().add(order.getConciergeAmount()).add(order.getPlatformFeeAmount()).compareTo(order.getAmount())==0,"Financement commercial à rapprocher");
            var all=em.createQuery("from PaymentTransaction where organizationId=:org and sourceType='UPSELL' and sourceId=:id",PaymentTransaction.class).setParameter("org",org).setParameter("id",id).getResultList();
            var refunds=BaitlyRefundSeries.history(receipt,all);require(refunds.stream().allMatch(r->r.getStatus()==TransactionStatus.COMPLETED && Boolean.TRUE.equals(r.getMetadata().get("commerceApplied"))),"Remboursement à terminer avant versement");
            BigDecimal refunded=refunds.stream().map(PaymentTransaction::getAmount).reduce(BigDecimal.ZERO,BigDecimal::add);
            var result=new Basis(source,id,org,order.getBeneficiaryOwnerId(),order.getCurrency(),net(order.getHostAmount(),refunded,order.getAmount()),net(order.getConciergeAmount(),refunded,order.getAmount()),refunds.isEmpty()?"SALE-"+id:refunds.getLast().getTransactionRef());
            validateCredit(result,"OWNER",order.getHostAmount(),LedgerReferenceType.UPSELL,"UPSELL-"+id);
            validateCredit(result,"CONCIERGE",order.getConciergeAmount(),LedgerReferenceType.UPSELL,"UPSELL-"+id);return result;
        }
        var commission=em.find(ActivityCommission.class,id,LockModeType.PESSIMISTIC_WRITE);require(commission!=null && org.equals(commission.getOrganizationId()),"Commission inaccessible");em.refresh(commission);
        require((commission.getStatus()==ActivityCommissionStatus.RECEIVED || commission.getStatus()==ActivityCommissionStatus.CANCELLED) && commission.getReceiptReference()!=null
                && commission.getBeneficiaryOwnerId()!=null && commission.getHostShare()!=null,"Réception de commission à rapprocher");
        var adjustments=em.createQuery("from BaitlyAffiliateAdjustment where organizationId=:org and commissionId=:id order by id",BaitlyAffiliateAdjustment.class).setParameter("org",org).setParameter("id",id).getResultList();
        var result=new Basis(source,id,org,commission.getBeneficiaryOwnerId(),commission.getCurrency(),commission.getHostShare(),BigDecimal.ZERO,adjustments.isEmpty()?"AFFILIATE-"+id:"AFFILIATE-ADJUST-"+adjustments.getLast().getId());
        var wallet=target(result,"OWNER");BigDecimal proven=ledgerNet(wallet,LedgerReferenceType.COMMISSION,"ACTIVITY-"+id);
        for(var change:adjustments)proven=proven.add(ledgerNet(wallet,LedgerReferenceType.ADJUSTMENT,"AFFILIATE-ADJUST-"+change.getId()));
        require(proven.compareTo(commission.getHostShare())==0,"Attribution de commission à rapprocher");return result;
    }
    private void validateCredit(Basis basis,String party,BigDecimal amount,LedgerReferenceType type,String ref){require(amount.signum()>=0 && ledgerNet(target(basis,party),type,ref).compareTo(amount)==0,"Attribution commerciale incomplète");}
    private BigDecimal ledgerNet(Wallet wallet,LedgerReferenceType type,String ref){return ledger.getEntriesByReference(type,ref).stream().filter(e->wallet.getId().equals(e.getWalletId()) && wallet.getOrganizationId().equals(e.getOrganizationId()) && wallet.getCurrency().equals(e.getCurrency())).map(e->e.getEntryType()==LedgerEntryType.CREDIT?e.getAmount():e.getAmount().negate()).reduce(BigDecimal.ZERO,BigDecimal::add);}
    private BigDecimal net(BigDecimal share,BigDecimal refunded,BigDecimal gross){return share.subtract(BaitlyRefundSeries.delta(share,BigDecimal.ZERO,refunded,gross));}
    Wallet target(Basis b,String party){return wallets.getOrCreateWallet(b.org(),party.equals("OWNER")?WalletType.OWNER:WalletType.CONCIERGE,party.equals("OWNER")?b.owner():null,b.currency());}
    List<BaitlyCommercePayout> payouts(Basis b){return em.createQuery("from BaitlyCommercePayout where organizationId=:org and source=:source and sourceId=:id order by id",BaitlyCommercePayout.class).setParameter("org",b.org()).setParameter("source",b.source()).setParameter("id",b.sourceId()).getResultList();}
    private List<BaitlyCommerceRecovery> recoveries(List<BaitlyCommercePayout> rows){if(rows.isEmpty())return List.of();return em.createQuery("from BaitlyCommerceRecovery where payoutId in :ids order by id",BaitlyCommerceRecovery.class).setParameter("ids",rows.stream().map(BaitlyCommercePayout::getId).toList()).getResultList();}
    PayoutTransfer transfer(BaitlyCommercePayout p){return em.createQuery("from PayoutTransfer where organizationId=:org and source=:source and sourceId=:id",PayoutTransfer.class).setParameter("org",p.getOrganizationId()).setParameter("source",PayoutTransfer.Source.COMMERCE).setParameter("id",p.getId()).getResultStream().findFirst().orElse(null);}
    private BigDecimal available(Basis basis,String party,List<BaitlyCommercePayout> rows,List<BaitlyCommerceRecovery> recovered,Long exclude) {
        BigDecimal planned=rows.stream().filter(p->!p.isCancelled() && p.getParty().equals(party) && !Objects.equals(exclude,p.getId())).map(BaitlyCommercePayout::getAmount).reduce(BigDecimal.ZERO,BigDecimal::add);
        BigDecimal back=recovered.stream().filter(r->r.getState().equals("RECOVERED") && rows.stream().anyMatch(p->p.getId().equals(r.getPayoutId()) && p.getParty().equals(party))).map(BaitlyCommerceRecovery::getAmount).reduce(BigDecimal.ZERO,BigDecimal::add);
        return basis.entitlement(party).subtract(planned).add(back);
    }
    static PayoutTransferInstruction instruction(BaitlyCommercePayout p){return new PayoutTransferInstruction(p.getOrganizationId(),PayoutTransfer.Source.COMMERCE,p.getId(),p.getBeneficiaryUserId(),p.getBeneficiaryOrganizationId(),p.getAmount(),p.getCurrency(),p.getDestination(),"Versement "+p.getSource()+" #"+p.getSourceId()+" · "+p.getParty());}
}
