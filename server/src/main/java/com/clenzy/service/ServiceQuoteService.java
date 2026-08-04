package com.clenzy.service;

import com.clenzy.exception.NotFoundException;
import com.clenzy.model.Intervention;
import com.clenzy.model.ServiceQuote;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.ServiceQuoteRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.List;

/**
 * Devis prestataires (M4, vague M-B). L'approbation est la décision qui compte :
 * CAS RECEIVED → APPROVED (unique partiel DB : jamais deux devis approuvés sur la
 * même intervention), les concurrents sont écartés, et le montant approuvé devient
 * l'{@code estimatedCost} de l'intervention — la source que re-résolvent les cartes
 * aval (retenue de caution, accord travaux).
 */
@Service
public class ServiceQuoteService {

    private static final Logger log = LoggerFactory.getLogger(ServiceQuoteService.class);

    private final ServiceQuoteRepository quoteRepository;
    private final InterventionRepository interventionRepository;
    private final Clock clock;

    public ServiceQuoteService(ServiceQuoteRepository quoteRepository,
                               InterventionRepository interventionRepository,
                               Clock clock) {
        this.quoteRepository = quoteRepository;
        this.interventionRepository = interventionRepository;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<ServiceQuote> listForIntervention(Long interventionId, Long orgId) {
        return quoteRepository.findByInterventionIdAndOrganizationIdOrderByAmountAsc(interventionId, orgId);
    }

    @Transactional
    public ServiceQuote create(Long orgId, ServiceQuote quote) {
        // L'intervention rattachée doit appartenir à l'org (findById contourne le
        // filtre Hibernate — règle audit n°3) ; le logement du devis est le sien.
        final Intervention intervention = requireOwnedIntervention(quote.getInterventionId(), orgId);
        quote.setId(null);
        quote.setOrganizationId(orgId);
        quote.setPropertyId(intervention.getProperty().getId());
        quote.setStatus(ServiceQuote.Status.RECEIVED);
        return quoteRepository.save(quote);
    }

    @Transactional
    public void delete(Long id, Long orgId) {
        final ServiceQuote quote = quoteRepository.findByIdAndOrganizationId(id, orgId)
                .orElseThrow(() -> new NotFoundException("Devis introuvable : " + id));
        if (quote.getStatus() == ServiceQuote.Status.APPROVED) {
            throw new IllegalStateException("Un devis approuvé ne se supprime pas — il se remplace");
        }
        quoteRepository.delete(quote);
    }

    /**
     * Approuve le devis : CAS RECEIVED → APPROVED, concurrents écartés, montant
     * reporté sur l'intervention. Échec explicite si le devis n'est plus RECEIVED
     * (déjà approuvé/écarté entre-temps — la carte peut être périmée).
     */
    @Transactional
    public ServiceQuote approve(Long id, Long orgId, String approvedBy) {
        final ServiceQuote quote = quoteRepository.findByIdAndOrganizationId(id, orgId)
                .orElseThrow(() -> new NotFoundException("Devis introuvable : " + id));
        if (quoteRepository.markApproved(id, orgId, approvedBy, clock.instant()) == 0) {
            throw new IllegalStateException("Devis déjà " + quote.getStatus()
                    + " — approbation impossible");
        }
        if (quote.getInterventionId() != null) {
            quoteRepository.rejectSiblings(quote.getInterventionId(), orgId, id);
            final Intervention intervention = requireOwnedIntervention(quote.getInterventionId(), orgId);
            intervention.setEstimatedCost(quote.getAmount());
            interventionRepository.save(intervention);
        }
        log.info("Devis {} approuvé (org={}, intervention={}, montant={})",
                id, orgId, quote.getInterventionId(), quote.getAmount());
        return quoteRepository.findByIdAndOrganizationId(id, orgId).orElse(quote);
    }

    private Intervention requireOwnedIntervention(Long interventionId, Long orgId) {
        if (interventionId == null) {
            throw new IllegalStateException("Devis sans intervention rattachée");
        }
        final Intervention intervention = interventionRepository.findById(interventionId)
                .orElseThrow(() -> new NotFoundException("Intervention introuvable : " + interventionId));
        if (intervention.getOrganizationId() == null
                || !intervention.getOrganizationId().equals(orgId)) {
            throw new NotFoundException("Intervention introuvable pour cette organisation");
        }
        return intervention;
    }
}
