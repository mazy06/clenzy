package com.clenzy.service;

import com.clenzy.dto.CreateChannelPromotionRequest;
import com.clenzy.integration.channel.ChannelCapability;
import com.clenzy.integration.channel.ChannelConnector;
import com.clenzy.integration.channel.ChannelConnectorRegistry;
import com.clenzy.integration.channel.ChannelName;
import com.clenzy.integration.channel.SyncResult;
import com.clenzy.model.ChannelPromotion;
import com.clenzy.model.PromotionStatus;
import com.clenzy.model.Property;
import com.clenzy.repository.ChannelPromotionRepository;
import com.clenzy.repository.PropertyRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.DateTimeException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Service d'orchestration des promotions OTA.
 *
 * Gere le CRUD des promotions, la synchronisation bidirectionnelle avec les channels,
 * le push vers les OTAs (Airbnb, Booking.com), et l'expiration automatique.
 *
 * <p>Cycle de statut (audit Z5-BUGS-07) :
 * <ul>
 *   <li>{@code PENDING} — creee / en attente de confirmation OTA, ou push en echec
 *       technique (statut de reconciliation : un toggle/update relance le push) ;</li>
 *   <li>{@code ACTIVE} — confirmee par l'OTA, uniquement APRES commit + push reussi ;</li>
 *   <li>{@code REJECTED} — refusee par l'OTA ;</li>
 *   <li>{@code EXPIRED} — date de fin depassee dans la timezone de la propriete.</li>
 * </ul>
 * Le push HTTP vers l'OTA part toujours APRES le commit de la transaction metier :
 * un rollback ne peut plus laisser une promotion active cote OTA mais absente en base.
 */
@Service
@Transactional(readOnly = true)
public class ChannelPromotionService {

    private static final Logger log = LoggerFactory.getLogger(ChannelPromotionService.class);

    /**
     * Fallback documente (audit Z5-BUGS-08) quand la propriete n'a pas de timezone
     * exploitable : aligne sur le defaut du champ {@code Property.timezone}.
     */
    static final ZoneId DEFAULT_PROPERTY_ZONE = ZoneId.of("Europe/Paris");

    private final ChannelPromotionRepository promotionRepository;
    private final ChannelConnectorRegistry connectorRegistry;
    private final PropertyRepository propertyRepository;
    private final TransactionTemplate postCommitTxTemplate;

    public ChannelPromotionService(ChannelPromotionRepository promotionRepository,
                                   ChannelConnectorRegistry connectorRegistry,
                                   PropertyRepository propertyRepository,
                                   PlatformTransactionManager transactionManager) {
        this.promotionRepository = promotionRepository;
        this.connectorRegistry = connectorRegistry;
        this.propertyRepository = propertyRepository;
        // REQUIRES_NEW : en afterCommit la transaction d'origine est deja commitee,
        // toute ecriture qui la rejoindrait serait perdue (doc Spring
        // TransactionSynchronization#afterCommit).
        TransactionTemplate template = new TransactionTemplate(transactionManager);
        template.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        this.postCommitTxTemplate = template;
    }

    public List<ChannelPromotion> getAll(Long orgId) {
        return promotionRepository.findAllByOrgId(orgId);
    }

    public List<ChannelPromotion> getByProperty(Long propertyId, Long orgId) {
        return promotionRepository.findByPropertyId(propertyId, orgId);
    }

    public ChannelPromotion getById(Long id, Long orgId) {
        return promotionRepository.findByIdAndOrgId(id, orgId)
            .orElseThrow(() -> new IllegalArgumentException("Promotion not found: " + id));
    }

    public List<ChannelPromotion> getActiveByChannel(ChannelName channel, Long orgId) {
        return promotionRepository.findActiveByChannel(channel, PromotionStatus.ACTIVE, orgId);
    }

    /**
     * Cree une promotion et la pousse vers le channel OTA concerne.
     */
    @Transactional
    public ChannelPromotion create(CreateChannelPromotionRequest request, Long orgId) {
        ChannelPromotion promo = new ChannelPromotion();
        promo.setOrganizationId(orgId);
        promo.setPropertyId(request.propertyId());
        promo.setChannelName(request.channelName());
        promo.setPromotionType(request.promotionType());
        promo.setDiscountPercentage(request.discountPercentage());
        promo.setStartDate(request.startDate());
        promo.setEndDate(request.endDate());
        promo.setStatus(PromotionStatus.PENDING);
        if (request.config() != null) {
            promo.setConfig(request.config());
        }

        ChannelPromotion saved = promotionRepository.save(promo);

        // Auto-push vers le channel OTA — APRES commit (Z5-BUGS-07) : l'appel HTTP
        // ne tient plus la connexion DB et un rollback ne peut plus laisser une
        // promotion active cote OTA. La promo reste PENDING jusqu'a confirmation.
        schedulePushAfterCommit(saved.getId(), orgId);

        return saved;
    }

