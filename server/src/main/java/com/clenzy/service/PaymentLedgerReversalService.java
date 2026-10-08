package com.clenzy.service;

import com.clenzy.exception.NotFoundException;
import com.clenzy.model.Intervention;
import com.clenzy.model.LedgerEntry;
import com.clenzy.model.LedgerEntryType;
import com.clenzy.model.LedgerReferenceType;
import com.clenzy.model.Wallet;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.LedgerEntryRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Comparator;
import java.util.Objects;
import com.clenzy.model.PaymentTransaction;

/**
 * Contre-passation des ecritures ledger lors d'un remboursement (Z3-BUGS-06).
 *
 * <p>Au paiement d'une intervention, {@code StripeService} credite le ledger
 * (ESCROW → PLATFORM, reference PAYMENT) puis repartit les revenus
 * (PLATFORM → OWNER / CONCIERGE, reference SPLIT). Sans contre-passation, un
 * remboursement Stripe laissait ces credits en place : soldes wallets
 * surevalues de facon systematique.</p>
 *
 * <p>Ce service rejoue chaque paire debit/credit en sens inverse sous la
 * reference {@link LedgerReferenceType#REFUND} — le ledger reste immutable
 * (aucune ecriture modifiee ni supprimee), conformement au modele double-entree
 * de {@link LedgerService}.</p>
 *
 * <p>Idempotent : si des ecritures REFUND existent deja pour la reference de
 * remboursement, l'appel est ignore (re-essai apres echec partiel sans double
 * contre-passation). La methode est transactionnelle : toutes les
 * contre-passations sont committees ensemble.</p>
 */
@Service
public class PaymentLedgerReversalService {

    private static final Logger log = LoggerFactory.getLogger(PaymentLedgerReversalService.class);

    /**
     * Les ecritures PAYMENT d'intervention partagent leur referenceId numerique
     * avec celles des reservations (héritage du schema : refId = id de l'entite,
     * sans discriminant). Le prefixe de description — stable, pose par
     * StripeService ("Paiement intervention: ..." / "Paiement intervention
     * (groupe): ...") — sert de discriminant pour ne pas contre-passer les
     * ecritures d'une reservation portant le meme id numerique.
     */
    private static final String INTERVENTION_PAYMENT_DESCRIPTION_PREFIX = "Paiement intervention";

    private final InterventionRepository interventionRepository;
    private final LedgerEntryRepository ledgerEntryRepository;
    private final LedgerService ledgerService;
    private final WalletService walletService;

    public PaymentLedgerReversalService(InterventionRepository interventionRepository,
                                        LedgerEntryRepository ledgerEntryRepository,
                                        LedgerService ledgerService,
                                        WalletService walletService) {
        this.interventionRepository = interventionRepository;
        this.ledgerEntryRepository = ledgerEntryRepository;
        this.ledgerService = ledgerService;
        this.walletService = walletService;
    }

    /**
     * Contre-passe les ecritures PAYMENT + SPLIT d'une intervention remboursee.
     * Sans effet si aucune ecriture n'existe (le flux wallet avait echoue au
     * moment du paiement) ou si la contre-passation a deja ete enregistree.
     */
    @Transactional
    public void reverseInterventionPaymentEntries(Long interventionId) {
        Intervention intervention = interventionRepository.findById(interventionId)
            .orElseThrow(() -> new NotFoundException("Intervention non trouvee: " + interventionId));
        Long orgId = intervention.getOrganizationId();
        String refundRef = "REFUND-INTERVENTION-" + interventionId;

        if (!ledgerEntryRepository.findByOrganizationIdAndReferenceTypeAndReferenceId(
                orgId, LedgerReferenceType.REFUND, refundRef).isEmpty()) {
            log.info("Contre-passation deja enregistree pour l'intervention {} — ignoree (idempotence)",
                interventionId);
            return;
        }

        int reversedPairs = 0;
        reversedPairs += reversePairs(orgId, LedgerReferenceType.PAYMENT, String.valueOf(interventionId),
            INTERVENTION_PAYMENT_DESCRIPTION_PREFIX, refundRef,
            "Contre-passation paiement intervention #" + interventionId + " (remboursement)");
        reversedPairs += reversePairs(orgId, LedgerReferenceType.SPLIT, "SPLIT-INTERVENTION-" + interventionId,
            null, refundRef,
            "Contre-passation split intervention #" + interventionId + " (remboursement)");

        if (reversedPairs == 0) {
            log.warn("Aucune ecriture ledger a contre-passer pour l'intervention {} "
                + "(flux wallet absent au paiement ?)", interventionId);
            return;
        }
        log.info("Remboursement intervention {} : {} paire(s) d'ecritures ledger contre-passee(s)",
            interventionId, reversedPairs);
    }

