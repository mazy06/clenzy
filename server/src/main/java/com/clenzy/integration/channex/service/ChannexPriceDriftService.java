package com.clenzy.integration.channex.service;

import com.clenzy.integration.channex.model.ChannexPriceDrift;
import com.clenzy.integration.channex.repository.ChannexPriceDriftRepository;
import com.clenzy.integration.channex.repository.ChannexPropertyMappingRepository;
import com.clenzy.model.Property;
import com.clenzy.model.RateOverride;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.RateOverrideRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

/**
 * Service de resolution des drifts de prix Clenzy ↔ OTA — Phase 3.
 *
 * <p>3 strategies de resolution possibles par drift :</p>
 * <ul>
 *   <li>{@link ChannexPriceDrift.Resolution#KEEP_CLENZY} : on conserve le prix
 *       Clenzy. Au prochain push (cron ou manuel), Channex sera ecrase.</li>
 *   <li>{@link ChannexPriceDrift.Resolution#KEEP_OTA}    : on cree/update un
 *       {@link RateOverride} avec le prix OTA → le PriceEngine resoudra cette
 *       date avec le prix OTA.</li>
 *   <li>{@link ChannexPriceDrift.Resolution#DISMISSED}   : l'admin ignore
 *       l'ecart (ex : differenciation attendue). Le drift est marque resolu
 *       sans action sur les prix.</li>
 * </ul>
 */
@Service
public class ChannexPriceDriftService {

    private static final Logger log = LoggerFactory.getLogger(ChannexPriceDriftService.class);

    private final ChannexPriceDriftRepository driftRepository;
    private final RateOverrideRepository rateOverrideRepository;
    private final PropertyRepository propertyRepository;
    private final ChannexPropertyMappingRepository mappingRepository;

    public ChannexPriceDriftService(ChannexPriceDriftRepository driftRepository,
                                     RateOverrideRepository rateOverrideRepository,
                                     PropertyRepository propertyRepository,
                                     ChannexPropertyMappingRepository mappingRepository) {
        this.driftRepository = driftRepository;
        this.rateOverrideRepository = rateOverrideRepository;
        this.propertyRepository = propertyRepository;
        this.mappingRepository = mappingRepository;
    }

    /** Liste les drifts actifs (non resolus) de l'organisation. */
    public List<ChannexPriceDrift> listActive(Long orgId) {
        return driftRepository.findActiveByOrg(orgId);
    }

    /** Liste les drifts actifs pour une property specifique. */
    public List<ChannexPriceDrift> listActiveForProperty(Long orgId, Long propertyId) {
        return driftRepository.findActiveByProperty(orgId, propertyId);
    }

    /**
     * Resout un drift par son ID + strategie.
     *
     * @return le drift mis a jour (resolution + resolvedAt + resolvedBy)
     * @throws IllegalStateException si le drift n'existe pas ou est deja resolu
     */
    @Transactional
    public ChannexPriceDrift resolve(Long orgId, Long driftId,
                                       ChannexPriceDrift.Resolution resolution,
                                       String resolvedBy) {
        ChannexPriceDrift drift = driftRepository.findById(driftId)
            .orElseThrow(() -> new IllegalStateException(
                "Drift " + driftId + " introuvable"));
        if (!orgId.equals(drift.getOrganizationId())) {
            throw new IllegalStateException("Drift " + driftId
                + " n'appartient pas a l'organisation " + orgId);
        }
        if (drift.getResolvedAt() != null) {
            throw new IllegalStateException("Drift " + driftId + " est deja resolu ("
                + drift.getResolution() + ")");
        }

        switch (resolution) {
            case KEEP_OTA -> applyKeepOta(drift);
            case KEEP_CLENZY -> {
                // Pas d'action immediate : au prochain push (cron ou manuel),
                // le PriceEngine pushera son prix qui ecrasera Channex. On ne
                // force pas un push ici pour ne pas bloquer la transaction de
                // resolution.
                log.info("ChannexPriceDrift: KEEP_CLENZY drift={} property={} date={} (push au prochain cycle sync)",
                    drift.getId(), drift.getClenzyPropertyId(), drift.getDriftDate());
            }
            case DISMISSED -> log.info("ChannexPriceDrift: DISMISSED drift={} property={} date={}",
                drift.getId(), drift.getClenzyPropertyId(), drift.getDriftDate());
        }

        drift.setResolution(resolution);
        drift.setResolvedAt(Instant.now());
        drift.setResolvedBy(resolvedBy);
        return driftRepository.save(drift);
    }

    /**
     * Strategie KEEP_OTA : cree (ou update) un {@link RateOverride} avec le prix
     * OTA pour la date du drift. Le PriceEngine resoudra cette date avec le
     * prix OTA (priorite 1 dans l'algorithme de resolution).
     */
    private void applyKeepOta(ChannexPriceDrift drift) {
        Property property = propertyRepository.findById(drift.getClenzyPropertyId())
            .orElseThrow(() -> new IllegalStateException(
                "Property " + drift.getClenzyPropertyId() + " introuvable"));

        RateOverride override = rateOverrideRepository
            .findByPropertyIdAndDate(drift.getClenzyPropertyId(), drift.getDriftDate(),
                drift.getOrganizationId())
            .orElseGet(RateOverride::new);

        override.setProperty(property);
        override.setOrganizationId(drift.getOrganizationId());
        override.setDate(drift.getDriftDate());
        override.setNightlyPrice(drift.getOtaPrice());
        override.setCurrency(drift.getCurrency());
        override.setSource("OTA:RESOLVED");
        override.setCreatedBy("drift-resolver");
        rateOverrideRepository.save(override);

        log.info("ChannexPriceDrift: KEEP_OTA applique drift={} property={} date={} otaPrice={}{}",
            drift.getId(), drift.getClenzyPropertyId(), drift.getDriftDate(),
            drift.getOtaPrice(), drift.getCurrency());
    }
}
