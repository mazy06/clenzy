package com.clenzy.service;

import com.clenzy.model.InvoiceNumberSequence;
import com.clenzy.repository.InvoiceNumberSequenceRepository;
import com.clenzy.tenant.TenantContext;
import jakarta.persistence.EntityManager;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

/**
 * Service de numerotation sequentielle des factures.
 *
 * <p>Garantit l'absence de trous dans la numerotation (exigence legale FR/MA/SA) :
 * le numero est attribue DANS la transaction de creation/emission de la facture
 * (propagation REQUIRED, jamais REQUIRES_NEW). Si la transaction appelante
 * rollback, la facture ET l'increment du compteur sont annules ensemble —
 * aucun numero n'est consomme a vide.</p>
 *
 * <p>Utilise un verrou pessimiste (SELECT ... FOR UPDATE) sur le compteur de
 * l'organisation : consequence assumee, les emissions de factures d'une meme
 * organisation (et meme annee) sont serialisees jusqu'au commit de la
 * transaction appelante.</p>
 *
 * <p>Cette sequence ({@code invoice_number_sequences}) est l'UNIQUE source de
 * numerotation de l'entite {@code Invoice} — voir
 * {@code InvoiceGeneratorService#createIssuedFromDocumentGeneration}.</p>
 *
 * Format : {prefix}{annee}-{numero 5 chiffres}
 * Exemple : FA2026-00001
 */
@Service
public class InvoiceNumberingService {

    private static final Logger log = LoggerFactory.getLogger(InvoiceNumberingService.class);

    private static final String DEFAULT_PREFIX = "FA";

    private final InvoiceNumberSequenceRepository sequenceRepository;
    private final TenantContext tenantContext;
    private final EntityManager entityManager;

    public InvoiceNumberingService(InvoiceNumberSequenceRepository sequenceRepository,
                                    TenantContext tenantContext,
                                    EntityManager entityManager) {
        this.sequenceRepository = sequenceRepository;
        this.tenantContext = tenantContext;
        this.entityManager = entityManager;
    }

    /**
     * Genere le prochain numero de facture pour l'organisation courante.
     * Thread-safe via verrouillage pessimiste en base. Doit etre appele dans
     * la transaction qui persiste la facture (rollback = numero restitue).
     *
     * @return Numero de facture formate (ex: FA2026-00001)
     */
    @Transactional
    public String generateNextNumber() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return generateNextNumber(orgId);
    }

    /**
     * Surcharge sans dependance TenantContext.
     * Utilisee depuis les webhooks Stripe et les consumers Kafka (pas de contexte tenant).
     */
    @Transactional
    public String generateNextNumber(Long orgId) {
        int currentYear = LocalDate.now().getYear();

        InvoiceNumberSequence sequence = sequenceRepository
            .findAndLock(orgId, currentYear)
            .orElseGet(() -> initializeAndLockSequence(orgId, currentYear));

        String number = sequence.nextNumber();
        sequenceRepository.save(sequence);

        log.info("Invoice number generated: {} (org={})", number, orgId);
        return number;
    }

    /**
     * Initialise le compteur de l'organisation pour l'annee via un upsert
     * {@code ON CONFLICT DO NOTHING} (ferme la course de creation entre deux
     * transactions concurrentes en propagation REQUIRED), puis le verrouille.
     */
    private InvoiceNumberSequence initializeAndLockSequence(Long orgId, int year) {
        entityManager.createNativeQuery(
                "INSERT INTO invoice_number_sequences (organization_id, prefix, current_year, last_number) "
                + "VALUES (:orgId, :prefix, :year, 0) "
                + "ON CONFLICT (organization_id, current_year) DO NOTHING")
            .setParameter("orgId", orgId)
            .setParameter("prefix", DEFAULT_PREFIX)
            .setParameter("year", year)
            .executeUpdate();

        return sequenceRepository.findAndLock(orgId, year)
            .orElseThrow(() -> new IllegalStateException(
                "Sequence de numerotation introuvable apres initialisation (org=" + orgId + ")"));
    }
}
