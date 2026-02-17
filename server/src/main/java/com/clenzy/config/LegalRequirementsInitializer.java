package com.clenzy.config;

import com.clenzy.model.DocumentLegalRequirement;
import com.clenzy.model.DocumentType;
import com.clenzy.repository.DocumentLegalRequirementRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Initialise les mentions legales obligatoires par type de document au demarrage.
 * Idempotent : ne cree pas de doublon (les donnees initiales sont dans V31).
 * Verifie simplement que les mentions requises existent et log le resultat.
 */
@Component
public class LegalRequirementsInitializer {

    private static final Logger log = LoggerFactory.getLogger(LegalRequirementsInitializer.class);

    private final DocumentLegalRequirementRepository legalRequirementRepository;

    public LegalRequirementsInitializer(DocumentLegalRequirementRepository legalRequirementRepository) {
        this.legalRequirementRepository = legalRequirementRepository;
    }

    @EventListener(ApplicationReadyEvent.class)
    @Transactional(readOnly = true)
    @Order(20) // Apres PermissionInitializer
    public void verifyLegalRequirements() {
        log.info("Verification des mentions legales NF au demarrage...");

        List<DocumentLegalRequirement> allRequirements = legalRequirementRepository
                .findAllByActiveTrueOrderByDocumentTypeAscDisplayOrderAsc();

        if (allRequirements.isEmpty()) {
            log.warn("Aucune mention legale trouvee en base. "
                    + "Verifier que la migration V31 a ete executee.");
            return;
        }

        // Compter par type
        long factureCount = allRequirements.stream()
                .filter(r -> r.getDocumentType() == DocumentType.FACTURE).count();
        long devisCount = allRequirements.stream()
                .filter(r -> r.getDocumentType() == DocumentType.DEVIS).count();
        long bonInterventionCount = allRequirements.stream()
                .filter(r -> r.getDocumentType() == DocumentType.BON_INTERVENTION).count();

        log.info("Mentions legales NF initialisees : {} total "
                        + "(FACTURE: {}, DEVIS: {}, BON_INTERVENTION: {})",
                allRequirements.size(), factureCount, devisCount, bonInterventionCount);

        // Verifier les mentions critiques pour FACTURE
        if (factureCount < 7) {
            log.warn("FACTURE : seulement {} mentions legales (7 attendues). "
                    + "La conformite NF pourrait etre incomplete.", factureCount);
        }
    }
}
