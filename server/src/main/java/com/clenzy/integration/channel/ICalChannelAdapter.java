package com.clenzy.integration.channel;

import com.clenzy.integration.channel.model.ChannelMapping;
import com.clenzy.integration.channel.repository.ChannelMappingRepository;
import com.clenzy.model.ICalFeed;
import com.clenzy.repository.ICalFeedRepository;
import com.clenzy.service.ICalImportService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * Adaptateur ChannelConnector pour les feeds iCal.
 *
 * iCal est un channel read-only (INBOUND seulement) :
 * - Import de reservations depuis un feed .ics
 * - Pas de push (pas d'API d'ecriture sur un feed iCal)
 * - Sync par polling periodique (pas de webhooks)
 *
 * Delegue a l'ICalImportService existant.
 */
@Component
public class ICalChannelAdapter implements ChannelConnector {

    private static final Logger log = LoggerFactory.getLogger(ICalChannelAdapter.class);

    private final ICalImportService iCalImportService;
    private final ICalFeedRepository iCalFeedRepository;
    private final ChannelMappingRepository channelMappingRepository;

    public ICalChannelAdapter(ICalImportService iCalImportService,
                              ICalFeedRepository iCalFeedRepository,
                              ChannelMappingRepository channelMappingRepository) {
        this.iCalImportService = iCalImportService;
        this.iCalFeedRepository = iCalFeedRepository;
        this.channelMappingRepository = channelMappingRepository;
    }

    @Override
    public ChannelName getChannelName() {
        return ChannelName.ICAL;
    }

    @Override
    public Set<ChannelCapability> getCapabilities() {
        return EnumSet.of(
                ChannelCapability.INBOUND_CALENDAR,
                ChannelCapability.INBOUND_RESERVATIONS,
                ChannelCapability.POLLING
        );
    }

    @Override
    public Optional<ChannelMapping> resolveMapping(Long propertyId, Long orgId) {
        return channelMappingRepository.findByPropertyIdAndChannel(
                propertyId, ChannelName.ICAL, orgId);
    }

    /**
     * Traite un evenement inbound iCal (typiquement un resultat de poll).
     * Le eventType est "ical.poll" et data contient la propertyId + feedUrl.
     *
     * Delegue a ICalImportService.syncFeeds() pour un import on-demand
     * programmatique (sans contexte utilisateur keycloak).
     */
    @Override
    public void handleInboundEvent(String eventType, Map<String, Object> data, Long orgId) {
        log.debug("ICalChannelAdapter.handleInboundEvent: type={}", eventType);

        if ("ical.poll".equals(eventType)) {
            Object feedUrlObj = data.get("feedUrl");
            Object propertyIdObj = data.get("propertyId");

            if (feedUrlObj == null || propertyIdObj == null) {
                log.warn("ICalChannelAdapter: event ical.poll incomplet, feedUrl={}, propertyId={}",
                        feedUrlObj, propertyIdObj);
                return;
            }

            String feedUrl = feedUrlObj.toString();
            Long propertyId;
            try {
                propertyId = Long.valueOf(propertyIdObj.toString());
            } catch (NumberFormatException e) {
                log.warn("ICalChannelAdapter: propertyId invalide: {}", propertyIdObj);
                return;
            }

            // Chercher le feed existant par propertyId + URL
            ICalFeed feed = iCalFeedRepository.findByPropertyIdAndUrl(propertyId, feedUrl, orgId);
            if (feed == null) {
                log.warn("ICalChannelAdapter: aucun feed iCal trouve pour propriete {} url {}",
                        propertyId, feedUrl);
                return;
            }

            log.info("ICalChannelAdapter: import on-demand pour propriete {} depuis {}",
                    propertyId, feedUrl);
            iCalImportService.syncFeeds(List.of(feed));
        }
    }

    // pushCalendarUpdate() et pushReservationUpdate() restent default (UNSUPPORTED)
    // iCal est read-only

    @Override
    public HealthStatus checkHealth(Long connectionId) {
        // iCal n'a pas de connexion persistante, juste des URLs
        return HealthStatus.HEALTHY;
    }
}
