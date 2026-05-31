package com.clenzy.service;

import com.clenzy.dto.CreateChannelPromotionRequest;
import com.clenzy.integration.channel.ChannelCapability;
import com.clenzy.integration.channel.ChannelConnector;
import com.clenzy.integration.channel.ChannelConnectorRegistry;
import com.clenzy.integration.channel.ChannelName;
import com.clenzy.integration.channel.SyncResult;
import com.clenzy.model.ChannelPromotion;
import com.clenzy.model.PromotionStatus;
import com.clenzy.model.PromotionType;
import com.clenzy.repository.ChannelPromotionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ChannelPromotionServiceTest {

    @Mock private ChannelPromotionRepository promotionRepository;
    @Mock private ChannelConnectorRegistry connectorRegistry;

    @InjectMocks
    private ChannelPromotionService service;

    private static final Long ORG_ID = 1L;
    private static final Long PROPERTY_ID = 100L;

    private ChannelPromotion samplePromo;

    @BeforeEach
    void setUp() {
        samplePromo = new ChannelPromotion();
        samplePromo.setId(1L);
        samplePromo.setOrganizationId(ORG_ID);
        samplePromo.setPropertyId(PROPERTY_ID);
        samplePromo.setChannelName(ChannelName.BOOKING);
        samplePromo.setPromotionType(PromotionType.GENIUS);
        samplePromo.setEnabled(true);
        samplePromo.setStatus(PromotionStatus.ACTIVE);
        samplePromo.setDiscountPercentage(new BigDecimal("10.00"));
        samplePromo.setStartDate(LocalDate.of(2025, 7, 1));
        samplePromo.setEndDate(LocalDate.of(2025, 12, 31));
    }

    @Test
    void create_setsFieldsAndSaves() {
        var request = new CreateChannelPromotionRequest(
            PROPERTY_ID, ChannelName.BOOKING, PromotionType.GENIUS,
            new BigDecimal("15.00"), LocalDate.now(), LocalDate.now().plusMonths(3), null);

        when(promotionRepository.save(any(ChannelPromotion.class)))
            .thenAnswer(inv -> {
                ChannelPromotion p = inv.getArgument(0);
                p.setId(10L);
                return p;
            });

        ChannelPromotion result = service.create(request, ORG_ID);

        assertNotNull(result);
        assertEquals(ORG_ID, result.getOrganizationId());
        assertEquals(PROPERTY_ID, result.getPropertyId());
        assertEquals(PromotionType.GENIUS, result.getPromotionType());
        assertEquals(PromotionStatus.PENDING, result.getStatus());
        assertEquals(new BigDecimal("15.00"), result.getDiscountPercentage());
    }

    @Test
    void getById_found_returnsPromotion() {
        when(promotionRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.of(samplePromo));

        ChannelPromotion result = service.getById(1L, ORG_ID);

        assertEquals(samplePromo, result);
    }

    @Test
    void getById_notFound_throws() {
        when(promotionRepository.findByIdAndOrgId(999L, ORG_ID)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () -> service.getById(999L, ORG_ID));
    }

    @Test
    void togglePromotion_enabledToDisabled() {
        samplePromo.setEnabled(true);
        when(promotionRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.of(samplePromo));
        when(promotionRepository.save(any(ChannelPromotion.class))).thenAnswer(inv -> inv.getArgument(0));

        ChannelPromotion result = service.togglePromotion(1L, ORG_ID);

        assertFalse(result.getEnabled());
        assertEquals(PromotionStatus.PENDING, result.getStatus());
    }

    @Test
    void togglePromotion_disabledToEnabled() {
        samplePromo.setEnabled(false);
        samplePromo.setStatus(PromotionStatus.PENDING);
        when(promotionRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.of(samplePromo));
        when(promotionRepository.save(any(ChannelPromotion.class))).thenAnswer(inv -> inv.getArgument(0));

        ChannelPromotion result = service.togglePromotion(1L, ORG_ID);

        assertTrue(result.getEnabled());
        assertEquals(PromotionStatus.ACTIVE, result.getStatus());
    }

    @Test
    void expireOldPromotions_expiresAndReturnsCount() {
        ChannelPromotion expired1 = new ChannelPromotion();
        expired1.setStatus(PromotionStatus.ACTIVE);
        ChannelPromotion expired2 = new ChannelPromotion();
        expired2.setStatus(PromotionStatus.ACTIVE);

        when(promotionRepository.findExpired(any(LocalDate.class), eq(ORG_ID)))
            .thenReturn(List.of(expired1, expired2));
        when(promotionRepository.save(any(ChannelPromotion.class))).thenAnswer(inv -> inv.getArgument(0));

        int count = service.expireOldPromotions(ORG_ID);

        assertEquals(2, count);
        assertEquals(PromotionStatus.EXPIRED, expired1.getStatus());
        assertEquals(PromotionStatus.EXPIRED, expired2.getStatus());
    }

    @Test
    void syncWithChannel_pullsFromConnectors() {
        ChannelConnector connector = mock(ChannelConnector.class);
        ChannelPromotion pulled = new ChannelPromotion();
        pulled.setPromotionType(PromotionType.FLASH_SALE);

        when(connectorRegistry.getConnectorsWithCapability(ChannelCapability.PROMOTIONS))
            .thenReturn(List.of(connector));
        when(connector.getChannelName()).thenReturn(ChannelName.BOOKING);
        when(connector.pullPromotions(PROPERTY_ID, ORG_ID)).thenReturn(List.of(pulled));
        when(promotionRepository.save(any(ChannelPromotion.class))).thenAnswer(inv -> inv.getArgument(0));

        service.syncWithChannel(PROPERTY_ID, ORG_ID);

        assertEquals(ORG_ID, pulled.getOrganizationId());
        assertEquals(PROPERTY_ID, pulled.getPropertyId());
        assertNotNull(pulled.getSyncedAt());
        verify(promotionRepository).save(pulled);
    }

    // ====== EXTENDED: Read-only API ======

    @Test
    void getAll_delegatesToRepository() {
        when(promotionRepository.findAllByOrgId(ORG_ID)).thenReturn(List.of(samplePromo));

        List<ChannelPromotion> result = service.getAll(ORG_ID);

        assertEquals(1, result.size());
        verify(promotionRepository).findAllByOrgId(ORG_ID);
    }

    @Test
    void getByProperty_delegatesToRepository() {
        when(promotionRepository.findByPropertyId(PROPERTY_ID, ORG_ID)).thenReturn(List.of(samplePromo));

        List<ChannelPromotion> result = service.getByProperty(PROPERTY_ID, ORG_ID);

        assertEquals(1, result.size());
    }

    @Test
    void getActiveByChannel_delegatesToRepository() {
        when(promotionRepository.findActiveByChannel(ChannelName.BOOKING, PromotionStatus.ACTIVE, ORG_ID))
            .thenReturn(List.of(samplePromo));

        List<ChannelPromotion> result = service.getActiveByChannel(ChannelName.BOOKING, ORG_ID);

        assertEquals(1, result.size());
    }

    // ====== UPDATE ======

    @Test
    void update_overwritesFieldsAndSaves() {
        when(promotionRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.of(samplePromo));
        when(promotionRepository.save(any(ChannelPromotion.class))).thenAnswer(inv -> inv.getArgument(0));

        var request = new CreateChannelPromotionRequest(
            PROPERTY_ID, ChannelName.AIRBNB, PromotionType.EARLY_BIRD_OTA,
            new BigDecimal("25.00"), LocalDate.now(), LocalDate.now().plusMonths(1), java.util.Map.of("k", "v"));

        ChannelPromotion result = service.update(1L, ORG_ID, request);

        assertEquals(ChannelName.AIRBNB, result.getChannelName());
        assertEquals(PromotionType.EARLY_BIRD_OTA, result.getPromotionType());
        assertEquals(new BigDecimal("25.00"), result.getDiscountPercentage());
        assertEquals(java.util.Map.of("k", "v"), result.getConfig());
    }

    @Test
    void update_withDisabledPromo_doesNotPush() {
        samplePromo.setEnabled(false);
        when(promotionRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.of(samplePromo));
        when(promotionRepository.save(any(ChannelPromotion.class))).thenAnswer(inv -> inv.getArgument(0));

        var request = new CreateChannelPromotionRequest(
            PROPERTY_ID, ChannelName.BOOKING, PromotionType.GENIUS,
            new BigDecimal("10"), LocalDate.now(), LocalDate.now().plusDays(30), null);

        service.update(1L, ORG_ID, request);

        verifyNoInteractions(connectorRegistry);
    }

    // ====== DELETE ======

    @Test
    void delete_removesPromotion() {
        when(promotionRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.of(samplePromo));

        service.delete(1L, ORG_ID);

        verify(promotionRepository).delete(samplePromo);
    }

    // ====== PUSH TO CHANNEL ======

    @Test
    void pushPromotionToChannel_noConnector_logsAndReturns() {
        when(connectorRegistry.getConnector(ChannelName.BOOKING)).thenReturn(Optional.empty());

        service.pushPromotionToChannel(samplePromo, ORG_ID);

        verifyNoInteractions(promotionRepository);
    }

    @Test
    void pushPromotionToChannel_capabilityNotSupported_returns() {
        ChannelConnector connector = mock(ChannelConnector.class);
        when(connectorRegistry.getConnector(ChannelName.BOOKING)).thenReturn(Optional.of(connector));
        when(connector.supports(ChannelCapability.PROMOTIONS)).thenReturn(false);

        service.pushPromotionToChannel(samplePromo, ORG_ID);

        verify(connector, never()).pushPromotion(any(), anyLong());
        verifyNoInteractions(promotionRepository);
    }

    @Test
    void pushPromotionToChannel_success_setsActiveAndSaves() {
        ChannelConnector connector = mock(ChannelConnector.class);
        when(connectorRegistry.getConnector(ChannelName.BOOKING)).thenReturn(Optional.of(connector));
        when(connector.supports(ChannelCapability.PROMOTIONS)).thenReturn(true);
        SyncResult ok = mock(SyncResult.class);
        when(ok.getStatus()).thenReturn(SyncResult.Status.SUCCESS);
        when(connector.pushPromotion(samplePromo, ORG_ID)).thenReturn(ok);

        service.pushPromotionToChannel(samplePromo, ORG_ID);

        assertEquals(PromotionStatus.ACTIVE, samplePromo.getStatus());
        assertNotNull(samplePromo.getSyncedAt());
        verify(promotionRepository).save(samplePromo);
    }

    @Test
    void pushPromotionToChannel_failed_setsRejected() {
        ChannelConnector connector = mock(ChannelConnector.class);
        when(connectorRegistry.getConnector(ChannelName.BOOKING)).thenReturn(Optional.of(connector));
        when(connector.supports(ChannelCapability.PROMOTIONS)).thenReturn(true);
        SyncResult ko = mock(SyncResult.class);
        when(ko.getStatus()).thenReturn(SyncResult.Status.FAILED);
        when(ko.getMessage()).thenReturn("rejected by OTA");
        when(connector.pushPromotion(samplePromo, ORG_ID)).thenReturn(ko);

        service.pushPromotionToChannel(samplePromo, ORG_ID);

        assertEquals(PromotionStatus.REJECTED, samplePromo.getStatus());
        verify(promotionRepository).save(samplePromo);
    }

    @Test
    void pushPromotionToChannel_skipped_leavesStatus() {
        ChannelConnector connector = mock(ChannelConnector.class);
        when(connectorRegistry.getConnector(ChannelName.BOOKING)).thenReturn(Optional.of(connector));
        when(connector.supports(ChannelCapability.PROMOTIONS)).thenReturn(true);
        SyncResult skipped = mock(SyncResult.class);
        when(skipped.getStatus()).thenReturn(SyncResult.Status.SKIPPED);
        when(connector.pushPromotion(samplePromo, ORG_ID)).thenReturn(skipped);

        service.pushPromotionToChannel(samplePromo, ORG_ID);

        assertEquals(PromotionStatus.ACTIVE, samplePromo.getStatus()); // unchanged
        verify(promotionRepository, never()).save(any());
    }

    @Test
    void pushPromotionToChannel_exception_swallowed() {
        ChannelConnector connector = mock(ChannelConnector.class);
        when(connectorRegistry.getConnector(ChannelName.BOOKING)).thenReturn(Optional.of(connector));
        when(connector.supports(ChannelCapability.PROMOTIONS)).thenReturn(true);
        when(connector.pushPromotion(samplePromo, ORG_ID)).thenThrow(new RuntimeException("push error"));

        // Should not throw
        service.pushPromotionToChannel(samplePromo, ORG_ID);
    }

    // ====== SYNC WITH CHANNEL — error path ======

    @Test
    void syncWithChannel_exception_loggedAndContinues() {
        ChannelConnector connector = mock(ChannelConnector.class);
        when(connectorRegistry.getConnectorsWithCapability(ChannelCapability.PROMOTIONS))
            .thenReturn(List.of(connector));
        when(connector.getChannelName()).thenReturn(ChannelName.BOOKING);
        when(connector.pullPromotions(PROPERTY_ID, ORG_ID)).thenThrow(new RuntimeException("sync error"));

        // Should not throw
        service.syncWithChannel(PROPERTY_ID, ORG_ID);
    }

    // ====== SCHEDULED EXPIRE ======

    @Test
    void scheduledExpirePromotions_expiresAll() {
        ChannelPromotion p1 = new ChannelPromotion();
        p1.setStatus(PromotionStatus.ACTIVE);
        ChannelPromotion p2 = new ChannelPromotion();
        p2.setStatus(PromotionStatus.ACTIVE);
        when(promotionRepository.findAllExpired(any(LocalDate.class))).thenReturn(List.of(p1, p2));

        service.scheduledExpirePromotions();

        assertEquals(PromotionStatus.EXPIRED, p1.getStatus());
        assertEquals(PromotionStatus.EXPIRED, p2.getStatus());
        verify(promotionRepository, times(2)).save(any());
    }

    @Test
    void scheduledExpirePromotions_noExpired_logsNothing() {
        when(promotionRepository.findAllExpired(any(LocalDate.class))).thenReturn(List.of());

        service.scheduledExpirePromotions();

        verify(promotionRepository, never()).save(any());
    }
}
