package com.clenzy.service.payout;

import com.clenzy.model.*;
import com.clenzy.service.*;
import jakarta.persistence.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.*;
import static com.clenzy.service.BaitlyRefundSeries.require;

@Service @Transactional
public class BaitlyCommerceRecoveryStore {
    private final EntityManager em;private final BaitlyCommercePayoutStore payouts;private final LedgerService ledger;private final WalletService wallets;
    public BaitlyCommerceRecoveryStore(EntityManager em,BaitlyCommercePayoutStore payouts,LedgerService ledger,WalletService wallets){this.em=em;this.payouts=payouts;this.ledger=ledger;this.wallets=wallets;}
    public record Candidate(Long org,Long id) {}
    @Transactional(readOnly=true) public List<Candidate> candidates(){return em.createQuery("from BaitlyCommerceRecovery where state<>'RECOVERED' and nextAttemptAt<=:now order by nextAttemptAt,id",BaitlyCommerceRecovery.class).setParameter("now",Instant.now()).setMaxResults(20).getResultList().stream().map(r->new Candidate(r.getOrganizationId(),r.getId())).toList();}
    public Optional<BaitlyTransferRecoveryStore.Instruction> claim(Long org,Long id) {
        var row=lock(org,id);if(row.getState().equals("RECOVERED") || row.getNextAttemptAt().isAfter(Instant.now()))return Optional.empty();
        var transfer=em.find(PayoutTransfer.class,row.getTransferId());var p=em.find(BaitlyCommercePayout.class,row.getPayoutId());
        require(transfer!=null && p!=null && p.getOrganizationId().equals(org) && BaitlyCommercePayoutStore.instruction(p).matches(transfer)
                && transfer.getState()==PayoutTransfer.State.TRANSFERRED && transfer.getDestinationPayment()!=null && transfer.getStripeLivemode()!=null,"Transfert commercial à rapprocher");
        var earlier=em.createQuery("from BaitlyCommerceRecovery where transferId=:transfer and id<:id order by id",BaitlyCommerceRecovery.class).setParameter("transfer",row.getTransferId()).setParameter("id",id).getResultList();
        require(earlier.stream().allMatch(r->r.getState().equals("RECOVERED")),"Récupération précédente à confirmer");
        row.claim();return Optional.of(instruction(row,transfer,earlier));
    }
    public void confirm(Long org,Long id,String reference) {
        require(reference!=null && reference.startsWith("trr_"),"Preuve de récupération absente");var row=lock(org,id);if(row.getState().equals("RECOVERED")){require(reference.equals(row.getReference()),"Autre preuve");return;}
        var p=em.find(BaitlyCommercePayout.class,row.getPayoutId());require(p!=null && p.getOrganizationId().equals(org),"Versement inaccessible");
        // La preuve concerne une dette figée. Une correction ultérieure ne la réécrit pas.
        var target=wallets.getOrCreateWallet(org,p.getParty().equals("OWNER")?WalletType.OWNER:WalletType.CONCIERGE,p.getBeneficiaryUserId(),p.getCurrency());em.refresh(target,LockModeType.PESSIMISTIC_WRITE);
        String ref="COMMERCE-RECOVERY-"+row.getId();require(!ledger.hasEntriesForReference(LedgerReferenceType.ADJUSTMENT,ref),"Écriture de récupération à rapprocher");
        ledger.recordTransfer(wallets.getOrCreatePlatformWallet(org,p.getCurrency()),target,row.getAmount(),LedgerReferenceType.ADJUSTMENT,ref,"Récupération commerciale confirmée "+reference);row.confirm(reference);
    }
    public void review(Long org,Long id,String failure){var row=lock(org,id);if(!row.getState().equals("RECOVERED"))row.review(failure);}
    private BaitlyCommerceRecovery lock(Long org,Long id){em.flush();var row=em.find(BaitlyCommerceRecovery.class,id,LockModeType.PESSIMISTIC_WRITE);require(row!=null && row.getOrganizationId().equals(org),"Récupération inaccessible");em.refresh(row);return row;}
    private BaitlyTransferRecoveryStore.Instruction instruction(BaitlyCommerceRecovery row,PayoutTransfer t,List<BaitlyCommerceRecovery> earlier) {
        var previous=earlier.stream().map(r->new BaitlyTransferRecoveryStore.PreviousRecovery(r.getReference(),r.getAmount(),metadata(r))).toList();
        return new BaitlyTransferRecoveryStore.Instruction(row.getId(),row.getOrganizationId(),t.getId(),t.getExternalReference(),t.getDestination(),t.getDestinationPayment(),t.getStripeLivemode(),t.getAmount(),row.getAmount(),t.getCurrency(),row.getCause(),row.getFirstAttemptAt(),previous,true);
    }
    private Map<String,String> metadata(BaitlyCommerceRecovery r){return Map.of("baitly_recovery_id",r.getId().toString(),"baitly_organization_id",r.getOrganizationId().toString(),"baitly_transfer_id",r.getTransferId().toString(),"baitly_refund_ref",r.getCause(),"baitly_recovery_kind","COMMERCE");}
}
