package com.clenzy.integration.channex.service;

import com.clenzy.integration.channex.client.ChannexClient;
import com.clenzy.integration.channex.config.ChannexProperties;
import com.clenzy.integration.channex.model.ChannexPropertyMapping;
import com.clenzy.integration.channex.model.ChannexSyncStatus;
import com.clenzy.integration.channex.repository.ChannexPropertyMappingRepository;
import com.clenzy.model.NotificationKey;
import com.clenzy.model.Property;
import com.clenzy.repository.BookingRestrictionRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.service.NotificationService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Réconciliation des restrictions Clenzy ↔ OTA (CLZ Domaine 1) : notification sur divergence.
 */
@ExtendWith(MockitoExtension.class)
class ChannexRestrictionReconciliationSchedulerTest {

    @Mock private ChannexPropertyMappingRepository mappingRepository;
    @Mock private ChannexClient channexClient;
    @Mock private BookingRestrictionRepository bookingRestrictionRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private NotificationService notificationService;
    @Mock private ChannexProperties channexProperties;

    private final ObjectMapper mapper = new ObjectMapper();
    private ChannexRestrictionReconciliationScheduler scheduler;

    @BeforeEach
    void setUp() {
        scheduler = new ChannexRestrictionReconciliationScheduler(
            mappingRepository, channexClient, bookingRestrictionRepository, propertyRepository,
            notificationService, channexProperties, new RestrictionDivergenceDetector());
    }

    private ChannexPropertyMapping activeMapping() {
        ChannexPropertyMapping m = new ChannexPropertyMapping();
        m.setClenzyPropertyId(100L);
        m.setOrganizationId(42L);
        m.setChannexPropertyId("chx-prop");
        m.setChannexRoomTypeId("chx-room");
        m.setChannexDefaultRatePlanId("chx-rate");
        m.setSyncStatus(ChannexSyncStatus.ACTIVE);
        return m;
    }

    private JsonNode rateEntry(LocalDate date, Integer minStayThrough) {
        ObjectNode attrs = mapper.createObjectNode();
        attrs.put("date", date.toString());
        if (minStayThrough != null) attrs.put("min_stay_through", minStayThrough);
        ObjectNode entry = mapper.createObjectNode();
        entry.set("attributes", attrs);
        return entry;
    }

    @Test
    void notifiesWhenRemoteRestrictionDivergesFromLocal() {
        when(channexProperties.isConfigured()).thenReturn(true);
        when(mappingRepository.findAllAcrossOrgs()).thenReturn(List.of(activeMapping()));
        Property p = new Property();
        p.setId(100L);
        p.setOrganizationId(42L);
        p.setName("Studio Marais");
        when(propertyRepository.findById(100L)).thenReturn(Optional.of(p));
        // OTA impose min_stay_through=3, aucune restriction locale -> divergence
        when(channexClient.fetchRatesForRange(eq("chx-prop"), eq("chx-rate"), any(), any()))
            .thenReturn(Optional.of(List.of(rateEntry(LocalDate.now().plusDays(1), 3))));
        when(bookingRestrictionRepository.findApplicable(eq(100L), any(), any(), eq(42L)))
            .thenReturn(List.of());

        scheduler.scan();

        verify(notificationService).notifyAdminsAndManagers(
            eq(NotificationKey.CHANNEX_RESTRICTION_DRIFT_DETECTED),
            any(), any(), any(), eq(42L));
    }

    @Test
    void noNotificationWhenNoDivergence() {
        when(channexProperties.isConfigured()).thenReturn(true);
        when(mappingRepository.findAllAcrossOrgs()).thenReturn(List.of(activeMapping()));
        Property p = new Property();
        p.setId(100L);
        p.setOrganizationId(42L);
        when(propertyRepository.findById(100L)).thenReturn(Optional.of(p));
        // OTA sans restriction + aucune restriction locale -> pas de divergence
        when(channexClient.fetchRatesForRange(eq("chx-prop"), eq("chx-rate"), any(), any()))
            .thenReturn(Optional.of(List.of(rateEntry(LocalDate.now().plusDays(1), null))));
        when(bookingRestrictionRepository.findApplicable(eq(100L), any(), any(), eq(42L)))
            .thenReturn(List.of());

        scheduler.scan();

        verify(notificationService, never()).notifyAdminsAndManagers(any(), any(), any(), any(), anyLong());
    }

    @Test
    void skipsWhenChannexNotConfigured() {
        when(channexProperties.isConfigured()).thenReturn(false);

        scheduler.scan();

        verify(mappingRepository, never()).findAllAcrossOrgs();
        verify(notificationService, never()).notifyAdminsAndManagers(any(), any(), any(), any(), anyLong());
    }
}
