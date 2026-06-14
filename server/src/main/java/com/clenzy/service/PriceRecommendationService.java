package com.clenzy.service;

import com.clenzy.dto.PriceRecommendationDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.PriceRecommendation;
import com.clenzy.model.PriceRecommendationSource;
import com.clenzy.model.PriceRecommendationStatus;
import com.clenzy.repository.PriceRecommendationRepository;
import com.clenzy.service.access.OrganizationAccessGuard;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Gestion du cycle de vie des recommandations de prix (CLZ-P0-17).
 *
 * <p>Les transitions de statut se font par <b>UPDATE conditionnel (CAS)</b> via
 * {@link PriceRecommendationRepository#transitionStatus} : jamais de check-then-act sur le statut
 * (audit #8). L'ownership est validé après {@code findById} (audit #3) ; la clause {@code orgId} du
 * CAS est une défense en profondeur. Aucune entité JPA n'est exposée (audit #5).</p>
 *
 * <p>La <b>proposition</b> (idempotente par {@code (org, property, date)}) est destinée au job
 * quotidien de recommandation (CLZ-P0-16) ; l'émission outbox/Kafka déclenchée par l'acceptation
 * est différée (HP, dépend de l'infra de sync).</p>
 */
@Service
public class PriceRecommendationService {

    private final PriceRecommendationRepository repository;
    private final OrganizationAccessGuard accessGuard;

    public PriceRecommendationService(PriceRecommendationRepository repository,
                                      OrganizationAccessGuard accessGuard) {
        this.repository = repository;
        this.accessGuard = accessGuard;
    }

    /**
     * Crée ou remplace (idempotent) la recommandation PROPOSED d'un créneau.
     */
    @Transactional
    public PriceRecommendation propose(Long orgId, Long propertyId, LocalDate date,
                                       BigDecimal suggestedPrice, BigDecimal basePrice,
                                       String currency, PriceRecommendationSource source,
                                       String reason) {
        PriceRecommendation reco = repository
            .findByOrganizationIdAndPropertyIdAndRecoDate(orgId, propertyId, date)
            .orElseGet(PriceRecommendation::new);
        reco.setOrganizationId(orgId);
        reco.setPropertyId(propertyId);
        reco.setRecoDate(date);
        reco.setSuggestedPrice(suggestedPrice);
        reco.setBasePrice(basePrice);
        reco.setCurrency(currency);
        reco.setSource(source);
        reco.setReason(reason);
        reco.setStatus(PriceRecommendationStatus.PROPOSED);
        return repository.save(reco);
    }

    /**
     * Accepte une recommandation (CAS PROPOSED → ACCEPTED).
     *
     * @throws NotFoundException si la recommandation n'existe pas
     * @throws org.springframework.security.access.AccessDeniedException si elle n'appartient pas à l'org
     * @throws IllegalStateException si elle n'est plus PROPOSED (course perdue / déjà traitée)
     */
    @Transactional
    public void accept(Long orgId, Long recoId) {
        transition(orgId, recoId, PriceRecommendationStatus.PROPOSED, PriceRecommendationStatus.ACCEPTED);
    }

    /**
     * Rejette une recommandation (CAS PROPOSED → REJECTED).
     */
    @Transactional
    public void reject(Long orgId, Long recoId) {
        transition(orgId, recoId, PriceRecommendationStatus.PROPOSED, PriceRecommendationStatus.REJECTED);
    }

    private void transition(Long orgId, Long recoId,
                            PriceRecommendationStatus expected, PriceRecommendationStatus next) {
        PriceRecommendation reco = repository.findById(recoId)
            .orElseThrow(() -> new NotFoundException("Price recommendation not found: " + recoId));
        accessGuard.requireSameOrganization(reco.getOrganizationId(), "PriceRecommendation " + recoId);

        int updated = repository.transitionStatus(recoId, orgId, expected, next);
        if (updated == 0) {
            throw new IllegalStateException(
                "Recommendation " + recoId + " is not in " + expected + " state (already processed)");
        }
    }

    @Transactional(readOnly = true)
    public List<PriceRecommendationDto> list(Long orgId, Long propertyId, LocalDate from, LocalDate to) {
        return repository
            .findByOrganizationIdAndPropertyIdAndRecoDateBetween(orgId, propertyId, from, to)
            .stream()
            .map(PriceRecommendationDto::from)
            .toList();
    }
}
