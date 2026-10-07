package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.ActivityCommissionRepository;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.*;
import java.util.*;

/** Le montant corrigé est explicite ; le taux historique et le bénéficiaire ne changent jamais. */
@Service
public class BaitlyAffiliateAdjustments {
    private final ActivityCommissionRepository commissions;
    private final EntityManager em;
    private final WalletService wallets;
    private final LedgerService ledger;
    private final com.clenzy.service.payout.BaitlyCommercePayoutStore payouts;
    public BaitlyAffiliateAdjustments(ActivityCommissionRepository commissions,EntityManager em,WalletService wallets,LedgerService ledger,com.clenzy.service.payout.BaitlyCommercePayoutStore payouts){this.commissions=commissions;this.em=em;this.wallets=wallets;this.ledger=ledger;this.payouts=payouts;}
    @Transactional(readOnly=true)
    public List<BaitlyAffiliateAdjustment> history(Long org,Long id) {
        require(commissions.findById(id).filter(c->org.equals(c.getOrganizationId())).isPresent(),"Commission inaccessible");
        return rows(org,id);
    }
    @Transactional
    public BaitlyAffiliateAdjustment correct(Long org,Long id,UUID request,BigDecimal expected,BigDecimal after,String currency,String proof,String reason,String actor) {
        require(request!=null && expected!=null && after!=null && after.signum()>=0 && after.scale()<=2 && after.precision()<=12
                && proof!=null && !proof.isBlank() && proof.length()<=255 && reason!=null && !reason.isBlank() && reason.length()<=1000
                && actor!=null && !actor.isBlank(),"Montant, motif, justificatif et auteur requis");
        var row=commissions.lockByIdAndOrganizationId(id,org).orElseThrow(()->new IllegalArgumentException("Commission inaccessible"));em.refresh(row);
        var history=rows(org,id);var existing=history.stream().filter(a->a.getRequestId().equals(request)).findFirst();
        if(existing.isPresent()) {
            var previous=existing.get();require(previous.getBeforeGross().compareTo(expected)==0 && previous.getAfterGross().compareTo(after)==0
                    && previous.getCurrency().equalsIgnoreCase(currency) && previous.getProof().equals(proof.trim()) && previous.getReason().equals(reason.trim()),"Une autre correction utilise cet identifiant");return previous;
        }
        require(row.getGrossCommission().compareTo(expected)==0 && row.getCurrency().equalsIgnoreCase(currency),"La commission a changé : actualisez le détail");
        require(Set.of(ActivityCommissionStatus.PENDING,ActivityCommissionStatus.CONFIRMED,ActivityCommissionStatus.RECEIVED).contains(row.getStatus()),"Historique incomplet ou commission annulée : rapprochement requis");
        require(after.compareTo(expected)!=0,"Le montant est inchangé");
        BigDecimal basis=history.isEmpty()?row.getGrossCommission():history.getFirst().getBasisGross();
        BigDecimal hostBasis=history.isEmpty()?row.getHostShare():history.getFirst().getBasisHost();
        require(basis.signum()>0 && hostBasis!=null && hostBasis.signum()>=0 && hostBasis.compareTo(basis)<=0,"Répartition historique absente");
        BigDecimal host=after.multiply(hostBasis).divide(basis,2,RoundingMode.HALF_UP);
        if(row.getStatus()==ActivityCommissionStatus.RECEIVED) validateAllocation(row,history,hostBasis);
        var correction=new BaitlyAffiliateAdjustment(row,request,basis,hostBasis,after,host,proof.trim(),reason.trim(),actor);em.persist(correction);em.flush();
        if(row.getStatus()==ActivityCommissionStatus.RECEIVED) {
            require(row.getBeneficiaryOwnerId()!=null && row.getReceiptReference()!=null,"Réception ou bénéficiaire non prouvé");
            var difference=host.subtract(row.getHostShare());
            if(difference.signum()!=0) {
                var platform=wallets.getOrCreatePlatformWallet(org,row.getCurrency());
                var owner=wallets.getOrCreateWallet(org,WalletType.OWNER,row.getBeneficiaryOwnerId(),row.getCurrency());
                ledger.recordTransfer(difference.signum()>0?platform:owner,difference.signum()>0?owner:platform,difference.abs(),LedgerReferenceType.ADJUSTMENT,
                        "AFFILIATE-ADJUST-"+correction.getId(),"Correction justifiée de la commission "+row.getProvider()+" "+row.getExternalBookingId());
            }
        }
        row.setGrossCommission(after);row.setHostShare(host);row.setPlatformShare(after.subtract(host));
        if(after.signum()==0)row.setStatus(ActivityCommissionStatus.CANCELLED);
        commissions.saveAndFlush(row);
        if(row.getReceiptReference()!=null)payouts.prepareRecoveries(org,"AFFILIATE",id);
        return correction;
    }
    private List<BaitlyAffiliateAdjustment> rows(Long org,Long id) {return em.createQuery("from BaitlyAffiliateAdjustment where organizationId=:org and commissionId=:id order by id",BaitlyAffiliateAdjustment.class).setParameter("org",org).setParameter("id",id).getResultList();}
    private void validateAllocation(ActivityCommission row,List<BaitlyAffiliateAdjustment> history,BigDecimal basis) {
        require(row.getBeneficiaryOwnerId()!=null && row.getReceiptReference()!=null,"Réception ou bénéficiaire non prouvé");
        var owner=wallets.getOrCreateWallet(row.getOrganizationId(),WalletType.OWNER,row.getBeneficiaryOwnerId(),row.getCurrency());
        var initial=ledger.getEntriesByReference(LedgerReferenceType.COMMISSION,"ACTIVITY-"+row.getId());
        // Une correction faite avant réception est déjà comprise dans la première attribution.
        BigDecimal net=BigDecimal.ZERO;
        for(var entry:initial) if(owner.getId().equals(entry.getWalletId())) {
            require(row.getOrganizationId().equals(entry.getOrganizationId()) && row.getCurrency().equals(entry.getCurrency()),"Attribution historique incompatible");
            net=net.add(entry.getEntryType()==LedgerEntryType.CREDIT?entry.getAmount():entry.getAmount().negate());
        }
        for(var change:history) for(var entry:ledger.getEntriesByReference(LedgerReferenceType.ADJUSTMENT,"AFFILIATE-ADJUST-"+change.getId()))
            if(owner.getId().equals(entry.getWalletId())) net=net.add(entry.getEntryType()==LedgerEntryType.CREDIT?entry.getAmount():entry.getAmount().negate());
        require(net.compareTo(row.getHostShare())==0 && (basis.signum()==0 || !initial.isEmpty()),"Attribution historique incomplète : rapprochement requis");
    }
    private static void require(boolean ok,String message){if(!ok)throw new IllegalArgumentException(message);}
}