    /** Les références du lot ciblent une seule part, sans toucher aux écritures des autres missions. */
    @Transactional
    public void reverseAllocatedPaymentEntries(com.clenzy.model.PaymentTransaction original,
            com.clenzy.model.PaymentTransaction refund, Long missionId) {
        Long org = original.getOrganizationId();
        String ref = original.getTransactionRef() + ":" + missionId;
        String refundRef = refund.getTransactionRef();
        if (!ledgerEntryRepository.findByOrganizationIdAndReferenceTypeAndReferenceId(
                org, LedgerReferenceType.REFUND, refundRef).isEmpty()) return;
        var entries = ledgerEntryRepository.findByOrganizationIdAndReferenceTypeAndReferenceId(org, LedgerReferenceType.PAYMENT, ref);
        var paid = entries.stream().filter(e -> e.getEntryType() == LedgerEntryType.DEBIT)
                .map(LedgerEntry::getAmount).reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add);
        if (paid.compareTo(refund.getAmount()) != 0)
            throw new IllegalStateException("Les écritures de cette part doivent être rapprochées avant leur contre-passation");
        reversePairs(org, LedgerReferenceType.PAYMENT, ref, null, refundRef, "Remboursement prestation #" + missionId);
        reversePairs(org, LedgerReferenceType.SPLIT, "SPLIT-INTERVENTION-" + ref, null, refundRef,
                "Contre-passation répartition prestation #" + missionId);
    }

    /**
     * Rejoue en sens inverse chaque paire debit/credit de la reference donnee :
     * le wallet credite a l'origine est debite, et reciproquement.
     *
     * @param descriptionPrefix filtre optionnel sur la description du debit
     *                          (discriminant des refId numeriques partages)
     * @return nombre de paires contre-passees
     */
    private int reversePairs(Long orgId, LedgerReferenceType refType, String refId,
                             String descriptionPrefix, String refundRef, String reversalDescription) {
        List<LedgerEntry> entries = ledgerEntryRepository
            .findByOrganizationIdAndReferenceTypeAndReferenceId(orgId, refType, refId);

        int count = 0;
        for (LedgerEntry debit : entries) {
            if (debit.getEntryType() != LedgerEntryType.DEBIT) {
                continue;
            }
            if (descriptionPrefix != null
                    && (debit.getDescription() == null || !debit.getDescription().startsWith(descriptionPrefix))) {
                continue;
            }
            LedgerEntry credit = findCounterpart(debit);
            Wallet originallyCredited = walletService.getWalletById(credit.getWalletId());
            Wallet originallyDebited = walletService.getWalletById(debit.getWalletId());
            ledgerService.recordTransfer(originallyCredited, originallyDebited, debit.getAmount(),
                LedgerReferenceType.REFUND, refundRef, reversalDescription);
            count++;
        }
        return count;
    }

    /** Prorata des écritures historiques, après validation sous verrou par le rapprochement externe. */
    @Transactional
    public void reversePartialExternalPaymentEntries(PaymentTransaction original, PaymentTransaction refund, Long missionId) {
        Long org=original.getOrganizationId();
        if (!BaitlyExternalRefundStore.confirmed(refund) || !Objects.equals(org,refund.getOrganizationId())
                || refund.getAmount().signum()<=0 || refund.getAmount().compareTo(original.getAmount())>=0)
            throw new IllegalStateException("Preuve de remboursement partiel absente");
        if (!ledgerEntryRepository.findByOrganizationIdAndReferenceTypeAndReferenceId(
                org,LedgerReferenceType.REFUND,refund.getTransactionRef()).isEmpty()) return;
        reverseProportion(org,LedgerReferenceType.PAYMENT,missionId.toString(),INTERVENTION_PAYMENT_DESCRIPTION_PREFIX,original,refund);
        reverseProportion(org,LedgerReferenceType.SPLIT,"SPLIT-INTERVENTION-"+missionId,null,original,refund);
    }

    private void reverseProportion(Long org, LedgerReferenceType type, String ref, String prefix,
            PaymentTransaction original, PaymentTransaction refund) {
        reverseProportion(org,type,ref,prefix,original,refund,original.getAmount());
    }

    private void reverseProportion(Long org, LedgerReferenceType type, String ref, String prefix,
            PaymentTransaction original, PaymentTransaction refund, BigDecimal paidBasis) {
        var debits=ledgerEntryRepository.findByOrganizationIdAndReferenceTypeAndReferenceId(org,type,ref).stream()
                .filter(e -> e.getEntryType()==LedgerEntryType.DEBIT)
                .filter(e -> prefix==null || (e.getDescription()!=null && e.getDescription().startsWith(prefix)))
                .sorted(Comparator.comparing(LedgerEntry::getId)).toList();
        BigDecimal cumulative=BigDecimal.ZERO,allocated=BigDecimal.ZERO;
        var weights=debits.stream().map(LedgerEntry::getAmount).toList();
        BigDecimal basis=weights.stream().reduce(BigDecimal.ZERO,BigDecimal::add);
        var prior=BaitlyRefundSeries.apportion(weights,basis.multiply(BaitlyRefundSeries.before(refund)).divide(paidBasis,2,RoundingMode.HALF_UP));
        var next=BaitlyRefundSeries.apportion(weights,basis.multiply(BaitlyRefundSeries.after(refund)).divide(paidBasis,2,RoundingMode.HALF_UP));
        int index=0;
        for(var debit:debits) {
            var credit=findCounterpart(debit);
            if (!Objects.equals(credit.getOrganizationId(),org) || credit.getEntryType()!=LedgerEntryType.CREDIT
                    || !Objects.equals(credit.getCounterpartEntryId(),debit.getId())
                    || !Objects.equals(credit.getReferenceId(),ref) || credit.getReferenceType()!=type
                    || debit.getAmount().compareTo(credit.getAmount())!=0
                    || !Objects.equals(debit.getCurrency(),original.getCurrency())
                    || !Objects.equals(credit.getCurrency(),original.getCurrency()))
                throw new IllegalStateException("Paire comptable incohérente");
            cumulative=cumulative.add(debit.getAmount());
            BigDecimal target=cumulative.multiply(refund.getAmount()).divide(paidBasis,2,RoundingMode.HALF_UP);
            BigDecimal share=BaitlyRefundSeries.isSeries(refund)?next.get(index).subtract(prior.get(index)):target.subtract(allocated);
            allocated=target; index++;
            if(share.signum()>0) ledgerService.recordTransfer(walletService.getWalletById(credit.getWalletId()),
                    walletService.getWalletById(debit.getWalletId()),share,LedgerReferenceType.REFUND,
                    refund.getTransactionRef(),"Remboursement partiel intervention #"+refund.getSourceId());
        }
        if(type==LedgerReferenceType.PAYMENT && cumulative.compareTo(paidBasis)!=0)
            throw new IllegalStateException("Encaissement comptable incomplet");
    }

    @Transactional
    public void reverseCumulativePaymentEntries(PaymentTransaction original,PaymentTransaction refund,Long missionId,List<String> previousRefs) {
        reverseCumulative(original,refund,missionId.toString(),INTERVENTION_PAYMENT_DESCRIPTION_PREFIX,original.getAmount(),previousRefs);
    }

    @Transactional
    public void reverseMaintenanceEntries(PaymentTransaction original,PaymentTransaction refund,Long missionId,
                                          BigDecimal total,List<String> previousRefs) {
        reverseCumulative(original,BaitlyMaintenanceReceipts.accounting(refund),missionId.toString(),
                INTERVENTION_PAYMENT_DESCRIPTION_PREFIX,total,previousRefs);
    }

    @Transactional
    public void reverseCumulativeAllocatedPaymentEntries(PaymentTransaction original,PaymentTransaction refund,
            Long missionId,BigDecimal paidBasis,List<String> previousRefs) {
        if(!BaitlyBatchRefundPersistence.isAllocation(refund) || !Objects.equals(missionId,refund.getSourceId()))
            throw new IllegalStateException("Part de remboursement incohérente");
        reverseCumulative(original,refund,original.getTransactionRef()+":"+missionId,null,paidBasis,previousRefs);
    }

    private void reverseCumulative(PaymentTransaction original,PaymentTransaction refund,String receiptRef,
            String descriptionPrefix,BigDecimal paidBasis,List<String> previousRefs) {
        if(!BaitlyRefundSeries.isSeries(refund) || refund.getStatus()!=com.clenzy.model.TransactionStatus.COMPLETED
                || !Objects.equals(original.getOrganizationId(),refund.getOrganizationId())
                || paidBasis==null || paidBasis.signum()<=0 || BaitlyRefundSeries.after(refund).compareTo(paidBasis)>0)
            throw new IllegalStateException("Restitution cumulative non confirmée");
        Long org=original.getOrganizationId();
        if(!ledgerEntryRepository.findByOrganizationIdAndReferenceTypeAndReferenceId(org,LedgerReferenceType.REFUND,
                refund.getTransactionRef()).isEmpty()) return;
        var prior=previousRefs.stream().flatMap(ref -> ledgerEntryRepository.findByOrganizationIdAndReferenceTypeAndReferenceId(
                org,LedgerReferenceType.REFUND,ref).stream()).toList();
        var expected=new java.util.HashMap<String,BigDecimal>();
        for(var type:List.of(LedgerReferenceType.PAYMENT,LedgerReferenceType.SPLIT)) {
            String ref=type==LedgerReferenceType.PAYMENT?receiptRef:"SPLIT-INTERVENTION-"+receiptRef;
            var debits=ledgerEntryRepository.findByOrganizationIdAndReferenceTypeAndReferenceId(org,type,ref).stream()
                    .filter(e -> e.getEntryType()==LedgerEntryType.DEBIT)
                    .filter(e -> type!=LedgerReferenceType.PAYMENT || descriptionPrefix==null
                            || e.getDescription()!=null && e.getDescription().startsWith(descriptionPrefix))
                    .sorted(Comparator.comparing(LedgerEntry::getId)).toList();
            var weights=debits.stream().map(LedgerEntry::getAmount).toList();
            var target=weights.stream().reduce(BigDecimal.ZERO,BigDecimal::add).multiply(BaitlyRefundSeries.before(refund))
                    .divide(paidBasis,2,RoundingMode.HALF_UP);
            var shares=BaitlyRefundSeries.apportion(weights,target);
            for(int i=0;i<debits.size();i++) if(shares.get(i).signum()>0) {
                var debit=debits.get(i);var credit=findCounterpart(debit);
                expected.merge(credit.getWalletId()+":"+debit.getWalletId(),shares.get(i),BigDecimal::add);
            }
        }
        var actual=new java.util.HashMap<String,BigDecimal>();
        for(var debit:prior) if(debit.getEntryType()==LedgerEntryType.DEBIT) {
            var credit=findCounterpart(debit);
            if(!Objects.equals(org,credit.getOrganizationId()) || credit.getEntryType()!=LedgerEntryType.CREDIT
                    || !Objects.equals(credit.getCounterpartEntryId(),debit.getId()) || credit.getAmount().compareTo(debit.getAmount())!=0)
                throw new IllegalStateException("Contre-écriture antérieure incohérente");
            actual.merge(debit.getWalletId()+":"+credit.getWalletId(),debit.getAmount(),BigDecimal::add);
        }
        if(!actual.keySet().equals(expected.keySet()) || expected.entrySet().stream()
                .anyMatch(e -> e.getValue().compareTo(actual.get(e.getKey()))!=0))
            throw new IllegalStateException("Répartition antérieure à rapprocher avant la contre-passation suivante");
        reverseProportion(org,LedgerReferenceType.PAYMENT,receiptRef,descriptionPrefix,original,refund,paidBasis);
        reverseProportion(org,LedgerReferenceType.SPLIT,"SPLIT-INTERVENTION-"+receiptRef,null,original,refund,paidBasis);
    }

    private LedgerEntry findCounterpart(LedgerEntry debit) {
        if (debit.getCounterpartEntryId() == null) {
            throw new IllegalStateException(
                "Ecriture ledger " + debit.getId() + " sans contrepartie — contre-passation impossible");
        }
        return ledgerEntryRepository.findById(debit.getCounterpartEntryId())
            .orElseThrow(() -> new IllegalStateException(
                "Contrepartie " + debit.getCounterpartEntryId() + " introuvable pour l'ecriture "
                    + debit.getId() + " — contre-passation impossible"));
    }
}
