package com.clenzy.scheduler;

import com.clenzy.model.PropertyElasticityEstimate;
import com.clenzy.repository.PropertyElasticityEstimateRepository;
import com.clenzy.repository.PropertyElasticityEstimateRepository.PropertyTenantRow;
import com.clenzy.service.agent.simulation.EmpiricalElasticityEstimator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;

/**
 * Recalcule hebdomadaire des estimations d'elasticite empirique pour toutes
 * les proprietes ACTIVE.
 *
 * <p>Cron : dimanche 4h UTC ({@code "0 0 4 * * SUN"}). Pour chaque propriete :
 * <ol>
 *   <li>Appelle {@link EmpiricalElasticityEstimator#estimate(Long, Long)}</li>
 *   <li>Si une estimation est produite, upsert dans {@code property_elasticity_estimate}</li>
 *   <li>Si pas d'estimation (pas assez de donnees), on ne touche pas a la valeur existante
 *       — un cache plus ancien reste meilleur que rien</li>
 * </ol>
 *
 * <p>Chaque propriete est traitee dans sa propre transaction (REQUIRES_NEW) : un
 * echec sur une propriete ne casse pas la boucle.</p>
 */
@Component
public class ElasticityRecomputeScheduler {

    private static final Logger log = LoggerFactory.getLogger(ElasticityRecomputeScheduler.class);

    private final PropertyElasticityEstimateRepository estimateRepository;
    private final EmpiricalElasticityEstimator estimator;
    private final Clock clock;
    private final boolean enabled;

    @org.springframework.beans.factory.annotation.Autowired
    public ElasticityRecomputeScheduler(PropertyElasticityEstimateRepository estimateRepository,
                                          EmpiricalElasticityEstimator estimator,
                                          @Value("${clenzy.assistant.elasticity.recompute-enabled:true}") boolean enabled) {
        this(estimateRepository, estimator, Clock.systemUTC(), enabled);
    }

    /** Constructeur test-friendly avec horloge injectable (deterministe). */
    ElasticityRecomputeScheduler(PropertyElasticityEstimateRepository estimateRepository,
                                   EmpiricalElasticityEstimator estimator,
                                   Clock clock,
                                   boolean enabled) {
        this.estimateRepository = estimateRepository;
        this.estimator = estimator;
        this.clock = clock;
        this.enabled = enabled;
    }

    /** Dimanche 4h UTC : faible activite, idem hebdo des autres jobs maintenance. */
    @Scheduled(cron = "0 0 4 * * SUN")
    public void runWeekly() {
        runOnce();
    }

    /**
     * Execution effective — separee du cron pour les tests.
     * @return nombre d'estimations upsertees
     */
    public int runOnce() {
        if (!enabled) {
            log.debug("ElasticityRecomputeScheduler : disabled, skip");
            return 0;
        }

        List<PropertyTenantRow> properties;
        try {
            properties = estimateRepository.listActivePropertyIds();
        } catch (Exception e) {
            log.error("ElasticityRecomputeScheduler : listActiveProperties failed", e);
            return 0;
        }
        if (properties.isEmpty()) return 0;

        int upserted = 0;
        int skipped = 0;
        for (PropertyTenantRow row : properties) {
            try {
                if (processOne(row)) upserted++;
                else skipped++;
            } catch (Exception e) {
                log.warn("ElasticityRecomputeScheduler : property {} failed : {}",
                        row.propertyId(), e.getMessage());
                skipped++;
            }
        }
        log.info("ElasticityRecomputeScheduler tick : {} upserted / {} skipped (total {})",
                upserted, skipped, properties.size());
        return upserted;
    }

    /**
     * Traite une propriete dans une transaction dediee.
     * @return true si une nouvelle estimation a ete upsertee, false si skip (pas assez de donnees)
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean processOne(PropertyTenantRow row) {
        Optional<EmpiricalElasticityEstimator.ElasticityEstimate> estimate =
                estimator.estimate(row.organizationId(), row.propertyId());
        if (estimate.isEmpty()) return false;

        PropertyElasticityEstimate entity = estimateRepository.findByPropertyId(row.propertyId())
                .orElseGet(() -> new PropertyElasticityEstimate(row.propertyId(), 0.0, 0));
        entity.setElasticityValue(estimate.get().elasticity());
        entity.setSampleSize(estimate.get().sampleSize());
        entity.setComputedAt(LocalDateTime.now(clock.withZone(ZoneId.of("UTC"))));
        estimateRepository.save(entity);
        return true;
    }
}
