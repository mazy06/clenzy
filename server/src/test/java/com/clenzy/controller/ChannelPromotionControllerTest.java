package com.clenzy.controller;

import com.clenzy.dto.ChannelPromotionDto;
import com.clenzy.dto.CreateChannelPromotionRequest;
import com.clenzy.integration.channel.ChannelName;
import com.clenzy.model.ChannelPromotion;
import com.clenzy.model.PromotionType;
import com.clenzy.service.ChannelPromotionService;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ChannelPromotionControllerTest {

    @Mock private ChannelPromotionService promotionService;
    @Mock private TenantContext tenantContext;

    @InjectMocks
    private ChannelPromotionController controller;

    @BeforeEach
    void setUp() {
        lenient().when(tenantContext.getOrganizationId()).thenReturn(7L);
    }

    @Test
    void list_withoutPropertyId_returnsAll() {
        ChannelPromotion p = mockPromotion(1L);
        when(promotionService.getAll(7L)).thenReturn(List.of(p));

        List<ChannelPromotionDto> result = controller.list(null);

        assertEquals(1, result.size());
        assertEquals(1L, result.get(0).id());
        verify(promotionService).getAll(7L);
        verify(promotionService, never()).getByProperty(anyLong(), anyLong());
    }

    @Test
    void list_withPropertyId_filtersByProperty() {
        ChannelPromotion p = mockPromotion(2L);
        when(promotionService.getByProperty(100L, 7L)).thenReturn(List.of(p));

        List<ChannelPromotionDto> result = controller.list(100L);

        assertEquals(1, result.size());
        assertEquals(2L, result.get(0).id());
        verify(promotionService).getByProperty(100L, 7L);
    }

    @Test
    void getById_returnsPromotion() {
        ChannelPromotion p = mockPromotion(3L);
        when(promotionService.getById(3L, 7L)).thenReturn(p);

        ChannelPromotionDto dto = controller.getById(3L);

        assertEquals(3L, dto.id());
    }

    @Test
    void create_delegatesToService() {
        CreateChannelPromotionRequest req = new CreateChannelPromotionRequest(
            100L, ChannelName.AIRBNB, PromotionType.FLASH_SALE,
            BigDecimal.TEN, LocalDate.now(), LocalDate.now().plusDays(7), null);
        ChannelPromotion p = mockPromotion(5L);
        when(promotionService.create(req, 7L)).thenReturn(p);

        ChannelPromotionDto dto = controller.create(req);

        assertEquals(5L, dto.id());
    }

    @Test
    void update_delegatesToService() {
        CreateChannelPromotionRequest req = new CreateChannelPromotionRequest(
            100L, ChannelName.AIRBNB, PromotionType.EARLY_BIRD_OTA,
            null, null, null, null);
        ChannelPromotion p = mockPromotion(8L);
        when(promotionService.update(8L, 7L, req)).thenReturn(p);

        ChannelPromotionDto dto = controller.update(8L, req);

        assertEquals(8L, dto.id());
    }

    @Test
    void toggle_callsTogglePromotion() {
        ChannelPromotion p = mockPromotion(9L);
        when(promotionService.togglePromotion(9L, 7L)).thenReturn(p);

        ChannelPromotionDto dto = controller.toggle(9L);

        assertEquals(9L, dto.id());
    }

    @Test
    void sync_callsService() {
        controller.sync(100L);
        verify(promotionService).syncWithChannel(100L, 7L);
    }

    @Test
    void delete_callsService() {
        controller.delete(5L);
        verify(promotionService).delete(5L, 7L);
    }

    private ChannelPromotion mockPromotion(Long id) {
        ChannelPromotion p = mock(ChannelPromotion.class);
        when(p.getId()).thenReturn(id);
        return p;
    }
}
