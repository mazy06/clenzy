package com.clenzy.service.payout;

import com.clenzy.model.*;
import com.clenzy.service.BaitlyRefundSeries;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

/** Décisions sous le verrou de mission partagé avec l'émission des transferts. Aucun réseau ici. */
@Service
public class BaitlyTransferRecoveryStore {
    private final EntityManager em;
    public BaitlyTransferRecoveryStore(EntityManager em) { this.em = em; }

    @Transactional(propagation = Propagation.MANDATORY)
    public void prepareOwnerRefund(PaymentTransaction refund) {
        var claims=em.createQuery("from OwnerPayoutReservation where organizationId=:org and reservationId=:stay",OwnerPayoutReservation.class)
                .setParameter("org",refund.getOrganizationId()).setParameter("stay",refund.getSourceId()).getResultList();
        if(claims.isEmpty()) return;
        require(claims.size()==1,"Plusieurs reversements pour ce séjour");
        var payout=em.find(OwnerPayout.class,claims.getFirst().getPayoutId());
        require(payout!=null && Objects.equals(payout.getOrganizationId(),refund.getOrganizationId()),"Reversement inaccessible");
        em.refresh(payout,LockModeType.PESSIMISTIC_WRITE);
        var transfers=em.createQuery("from PayoutTransfer where organizationId=:org and source=:source and sourceId=:payout",PayoutTransfer.class)
                .setParameter("org",refund.getOrganizationId()).setParameter("source",PayoutTransfer.Source.OWNER_PAYOUT)
                .setParameter("payout",claims.getFirst().getPayoutId()).getResultList();
        require(transfers.size()==1,"Transfert propriétaire à rapprocher"); var transfer=transfers.getFirst();
        em.refresh(transfer,LockModeType.PESSIMISTIC_WRITE);
        require(transfer.getState()==PayoutTransfer.State.TRANSFERRED && "STRIPE".equals(transfer.getProvider())
                && "EUR".equals(transfer.getCurrency()) && transfer.getStripeLivemode()!=null
                && transfer.getExternalReference()!=null && transfer.getExternalReference().startsWith("tr_")
                && transfer.getDestination()!=null && transfer.getDestination().startsWith("acct_") && transfer.getDestinationPayment()!=null,
                "Preuve Stripe du reversement propriétaire incomplète");
        var basis=BaitlyOwnerRefundBasis.requireBasis(em,refund,transfer);
        BigDecimal amount=BaitlyRefundSeries.delta(basis.net(),basis.before(),basis.before().add(refund.getAmount()),basis.gross());
        var existing=history(refund.getOrganizationId(),transfer.getId()); BigDecimal reserved=amount;
        BigDecimal previousForStay=BigDecimal.ZERO; BaitlyTransferRecovery same=null;
        for(var row:existing) {
            if(row.getRefundId().equals(refund.getId())) { same=row; continue; }
            require(row.getState()!=BaitlyTransferRecovery.State.CANCELLED,"Récupération historique à rapprocher");
            var prior=em.find(PaymentTransaction.class,row.getRefundId());
            require(prior!=null && prior.getStatus()==TransactionStatus.COMPLETED && com.clenzy.service.BaitlyRefundEvidence.confirmedStripe(prior)
                    && Objects.equals(prior.getOrganizationId(),refund.getOrganizationId()),"Remboursement antérieur à rapprocher");
            var priorBasis=BaitlyOwnerRefundBasis.requireBasis(em,prior,transfer);
            requireAllocation(row,prior,priorBasis.net(),priorBasis.before(),priorBasis.gross());
            if(prior.getSourceId().equals(refund.getSourceId())) previousForStay=previousForStay.add(prior.getAmount());
            reserved=reserved.add(row.getAmount());
        }
        require(previousForStay.compareTo(basis.before())==0 && reserved.compareTo(transfer.getAmount())<=0,
                "Historique de récupération du propriétaire incomplet");
        if(same==null) em.persist(new BaitlyTransferRecovery(transfer,refund,amount,basis.gross(),basis.net()));
        else requireAllocation(same,refund,basis.net(),basis.before(),basis.gross());
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void prepareFullInterventionRefund(PaymentTransaction refund, BigDecimal paidGross) {
        require(refund.getAmount().compareTo(paidGross)==0,"La récupération exige le remboursement entier de la prestation");
        prepareSeriesInterventionRefund(refund,paidGross);
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void prepareSeriesInterventionRefund(PaymentTransaction refund, BigDecimal paidGross) {
        require(refund.getId() != null && refund.getPaymentType() == TransactionType.REFUND
                && "INTERVENTION".equals(refund.getSourceType()) && refund.getAmount().signum()>0 && refund.getAmount().compareTo(paidGross) <= 0,
                "Le remboursement doit rester dans le solde encaissé");
        var mission = em.find(Intervention.class, refund.getSourceId());
        require(mission != null && Objects.equals(mission.getOrganizationId(), refund.getOrganizationId()), "Mission inaccessible");
        em.refresh(mission, LockModeType.PESSIMISTIC_WRITE);
        var transfers = em.createQuery("from PayoutTransfer where organizationId=:org and source=:source and sourceId=:mission", PayoutTransfer.class)
                .setParameter("org", refund.getOrganizationId()).setParameter("source", PayoutTransfer.Source.INTERVENTION)
                .setParameter("mission", refund.getSourceId()).getResultList();
        var records = em.createQuery("from HousekeeperPayoutRecord where organizationId=:org and interventionId=:mission", HousekeeperPayoutRecord.class)
                .setParameter("org", refund.getOrganizationId()).setParameter("mission", refund.getSourceId()).getResultList();
        if (transfers.isEmpty()) {
            require(records.stream().allMatch(r -> r.getStatus() == HousekeeperPayoutRecord.Status.BLOCKED && r.getStripeTransferId() == null),
                    "Une émission prestataire non rapprochée empêche ce remboursement");
            return;
        }
        require(transfers.size() == 1 && records.size() == 1, "Plusieurs preuves de reversement à rapprocher");
        var transfer = transfers.getFirst(); em.refresh(transfer, LockModeType.PESSIMISTIC_WRITE);
        var record = records.getFirst(); em.refresh(record, LockModeType.PESSIMISTIC_WRITE);
        require(transfer.getState() == PayoutTransfer.State.TRANSFERRED && "STRIPE".equals(transfer.getProvider())
                && refund.getProviderType() == PaymentProviderType.STRIPE && "EUR".equals(refund.getCurrency())
                && refund.getCurrency().equals(transfer.getCurrency()) && transfer.getStripeLivemode() != null
                && transfer.getExternalReference() != null && transfer.getExternalReference().startsWith("tr_")
                && transfer.getDestination() != null && transfer.getDestination().startsWith("acct_") && transfer.getDestinationPayment() != null
                && record.getStatus() == HousekeeperPayoutRecord.Status.SENT
                && Objects.equals(record.getStripeTransferId(), transfer.getExternalReference())
                && Objects.equals(record.getUserId(), transfer.getBeneficiaryUserId())
                && Objects.equals(record.getBeneficiaryOrganizationId(), transfer.getBeneficiaryOrganizationId())
                && record.getAmount().compareTo(transfer.getAmount()) == 0
                && record.getCommissionAmount() != null && record.getCommissionAmount().signum() >= 0,
                "Le transfert prestataire doit être rapproché avant remboursement");
        var existing = history(refund.getOrganizationId(), transfer.getId());
        var previous = existing.stream().filter(r -> !Objects.equals(r.getRefundId(), refund.getId())).toList();
        BigDecimal grossBasis = record.getAmount().add(record.getCommissionAmount());
        BigDecimal recovered = BigDecimal.ZERO, refunded = BigDecimal.ZERO;
        for (var row : previous) {
            var prior = requireConfirmedRecovery(row, refund.getOrganizationId(), refund.getSourceId());
            requireAllocation(row, prior, transfer.getAmount(), refunded, grossBasis);
            recovered = recovered.add(row.getAmount());
            refunded = refunded.add(prior.getAmount());
        }
        require(grossBasis.subtract(refunded).compareTo(paidGross) == 0,
                "Le solde après reversement doit être rapproché avant remboursement");
        // Base du versement déjà émis, jamais les tarifs actuels. Le cumul absorbe les centimes
        // et la commission finance le complément exact du remboursement client.
        BigDecimal amount = BaitlyRefundSeries.delta(transfer.getAmount(), refunded, refunded.add(refund.getAmount()), grossBasis);
        require(recovered.add(amount).compareTo(transfer.getAmount()) <= 0, "La récupération dépasse le transfert initial");
        var same = existing.stream().filter(r -> Objects.equals(r.getRefundId(), refund.getId())).toList();
        require(same.size() <= 1 && (same.isEmpty() || same.getFirst().getAmount().compareTo(amount) == 0),
                "Une récupération différente existe déjà pour ce remboursement");
        if (same.isEmpty()) em.persist(new BaitlyTransferRecovery(transfer, refund, amount, grossBasis));
        else requireAllocation(same.getFirst(), refund, transfer.getAmount(), refunded, grossBasis);
    }

    public record Candidate(Long id, Long org) {}
    public record PreviousRecovery(String reference, BigDecimal amount, Map<String,String> metadata) {
        public PreviousRecovery { metadata = Map.copyOf(metadata); }
    }
    public record Instruction(Long id, Long org, Long transferId, String transferReference, String destination,
            String destinationPayment, Boolean livemode, BigDecimal transferAmount, BigDecimal amount,
            String currency, String refundReference, Instant firstAttemptAt, List<PreviousRecovery> previous) {
        public Instruction { previous = List.copyOf(previous); }
        public Instruction(Long id, Long org, Long transferId, String transferReference, String destination,
                String destinationPayment, Boolean livemode, BigDecimal transferAmount, BigDecimal amount,
                String currency, String refundReference, Instant firstAttemptAt) {
            this(id,org,transferId,transferReference,destination,destinationPayment,livemode,transferAmount,amount,
                    currency,refundReference,firstAttemptAt,List.of());
        }
        public String key() { return "baitly-transfer-recovery-" + id; }
        public Map<String,String> metadata() {
            return Map.of("baitly_recovery_id", id.toString(), "baitly_organization_id", org.toString(),
                    "baitly_refund_ref", refundReference, "baitly_transfer_id", transferId.toString());
        }
    }
    @Transactional(readOnly = true)
    public List<Candidate> candidates() {
        return em.createQuery("select r from BaitlyTransferRecovery r, PaymentTransaction p where p.id=r.refundId "
                + "and p.organizationId=r.organizationId and r.state not in (:done,:noRecovery,:cancelled) and r.nextAttemptAt<=:now "
                + "and p.status in (:success,:failed,:aborted) order by r.nextAttemptAt,r.id", BaitlyTransferRecovery.class)
                .setParameter("done", BaitlyTransferRecovery.State.RECOVERED).setParameter("cancelled", BaitlyTransferRecovery.State.CANCELLED)
                .setParameter("noRecovery", BaitlyTransferRecovery.State.NO_RECOVERY_REQUIRED)
                .setParameter("now", Instant.now()).setParameter("success", TransactionStatus.COMPLETED)
                .setParameter("failed", TransactionStatus.FAILED).setParameter("aborted", TransactionStatus.CANCELLED)
                .setMaxResults(20).getResultList().stream().map(r -> new Candidate(r.getId(), r.getOrganizationId())).toList();
    }
    @Transactional
    public Optional<Instruction> claim(Long org, Long id) {
        var row = lock(org, id);
        if (row.isTerminal() || row.getNextAttemptAt().isAfter(Instant.now())) return Optional.empty();
        var refund = em.find(PaymentTransaction.class, row.getRefundId());
        require(refund != null && Objects.equals(refund.getOrganizationId(), org), "Remboursement inaccessible");
        if (refund.getStatus() == TransactionStatus.FAILED || refund.getStatus() == TransactionStatus.CANCELLED) {
            row.cancel(); return Optional.empty();
        }
        if (refund.getStatus() != TransactionStatus.COMPLETED) return Optional.empty();
        require(refund.getMetadata() == null || !Boolean.TRUE.equals(refund.getMetadata().get("reviewRequired")),
                "Le remboursement client doit être rapproché avant récupération");
        require(refund.getPaymentType() == TransactionType.REFUND && refund.getProviderType() == PaymentProviderType.STRIPE
                && com.clenzy.service.BaitlyRefundEvidence.confirmedStripe(refund)
                && row.getCurrency().equals(refund.getCurrency()) && refund.getAmount() != null
                && refund.getAmount().compareTo(row.getAmount().add(row.getCommissionRefundAmount())) == 0,
                "Remboursement Stripe non rapproché");
        var transfer = em.find(PayoutTransfer.class, row.getTransferId());
        boolean owner=transfer!=null && transfer.getSource()==PayoutTransfer.Source.OWNER_PAYOUT;
        require(transfer != null && Objects.equals(transfer.getOrganizationId(), org)
                && transfer.getState() == PayoutTransfer.State.TRANSFERRED
                && (owner || (transfer.getSource() == PayoutTransfer.Source.INTERVENTION
                    && "INTERVENTION".equals(refund.getSourceType()) && Objects.equals(transfer.getSourceId(),refund.getSourceId())))
                && Objects.equals(transfer.getCurrency(),row.getCurrency()), "Transfert non rapproché");
        var previous = new ArrayList<PreviousRecovery>();
        BigDecimal refunded = BigDecimal.ZERO;
        for (var prior : history(org, transfer.getId())) {
            if (prior.getId().equals(row.getId())) continue;
            // Les décisions suivantes ne changent pas la preuve d'une instruction déjà préparée.
            if(prior.getId()>row.getId()) {
                require(prior.getFirstAttemptAt()==null && prior.getReversalReference()==null,"Une récupération suivante a déjà été émise");
                continue;
            }
            var priorRefund = requireConfirmedRecovery(prior, org, owner?null:refund.getSourceId());
            if(owner) {
                var basis=BaitlyOwnerRefundBasis.requireBasis(em,priorRefund,transfer);
                requireAllocation(prior,priorRefund,basis.net(),basis.before(),basis.gross());
            } else requireAllocation(prior, priorRefund, transfer.getAmount(), refunded, row.getGrossBasis());
            refunded = refunded.add(priorRefund.getAmount());
            if (prior.getAmount().signum() == 0) continue;
            previous.add(new PreviousRecovery(prior.getReversalReference(), prior.getAmount(),
                    Map.of("baitly_recovery_id",prior.getId().toString(),"baitly_organization_id",org.toString(),
                            "baitly_refund_ref",priorRefund.getTransactionRef(),"baitly_transfer_id",transfer.getId().toString())));
        }
        if(owner) {
            var basis=BaitlyOwnerRefundBasis.requireBasis(em,refund,transfer);
            requireAllocation(row,refund,basis.net(),basis.before(),basis.gross());
        } else requireAllocation(row, refund, transfer.getAmount(), refunded, row.getGrossBasis());
        require(previous.stream().map(PreviousRecovery::amount).reduce(row.getAmount(),BigDecimal::add)
                .compareTo(transfer.getAmount()) <= 0, "La récupération dépasse le transfert initial");
        if (row.getAmount().signum() == 0) {
            row.confirmWithoutRecovery();
            return Optional.empty();
        }
        row.claim(Instant.now());
        return Optional.of(new Instruction(id, org, transfer.getId(), transfer.getExternalReference(), transfer.getDestination(),
                transfer.getDestinationPayment(), transfer.getStripeLivemode(), transfer.getAmount(), row.getAmount(),
                row.getCurrency(), refund.getTransactionRef(), row.getFirstAttemptAt(), previous));
    }

    private List<BaitlyTransferRecovery> history(Long org, Long transfer) {
        var rows = em.createQuery("from BaitlyTransferRecovery where organizationId=:org and transferId=:transfer order by id", BaitlyTransferRecovery.class)
                .setParameter("org",org).setParameter("transfer",transfer).getResultList();
        rows.forEach(em::refresh);
        return rows;
    }
    private PaymentTransaction requireConfirmedRecovery(BaitlyTransferRecovery row, Long org, Long mission) {
        var refund = em.find(PaymentTransaction.class, row.getRefundId());
        if (refund != null) em.refresh(refund);
        boolean recovered = row.getAmount().signum() > 0 && row.getState() == BaitlyTransferRecovery.State.RECOVERED
                && row.getReversalReference() != null && row.getReversalReference().startsWith("trr_");
        boolean noRecovery = row.getAmount().signum() == 0 && row.getState() == BaitlyTransferRecovery.State.NO_RECOVERY_REQUIRED
                && row.getReversalReference() == null && row.getFirstAttemptAt() == null;
        require((recovered || noRecovery) && refund != null && Objects.equals(org,refund.getOrganizationId())
                && refund.getPaymentType() == TransactionType.REFUND && refund.getProviderType() == PaymentProviderType.STRIPE
                && (mission==null ? "RESERVATION".equals(refund.getSourceType())
                    : "INTERVENTION".equals(refund.getSourceType()) && Objects.equals(mission,refund.getSourceId()))
                && refund.getStatus() == TransactionStatus.COMPLETED && refund.getAmount() != null
                && (refund.getMetadata() == null || !Boolean.TRUE.equals(refund.getMetadata().get("reviewRequired")))
                && refund.getAmount().compareTo(row.getAmount().add(row.getCommissionRefundAmount())) == 0 && row.getCurrency().equals(refund.getCurrency())
                && com.clenzy.service.BaitlyRefundEvidence.confirmedStripe(refund),
                "La récupération précédente doit être confirmée avant une nouvelle restitution");
        return refund;
    }
    private void requireAllocation(BaitlyTransferRecovery row, PaymentTransaction refund, BigDecimal net,
            BigDecimal before, BigDecimal gross) {
        require(row.getGrossBasis().compareTo(gross) == 0 && gross.compareTo(net) >= 0
                && (row.getNetBasis()==null || row.getNetBasis().compareTo(net)==0)
                && row.getCommissionRefundAmount().signum() >= 0
                && row.getAmount().add(row.getCommissionRefundAmount()).compareTo(refund.getAmount()) == 0
                && row.getAmount().compareTo(BaitlyRefundSeries.delta(net,before,before.add(refund.getAmount()),gross)) == 0,
                "La répartition entre prestataire et commission doit être rapprochée");
    }
    @Transactional public void confirm(Long org, Long id, String reference) { lock(org,id).confirm(reference); }
    @Transactional public void review(Long org, Long id, String code) { lock(org,id).review(code); }
    private BaitlyTransferRecovery lock(Long org, Long id) {
        var row = em.createQuery("from BaitlyTransferRecovery where organizationId=:org and id=:id", BaitlyTransferRecovery.class)
                .setParameter("org",org).setParameter("id",id).setLockMode(LockModeType.PESSIMISTIC_WRITE).getSingleResult();
        em.refresh(row); return row;
    }
    private static void require(boolean ok, String message) {
        if (!ok) throw new com.clenzy.exception.PaymentValidationException(message);
    }
}