    @Transactional
    public ChannelPromotion update(Long id, Long orgId, CreateChannelPromotionRequest request) {
        ChannelPromotion promo = getById(id, orgId);
        promo.setChannelName(request.channelName());
        promo.setPromotionType(request.promotionType());
        promo.setDiscountPercentage(request.discountPercentage());
        promo.setStartDate(request.startDate());
        promo.setEndDate(request.endDate());
        if (request.config() != null) {
            promo.setConfig(request.config());
        }

        ChannelPromotion saved = promotionRepository.save(promo);

        // Re-push de la promotion mise a jour — APRES commit (Z5-BUGS-07)
        if (promo.getEnabled() && promo.getStatus() == PromotionStatus.ACTIVE) {
            schedulePushAfterCommit(saved.getId(), orgId);
        }

        return saved;
    }

    /**
     * Active/desactive une promotion et pousse le changement vers le channel.
     */
    @Transactional
    public ChannelPromotion togglePromotion(Long id, Long orgId) {
        ChannelPromotion promo = getById(id, orgId);
        promo.setEnabled(!promo.getEnabled());
        if (promo.getEnabled()) {
            // Reste PENDING tant que l'OTA n'a pas confirme : ACTIVE n'est pose
            // qu'apres un push reussi, post-commit (Z5-BUGS-07).
            promo.setStatus(PromotionStatus.PENDING);
            ChannelPromotion saved = promotionRepository.save(promo);
            schedulePushAfterCommit(saved.getId(), orgId);
            return saved;
        }
        promo.setStatus(PromotionStatus.PENDING);
        return promotionRepository.save(promo);
    }

    /**
     * Synchronise les promotions depuis les channels OTA (pull).
     */
    @Transactional
    public void syncWithChannel(Long propertyId, Long orgId) {
        List<ChannelConnector> connectors = connectorRegistry.getConnectorsWithCapability(ChannelCapability.PROMOTIONS);
        for (ChannelConnector connector : connectors) {
            try {
                List<ChannelPromotion> pulled = connector.pullPromotions(propertyId, orgId);
                for (ChannelPromotion promo : pulled) {
                    promo.setOrganizationId(orgId);
                    promo.setPropertyId(propertyId);
                    promo.setSyncedAt(Instant.now());
                    promotionRepository.save(promo);
                }
                if (!pulled.isEmpty()) {
                    log.info("Synced {} promotions from {} for property {}",
                            pulled.size(), connector.getChannelName(), propertyId);
                }
            } catch (Exception e) {
                log.error("Failed to sync promotions from {} for property {}: {}",
                        connector.getChannelName(), propertyId, e.getMessage());
            }
        }
    }

