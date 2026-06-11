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
