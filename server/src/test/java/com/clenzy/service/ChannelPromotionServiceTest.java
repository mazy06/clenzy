package com.clenzy.service;

import com.clenzy.dto.CreateChannelPromotionRequest;
import com.clenzy.integration.channel.ChannelCapability;
import com.clenzy.integration.channel.ChannelConnector;
import com.clenzy.integration.channel.ChannelConnectorRegistry;
import com.clenzy.integration.channel.ChannelName;
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
}
