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
import com.clenzy.model.Property;
import com.clenzy.repository.ChannelPromotionRepository;
import com.clenzy.repository.PropertyRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.PlatformTransactionManager;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ChannelPromotionServiceTest {

    @Mock private ChannelPromotionRepository promotionRepository;
    @Mock private ChannelConnectorRegistry connectorRegistry;
    @Mock private PropertyRepository propertyRepository;
    @Mock private PlatformTransactionManager transactionManager;

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
    void create_withSuccessfulPush_promotionBecomesActive() {
        // Z5-BUGS-07 : le push part apres le save (post-commit en prod, fallback
        // immediat ici sans transaction) et c'est lui qui pose ACTIVE.
        var request = new CreateChannelPromotionRequest(
            PROPERTY_ID, ChannelName.BOOKING, PromotionType.GENIUS,
            new BigDecimal("15.00"), LocalDate.now(), LocalDate.now().plusMonths(3), null);

        java.util.concurrent.atomic.AtomicReference<ChannelPromotion> savedRef =
            new java.util.concurrent.atomic.AtomicReference<>();
        when(promotionRepository.save(any(ChannelPromotion.class))).thenAnswer(inv -> {
            ChannelPromotion p = inv.getArgument(0);
            p.setId(10L);
            savedRef.set(p);
            return p;
        });
        when(promotionRepository.findByIdAndOrgId(10L, ORG_ID))
            .thenAnswer(inv -> Optional.of(savedRef.get()));

        ChannelConnector connector = mock(ChannelConnector.class);
        when(connectorRegistry.getConnector(ChannelName.BOOKING)).thenReturn(Optional.of(connector));
        when(connector.supports(ChannelCapability.PROMOTIONS)).thenReturn(true);
        SyncResult ok = mock(SyncResult.class);
        when(ok.getStatus()).thenReturn(SyncResult.Status.SUCCESS);
        when(connector.pushPromotion(any(ChannelPromotion.class), eq(ORG_ID))).thenReturn(ok);

        ChannelPromotion result = service.create(request, ORG_ID);

        assertEquals(PromotionStatus.ACTIVE, result.getStatus());
        assertNotNull(result.getSyncedAt());
    }

    @Test
    void create_whenPushThrows_promotionStaysPendingForReconciliation() {
        // Z5-BUGS-07 : echec technique post-commit => la promo reste PENDING
        // (statut de reconciliation), jamais ACTIVE non confirme, pas d'exception.
        var request = new CreateChannelPromotionRequest(
            PROPERTY_ID, ChannelName.BOOKING, PromotionType.GENIUS,
            new BigDecimal("15.00"), LocalDate.now(), LocalDate.now().plusMonths(3), null);

        java.util.concurrent.atomic.AtomicReference<ChannelPromotion> savedRef =
            new java.util.concurrent.atomic.AtomicReference<>();
        when(promotionRepository.save(any(ChannelPromotion.class))).thenAnswer(inv -> {
            ChannelPromotion p = inv.getArgument(0);
            p.setId(10L);
            savedRef.set(p);
            return p;
        });
        when(promotionRepository.findByIdAndOrgId(10L, ORG_ID))
            .thenAnswer(inv -> Optional.of(savedRef.get()));

        ChannelConnector connector = mock(ChannelConnector.class);
        when(connectorRegistry.getConnector(ChannelName.BOOKING)).thenReturn(Optional.of(connector));
        when(connector.supports(ChannelCapability.PROMOTIONS)).thenReturn(true);
        when(connector.pushPromotion(any(ChannelPromotion.class), eq(ORG_ID)))
            .thenThrow(new RuntimeException("OTA timeout"));

        ChannelPromotion result = service.create(request, ORG_ID);

        assertEquals(PromotionStatus.PENDING, result.getStatus());
        assertNull(result.getSyncedAt());
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
    void togglePromotion_disabledToEnabled_staysPendingUntilOtaConfirms() {
        // Z5-BUGS-07 : ACTIVE n'est pose qu'apres confirmation OTA post-commit.
        // Ici le push (fallback immediat, pas de transaction) ne trouve aucun
        // connecteur => la promo reste PENDING, en attente de confirmation.
        samplePromo.setEnabled(false);
        samplePromo.setStatus(PromotionStatus.PENDING);
        when(promotionRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.of(samplePromo));
        when(promotionRepository.save(any(ChannelPromotion.class))).thenAnswer(inv -> inv.getArgument(0));

        ChannelPromotion result = service.togglePromotion(1L, ORG_ID);

        assertTrue(result.getEnabled());
        assertEquals(PromotionStatus.PENDING, result.getStatus());
        verify(connectorRegistry).getConnector(ChannelName.BOOKING); // push bien tente
    }

    @Test
    void togglePromotion_enabledWithSuccessfulPush_becomesActive() {
        samplePromo.setEnabled(false);
        samplePromo.setStatus(PromotionStatus.PENDING);
        when(promotionRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.of(samplePromo));
        when(promotionRepository.save(any(ChannelPromotion.class))).thenAnswer(inv -> inv.getArgument(0));

        ChannelConnector connector = mock(ChannelConnector.class);
        when(connectorRegistry.getConnector(ChannelName.BOOKING)).thenReturn(Optional.of(connector));
        when(connector.supports(ChannelCapability.PROMOTIONS)).thenReturn(true);
        SyncResult ok = mock(SyncResult.class);
        when(ok.getStatus()).thenReturn(SyncResult.Status.SUCCESS);
        when(connector.pushPromotion(samplePromo, ORG_ID)).thenReturn(ok);

        ChannelPromotion result = service.togglePromotion(1L, ORG_ID);

        assertTrue(result.getEnabled());
        assertEquals(PromotionStatus.ACTIVE, result.getStatus());
        assertNotNull(result.getSyncedAt());
    }

    @Test
    void expireOldPromotions_expiresAndReturnsCount() {
        // endDate largement passee (toutes timezones) ; propertyId null => zone fallback
        ChannelPromotion expired1 = new ChannelPromotion();
        expired1.setStatus(PromotionStatus.ACTIVE);
        expired1.setEndDate(LocalDate.now().minusDays(5));
        ChannelPromotion expired2 = new ChannelPromotion();
        expired2.setStatus(PromotionStatus.ACTIVE);
        expired2.setEndDate(LocalDate.now().minusDays(5));

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
    void pushPromotionToChannel_exception_fallsBackToPendingForReconciliation() {
        ChannelConnector connector = mock(ChannelConnector.class);
        when(connectorRegistry.getConnector(ChannelName.BOOKING)).thenReturn(Optional.of(connector));
        when(connector.supports(ChannelCapability.PROMOTIONS)).thenReturn(true);
        when(connector.pushPromotion(samplePromo, ORG_ID)).thenThrow(new RuntimeException("push error"));

        // Should not throw — Z5-BUGS-07 : echec technique => statut de reconciliation
        service.pushPromotionToChannel(samplePromo, ORG_ID);

        assertEquals(PromotionStatus.PENDING, samplePromo.getStatus());
        verify(promotionRepository).save(samplePromo);
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
        p1.setEndDate(LocalDate.now().minusDays(5));
        ChannelPromotion p2 = new ChannelPromotion();
        p2.setStatus(PromotionStatus.ACTIVE);
        p2.setEndDate(LocalDate.now().minusDays(5));
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

    // ====== EXPIRATION — timezone propriete (Z5-BUGS-08) ======

    @Test
    void whenEndDateIsTodayInPropertyTimezone_thenPromotionStaysActive() {
        // Arrange : propriete a Pago Pago (UTC-11), endDate = aujourd'hui la-bas.
        // Une JVM en UTC/Paris (date locale potentiellement +1) l'aurait expiree a tort.
        ZoneId pagoPago = ZoneId.of("Pacific/Pago_Pago");
        Property property = new Property();
        property.setTimezone("Pacific/Pago_Pago");

        ChannelPromotion promo = new ChannelPromotion();
        promo.setStatus(PromotionStatus.ACTIVE);
        promo.setPropertyId(PROPERTY_ID);
        promo.setEndDate(LocalDate.now(pagoPago));

        when(promotionRepository.findAllExpired(any(LocalDate.class))).thenReturn(List.of(promo));
        when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(property));

        // Act
        service.scheduledExpirePromotions();

        // Assert : pas encore expiree dans la timezone de la propriete
        assertEquals(PromotionStatus.ACTIVE, promo.getStatus());
        verify(promotionRepository, never()).save(any());
    }

    @Test
    void whenEndDateIsPastInPropertyTimezone_thenPromotionExpires() {
        ZoneId pagoPago = ZoneId.of("Pacific/Pago_Pago");
        Property property = new Property();
        property.setTimezone("Pacific/Pago_Pago");

        ChannelPromotion promo = new ChannelPromotion();
        promo.setStatus(PromotionStatus.ACTIVE);
        promo.setPropertyId(PROPERTY_ID);
        promo.setEndDate(LocalDate.now(pagoPago).minusDays(1));

        when(promotionRepository.findAllExpired(any(LocalDate.class))).thenReturn(List.of(promo));
        when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(property));
        when(promotionRepository.save(any(ChannelPromotion.class))).thenAnswer(inv -> inv.getArgument(0));

        service.scheduledExpirePromotions();

        assertEquals(PromotionStatus.EXPIRED, promo.getStatus());
    }

    @Test
    void whenPropertyTimezoneInvalid_thenFallsBackToEuropeParis() {
        Property property = new Property();
        property.setTimezone("Mars/Olympus");

        ChannelPromotion promo = new ChannelPromotion();
        promo.setStatus(PromotionStatus.ACTIVE);
        promo.setPropertyId(PROPERTY_ID);
        promo.setEndDate(LocalDate.now(ZoneId.of("Europe/Paris")).minusDays(1));

        when(promotionRepository.findAllExpired(any(LocalDate.class))).thenReturn(List.of(promo));
        when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(property));
        when(promotionRepository.save(any(ChannelPromotion.class))).thenAnswer(inv -> inv.getArgument(0));

        service.scheduledExpirePromotions();

        // Fallback Europe/Paris : la promo d'hier (Paris) est bien expiree, sans crash
        assertEquals(PromotionStatus.EXPIRED, promo.getStatus());
    }
}