    /**
     * Planifie le push OTA d'une promotion APRES le commit de la transaction
     * courante (audit Z5-BUGS-07). Sans transaction active (tests directs,
     * contexte exotique), le push est execute immediatement.
     */
    private void schedulePushAfterCommit(Long promotionId, Long orgId) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            runDeferredPush(promotionId, orgId);
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                runDeferredPush(promotionId, orgId);
            }
        });
    }

    /**
     * Execute le push dans une transaction NEUVE (REQUIRES_NEW) : la transaction
     * d'origine est deja commitee au moment de l'afterCommit, les ecritures de
     * statut doivent donc ouvrir leur propre transaction pour etre persistees.
     * Toute defaillance est journalisee, la promotion reste en PENDING
     * (statut de reconciliation) — jamais d'etat ACTIVE non confirme par l'OTA.
     */
    private void runDeferredPush(Long promotionId, Long orgId) {
        try {
            postCommitTxTemplate.executeWithoutResult(status -> {
                ChannelPromotion promo = promotionRepository.findByIdAndOrgId(promotionId, orgId).orElse(null);
                if (promo == null) {
                    log.warn("Push post-commit: promotion {} introuvable pour org {}", promotionId, orgId);
                    return;
                }
                pushPromotionToChannel(promo, orgId);
            });
        } catch (Exception e) {
            log.error("Push post-commit promotion {} echoue, statut laisse en attente de reconciliation: {}",
                    promotionId, e.getMessage());
        }
    }

    /**
     * Pousse une promotion vers le channel OTA concerne.
     */
    @Transactional
    public void pushPromotionToChannel(ChannelPromotion promo, Long orgId) {
        Optional<ChannelConnector> connectorOpt = connectorRegistry.getConnector(promo.getChannelName());
        if (connectorOpt.isEmpty()) {
            log.warn("Aucun connecteur disponible pour channel {}", promo.getChannelName());
            return;
        }

        ChannelConnector connector = connectorOpt.get();
        if (!connector.supports(ChannelCapability.PROMOTIONS)) {
            log.debug("Channel {} ne supporte pas les promotions", promo.getChannelName());
            return;
        }

        try {
            SyncResult result = connector.pushPromotion(promo, orgId);
            if (result.getStatus() == SyncResult.Status.SUCCESS) {
                promo.setStatus(PromotionStatus.ACTIVE);
                promo.setSyncedAt(Instant.now());
                promotionRepository.save(promo);
                log.info("Promotion {} pushee vers {} avec succes", promo.getId(), promo.getChannelName());
            } else if (result.getStatus() == SyncResult.Status.FAILED) {
                promo.setStatus(PromotionStatus.REJECTED);
                promotionRepository.save(promo);
                log.error("Promotion {} rejetee par {}: {}", promo.getId(), promo.getChannelName(), result.getMessage());
            }
            // SKIPPED/UNSUPPORTED: leave status as-is
        } catch (Exception e) {
            // Echec technique (reseau, timeout) : retombe en PENDING — statut de
            // reconciliation (Z5-BUGS-07), un toggle/update relancera le push.
            promo.setStatus(PromotionStatus.PENDING);
            promotionRepository.save(promo);
            log.error("Erreur push promotion {} vers {}: {}",
                    promo.getId(), promo.getChannelName(), e.getMessage());
        }
    }

    /**
     * Expire les promotions dont la date de fin est depassee.
     * Planifie : tous les jours a 02:00.
     *
     * <p>« Aujourd'hui » est evalue dans la timezone de CHAQUE propriete (audit
     * Z5-BUGS-08), pas dans celle de la JVM : les candidats sont charges avec la
     * date locale la plus avancee du globe (UTC+14) puis filtres par timezone.</p>
     */
    @Scheduled(cron = "0 0 2 * * *")
    @Transactional
    public void scheduledExpirePromotions() {
        // Process all orgs — cross-tenant scheduled job
        List<ChannelPromotion> candidates = promotionRepository.findAllExpired(latestLocalDateOnEarth());
        int count = expireInPropertyZone(candidates);
        if (count > 0) {
            log.info("PromotionExpiryScheduler: {} promotions expirees", count);
        }
    }

    @Transactional
    public int expireOldPromotions(Long orgId) {
        List<ChannelPromotion> candidates = promotionRepository.findExpired(latestLocalDateOnEarth(), orgId);
        int count = expireInPropertyZone(candidates);
        if (count > 0) {
            log.info("Expired {} promotions for org {}", count, orgId);
        }
        return count;
    }

    /** Passe en EXPIRED les candidats dont la date de fin est depassee dans la timezone de leur propriete. */
    private int expireInPropertyZone(List<ChannelPromotion> candidates) {
        Map<Long, ZoneId> zoneCache = new HashMap<>();
        int count = 0;
        for (ChannelPromotion promo : candidates) {
            if (!isExpiredInPropertyZone(promo, zoneCache)) {
                continue;
            }
            promo.setStatus(PromotionStatus.EXPIRED);
            promotionRepository.save(promo);
            count++;
        }
        return count;
    }

    private boolean isExpiredInPropertyZone(ChannelPromotion promo, Map<Long, ZoneId> zoneCache) {
        if (promo.getEndDate() == null) {
            return false;
        }
        ZoneId zone = promo.getPropertyId() != null
                ? zoneCache.computeIfAbsent(promo.getPropertyId(), this::resolvePropertyZone)
                : DEFAULT_PROPERTY_ZONE;
        return promo.getEndDate().isBefore(LocalDate.now(zone));
    }

    /**
     * Timezone de la propriete ; fallback {@link #DEFAULT_PROPERTY_ZONE} si la
     * propriete est introuvable ou la timezone absente/invalide.
     */
    private ZoneId resolvePropertyZone(Long propertyId) {
        String timezone = propertyRepository.findById(propertyId)
                .map(Property::getTimezone)
                .orElse(null);
        if (timezone == null || timezone.isBlank()) {
            return DEFAULT_PROPERTY_ZONE;
        }
        try {
            return ZoneId.of(timezone);
        } catch (DateTimeException e) {
            log.warn("Timezone invalide '{}' pour property={}, fallback {}",
                    timezone, propertyId, DEFAULT_PROPERTY_ZONE);
            return DEFAULT_PROPERTY_ZONE;
        }
    }

    /**
     * Date locale la plus avancee du globe (UTC+14, ile Kiritimati) : borne haute
     * pour charger les candidats a l'expiration quelle que soit la timezone JVM.
     */
    private static LocalDate latestLocalDateOnEarth() {
        return LocalDate.now(ZoneOffset.ofHours(14));
    }

    @Transactional
    public void delete(Long id, Long orgId) {
        ChannelPromotion promo = getById(id, orgId);
        promotionRepository.delete(promo);
    }
}
