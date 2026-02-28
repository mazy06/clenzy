package com.clenzy.service;

import com.clenzy.model.InvoiceNumberSequence;
import com.clenzy.repository.InvoiceNumberSequenceRepository;
import com.clenzy.tenant.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

/**
 * Service de numerotation sequentielle des factures.
 *
 * Garantit l'absence de trous dans la numerotation (exigence legale FR/MA/SA).
 * Utilise un verrou pessimiste (SELECT ... FOR UPDATE) pour eviter les doublons
 * en environnement concurrent.
 *
 * Format : {prefix}-{annee}-{numero 5 chiffres}
 * Exemple : FA-2026-00001
 */
@Service
public class InvoiceNumberingService {

    private static final Logger log = LoggerFactory.getLogger(InvoiceNumberingService.class);

    private final InvoiceNumberSequenceRepository sequenceRepository;
    private final TenantContext tenantContext;

    public InvoiceNumberingService(InvoiceNumberSequenceRepository sequenceRepository,
                                    TenantContext tenantContext) {
        this.sequenceRepository = sequenceRepository;
        this.tenantContext = tenantContext;
    }

    /**
     * Genere le prochain numero de facture pour l'organisation courante.
     * Thread-safe via verrouillage pessimiste en base.
     *
     * @return Numero de facture formate (ex: FA-2026-00001)
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public String generateNextNumber() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        int currentYear = LocalDate.now().getYear();

        InvoiceNumberSequence sequence = sequenceRepository
            .findAndLock(orgId, currentYear)
            .orElseGet(() -> createSequence(orgId, currentYear));

        String number = sequence.nextNumber();
        sequenceRepository.save(sequence);

        log.info("Invoice number generated: {} (org={})", number, orgId);
        return number;
    }

    private InvoiceNumberSequence createSequence(Long orgId, int year) {
        InvoiceNumberSequence seq = new InvoiceNumberSequence();
        seq.setOrganizationId(orgId);
        seq.setPrefix("FA");
        seq.setCurrentYear(year);
        seq.setLastNumber(0);
        return sequenceRepository.save(seq);
    }
}
