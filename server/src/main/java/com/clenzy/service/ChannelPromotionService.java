package com.clenzy.service;

import com.clenzy.dto.CreateChannelPromotionRequest;
import com.clenzy.integration.channel.ChannelCapability;
import com.clenzy.integration.channel.ChannelConnector;
import com.clenzy.integration.channel.ChannelConnectorRegistry;
import com.clenzy.integration.channel.ChannelName;
import com.clenzy.model.ChannelPromotion;
import com.clenzy.model.PromotionStatus;
import com.clenzy.repository.ChannelPromotionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

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
        return promotionRepository.save(promo);
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
        return promotionRepository.save(promo);
    }

    @Transactional
    public ChannelPromotion togglePromotion(Long id, Long orgId) {
        ChannelPromotion promo = getById(id, orgId);
        promo.setEnabled(!promo.getEnabled());
        if (promo.getEnabled()) {
            promo.setStatus(PromotionStatus.ACTIVE);
        } else {
            promo.setStatus(PromotionStatus.PENDING);
        }
        return promotionRepository.save(promo);
    }

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
                log.info("Synced {} promotions from {} for property {}", pulled.size(), connector.getChannelName(), propertyId);
            } catch (Exception e) {
                log.error("Failed to sync promotions from {} for property {}: {}", connector.getChannelName(), propertyId, e.getMessage());
            }
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
