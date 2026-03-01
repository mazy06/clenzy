package com.clenzy.service;

import com.clenzy.dto.CreateChannelContentMappingRequest;
import com.clenzy.integration.channel.ChannelCapability;
import com.clenzy.integration.channel.ChannelConnector;
import com.clenzy.integration.channel.ChannelConnectorRegistry;
import com.clenzy.integration.channel.SyncResult;
import com.clenzy.model.ChannelContentMapping;
import com.clenzy.repository.ChannelContentMappingRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Service
@Transactional(readOnly = true)
public class ChannelContentService {

    private static final Logger log = LoggerFactory.getLogger(ChannelContentService.class);

    private final ChannelContentMappingRepository contentRepository;
    private final ChannelConnectorRegistry connectorRegistry;

    public ChannelContentService(ChannelContentMappingRepository contentRepository,
                                  ChannelConnectorRegistry connectorRegistry) {
        this.contentRepository = contentRepository;
        this.connectorRegistry = connectorRegistry;
    }

    public List<ChannelContentMapping> getAll(Long orgId) {
        return contentRepository.findAllByOrgId(orgId);
    }

    public List<ChannelContentMapping> getByProperty(Long propertyId, Long orgId) {
        return contentRepository.findByPropertyId(propertyId, orgId);
    }

    public ChannelContentMapping getById(Long id, Long orgId) {
        return contentRepository.findByIdAndOrgId(id, orgId)
            .orElseThrow(() -> new IllegalArgumentException("Content mapping not found: " + id));
    }

    @Transactional
    public ChannelContentMapping create(CreateChannelContentMappingRequest request, Long orgId) {
        ChannelContentMapping content = new ChannelContentMapping();
        content.setOrganizationId(orgId);
        content.setPropertyId(request.propertyId());
        content.setChannelName(request.channelName());
        applyFields(content, request);
        content.setSyncStatus("PENDING");

        ChannelContentMapping saved = contentRepository.save(content);
        pushContentToChannel(saved, orgId);
        return saved;
    }

    @Transactional
    public ChannelContentMapping update(Long id, Long orgId, CreateChannelContentMappingRequest request) {
        ChannelContentMapping content = getById(id, orgId);
        applyFields(content, request);

        ChannelContentMapping saved = contentRepository.save(content);
        pushContentToChannel(saved, orgId);
        return saved;
    }

    @Transactional
    public void delete(Long id, Long orgId) {
        ChannelContentMapping content = getById(id, orgId);
        contentRepository.delete(content);
    }

    @Transactional
    public void syncWithChannel(Long propertyId, Long orgId) {
        List<ChannelConnector> connectors = connectorRegistry.getConnectorsWithCapability(ChannelCapability.CONTENT_SYNC);
        for (ChannelConnector connector : connectors) {
            try {
                SyncResult result = connector.pullContent(propertyId, orgId);
                if (result.isSuccess()) {
                    log.info("Content pulled from {} for property {}", connector.getChannelName(), propertyId);
                }
            } catch (Exception e) {
                log.error("Failed to pull content from {} for property {}: {}",
                        connector.getChannelName(), propertyId, e.getMessage());
            }
        }
    }

    @Transactional
    public void pushContentToChannel(ChannelContentMapping content, Long orgId) {
        Optional<ChannelConnector> connectorOpt = connectorRegistry.getConnector(content.getChannelName());
        if (connectorOpt.isEmpty()) {
            log.warn("No connector available for channel {}", content.getChannelName());
            return;
        }

        ChannelConnector connector = connectorOpt.get();
        if (!connector.supports(ChannelCapability.CONTENT_SYNC)) {
            log.debug("Channel {} does not support content sync", content.getChannelName());
            return;
        }

        try {
            SyncResult result = connector.pushContent(content, orgId);
            if (result.getStatus() == SyncResult.Status.SUCCESS) {
                content.setSyncStatus("SYNCED");
                content.setSyncedAt(Instant.now());
                contentRepository.save(content);
                log.info("Content mapping {} pushed to {} successfully", content.getId(), content.getChannelName());
            } else if (result.isFailed()) {
                content.setSyncStatus("FAILED");
                contentRepository.save(content);
                log.error("Content mapping {} rejected by {}: {}", content.getId(), content.getChannelName(), result.getMessage());
            }
        } catch (Exception e) {
            log.error("Error pushing content mapping {} to {}: {}", content.getId(), content.getChannelName(), e.getMessage());
        }
    }

    private void applyFields(ChannelContentMapping c, CreateChannelContentMappingRequest r) {
        c.setTitle(r.title());
        c.setDescription(r.description());
        if (r.amenities() != null) c.setAmenities(r.amenities());
        if (r.photoUrls() != null) c.setPhotoUrls(r.photoUrls());
        c.setPropertyType(r.propertyType());
        c.setBedrooms(r.bedrooms());
        c.setBathrooms(r.bathrooms());
        c.setMaxGuests(r.maxGuests());
        if (r.config() != null) c.setConfig(r.config());
    }
}
