package com.clenzy.service;

import com.clenzy.dto.CreateChannelPromotionRequest;
import com.clenzy.integration.channel.ChannelCapability;
import com.clenzy.integration.channel.ChannelConnector;
import com.clenzy.integration.channel.ChannelConnectorRegistry;
import com.clenzy.integration.channel.ChannelName;
import com.clenzy.integration.channel.SyncResult;
import com.clenzy.model.ChannelPromotion;
import com.clenzy.model.PromotionStatus;
import com.clenzy.repository.ChannelPromotionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * Service d'orchestration des promotions OTA.
 *
 * Gere le CRUD des promotions, la synchronisation bidirectionnelle avec les channels,
 * le push vers les OTAs (Airbnb, Booking.com), et l'expiration automatique.
 */
@Service
@Transactional(readOnly = true)
public class ChannelPromotionService {

    private static final Logger log = LoggerFactory.getLogger(ChannelPromotionService.class);

    private final ChannelPromotionRepository promotionRepository;
    private final ChannelConnectorRegistry connectorRegistry;

    public ChannelPromotionService(ChannelPromotionRepository promotionRepository,
                                   ChannelConnectorRegistry connectorRegistry) {
        this.promotionRepository = promotionRepository;
        this.connectorRegistry = connectorRegistry;
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

        // Auto-push vers le channel OTA
        pushPromotionToChannel(saved, orgId);

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

        // Re-push updated promotion
        if (promo.getEnabled() && promo.getStatus() == PromotionStatus.ACTIVE) {
            pushPromotionToChannel(saved, orgId);
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
            promo.setStatus(PromotionStatus.ACTIVE);
            ChannelPromotion saved = promotionRepository.save(promo);
            pushPromotionToChannel(saved, orgId);
            return saved;
        } else {
            promo.setStatus(PromotionStatus.PENDING);
            return promotionRepository.save(promo);
        }
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
            log.error("Erreur push promotion {} vers {}: {}",
                    promo.getId(), promo.getChannelName(), e.getMessage());
        }
    }

    /**
     * Expire les promotions dont la date de fin est depassee.
     * Planifie : tous les jours a 02:00.
     */
    @Scheduled(cron = "0 0 2 * * *")
    @Transactional
    public void scheduledExpirePromotions() {
        // Process all orgs — cross-tenant scheduled job
        List<ChannelPromotion> expired = promotionRepository.findAllExpired(LocalDate.now());
        int count = 0;
        for (ChannelPromotion promo : expired) {
            promo.setStatus(PromotionStatus.EXPIRED);
            promotionRepository.save(promo);
            count++;
        }
        if (count > 0) {
            log.info("PromotionExpiryScheduler: {} promotions expirees", count);
        }
    }

    @Transactional
    public int expireOldPromotions(Long orgId) {
        List<ChannelPromotion> expired = promotionRepository.findExpired(LocalDate.now(), orgId);
        for (ChannelPromotion promo : expired) {
            promo.setStatus(PromotionStatus.EXPIRED);
            promotionRepository.save(promo);
        }
        if (!expired.isEmpty()) {
            log.info("Expired {} promotions for org {}", expired.size(), orgId);
        }
        return expired.size();
    }

    @Transactional
    public void delete(Long id, Long orgId) {
        ChannelPromotion promo = getById(id, orgId);
        promotionRepository.delete(promo);
    }
}
