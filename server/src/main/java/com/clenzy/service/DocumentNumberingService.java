package com.clenzy.service;

import com.clenzy.model.DocumentNumberSequence;
import com.clenzy.model.DocumentType;
import com.clenzy.repository.DocumentNumberSequenceRepository;
import com.clenzy.tenant.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Map;

/**
 * Service de numerotation sequentielle sans trous pour les documents comptables.
 * <p>
 * Format : {PREFIX}-{ANNEE}-{NUMERO_5_CHIFFRES}
 * Exemples : FAC-2025-00001, DEV-2025-00042
 * <p>
 * Utilise un verrouillage pessimiste (SELECT ... FOR UPDATE) sur la table
 * document_number_sequences pour garantir l'absence de trous meme en
 * cas de requetes concurrentes.
 */
@Service
public class DocumentNumberingService {

    private static final Logger log = LoggerFactory.getLogger(DocumentNumberingService.class);

    /** Prefixes par type de document */
    private static final Map<DocumentType, String> PREFIXES = Map.of(
            DocumentType.FACTURE, "FAC",
            DocumentType.DEVIS, "DEV"
    );

    private final DocumentNumberSequenceRepository sequenceRepository;
    private final TenantContext tenantContext;

    public DocumentNumberingService(DocumentNumberSequenceRepository sequenceRepository,
                                    TenantContext tenantContext) {
        this.sequenceRepository = sequenceRepository;
        this.tenantContext = tenantContext;
    }

    /**
     * Genere le prochain numero legal pour un type de document.
     * Thread-safe grace au verrouillage pessimiste.
     *
     * @param type Type de document (FACTURE ou DEVIS)
     * @return Numero legal formate (ex: FAC-2025-00001)
     * @throws IllegalArgumentException si le type ne requiert pas de numerotation
     */
    @Transactional
    public String generateNextNumber(DocumentType type) {
        if (!requiresLegalNumber(type)) {
            throw new IllegalArgumentException("Le type " + type + " ne requiert pas de numerotation legale");
        }

        String prefix = PREFIXES.get(type);
        int currentYear = LocalDate.now().getYear();

        // Verrouillage pessimiste : SELECT ... FOR UPDATE
        DocumentNumberSequence sequence = sequenceRepository
                .findByDocumentTypeAndYearForUpdate(type.name(), currentYear, tenantContext.getRequiredOrganizationId())
                .orElseGet(() -> {
                    // Creer la sequence si elle n'existe pas encore pour cette annee
                    log.info("Creation de la sequence {} pour l'annee {}", type.name(), currentYear);
                    DocumentNumberSequence newSeq = new DocumentNumberSequence(type.name(), currentYear, prefix);
                    return sequenceRepository.save(newSeq);
                });

        // Incrementer le compteur
        int nextNumber = sequence.incrementAndGet();
        sequenceRepository.save(sequence);

        // Formater : PREFIX-YYYY-NNNNN
        String legalNumber = String.format("%s-%d-%05d", prefix, currentYear, nextNumber);

        log.info("Numero legal genere: {} (sequence #{} pour {} {})",
                legalNumber, nextNumber, type.name(), currentYear);

        return legalNumber;
    }

    /**
     * Verifie si un type de document requiert une numerotation legale.
     * Seuls FACTURE et DEVIS sont soumis a cette obligation NF.
     */
    public boolean requiresLegalNumber(DocumentType type) {
        return PREFIXES.containsKey(type);
    }

    /**
     * Retourne le dernier numero genere pour un type et une annee (lecture seule).
     */
    @Transactional(readOnly = true)
    public int getLastNumber(DocumentType type, int year) {
        return sequenceRepository.findByDocumentTypeAndYear(type.name(), year)
                .map(DocumentNumberSequence::getLastNumber)
                .orElse(0);
    }
}
