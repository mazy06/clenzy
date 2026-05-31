package com.clenzy.service;

import com.clenzy.dto.PricingConfigDto;
import com.clenzy.dto.inventory.GenerateLaundryQuoteRequest;
import com.clenzy.dto.inventory.LaundryQuoteDto;
import com.clenzy.dto.inventory.PropertyInventoryItemDto;
import com.clenzy.dto.inventory.PropertyLaundryItemDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.LaundryQuote;
import com.clenzy.model.LaundryQuoteStatus;
import com.clenzy.model.PropertyInventoryItem;
import com.clenzy.model.PropertyLaundryItem;
import com.clenzy.repository.LaundryQuoteRepository;
import com.clenzy.repository.PropertyInventoryItemRepository;
import com.clenzy.repository.PropertyLaundryItemRepository;
import com.clenzy.tenant.TenantContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PropertyInventoryServiceTest {

    @Mock private PropertyInventoryItemRepository inventoryRepo;
    @Mock private PropertyLaundryItemRepository laundryRepo;
    @Mock private LaundryQuoteRepository quoteRepo;
    @Mock private PricingConfigService pricingConfigService;
    @Mock private TenantContext tenantContext;

    private PropertyInventoryService service;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        service = new PropertyInventoryService(
                inventoryRepo, laundryRepo, quoteRepo, pricingConfigService,
                tenantContext, objectMapper);
        lenient().when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        lenient().when(tenantContext.getDefaultCurrency()).thenReturn("EUR");
    }

    private PropertyInventoryItem buildItem(Long id, String name, String category) {
        PropertyInventoryItem item = new PropertyInventoryItem();
        item.setOrganizationId(1L);
        item.setPropertyId(10L);
        item.setName(name);
        item.setCategory(category);
        item.setQuantity(1);
        // Set id via reflection
        try {
            var field = PropertyInventoryItem.class.getDeclaredField("id");
            field.setAccessible(true);
            field.set(item, id);
        } catch (Exception ignore) {}
        return item;
    }

    private PropertyLaundryItem buildLaundryItem(Long id, String key, String label, int qty) {
        PropertyLaundryItem item = new PropertyLaundryItem();
        item.setOrganizationId(1L);
        item.setPropertyId(10L);
        item.setItemKey(key);
        item.setLabel(label);
        item.setQuantityPerStay(qty);
        try {
            var field = PropertyLaundryItem.class.getDeclaredField("id");
            field.setAccessible(true);
            field.set(item, id);
        } catch (Exception ignore) {}
        return item;
    }

    @Nested
    @DisplayName("Inventory Items")
    class InventoryItems {

        @Test
        void getInventoryItems_returnsList() {
            when(inventoryRepo.findByPropertyIdOrderByCategoryAscNameAsc(10L))
                    .thenReturn(List.of(buildItem(1L, "Chair", "Furniture")));

            List<PropertyInventoryItemDto> result = service.getInventoryItems(10L);
            assertThat(result).hasSize(1);
            assertThat(result.get(0).name()).isEqualTo("Chair");
        }

        @Test
        void addInventoryItem_savesAndReturnsDto() {
            PropertyInventoryItemDto input = new PropertyInventoryItemDto(
                    null, 10L, "Table", "Furniture", 2, "Wood");
            when(inventoryRepo.save(any())).thenAnswer(inv -> {
                PropertyInventoryItem item = inv.getArgument(0);
                try {
                    var f = PropertyInventoryItem.class.getDeclaredField("id");
                    f.setAccessible(true);
                    f.set(item, 99L);
                } catch (Exception ignore) {}
                return item;
            });

            PropertyInventoryItemDto result = service.addInventoryItem(10L, input);

            assertThat(result.name()).isEqualTo("Table");
            assertThat(result.quantity()).isEqualTo(2);
            assertThat(result.id()).isEqualTo(99L);
        }

        @Test
        void addInventoryItem_whenQuantityNull_thenDefaultsToOne() {
            PropertyInventoryItemDto input = new PropertyInventoryItemDto(
                    null, 10L, "Table", "Furniture", null, null);
            when(inventoryRepo.save(any())).thenAnswer(inv -> {
                PropertyInventoryItem item = inv.getArgument(0);
                return item;
            });

            PropertyInventoryItemDto result = service.addInventoryItem(10L, input);
            assertThat(result.quantity()).isEqualTo(1);
        }

        @Test
        void updateInventoryItem_whenFound_thenUpdates() {
            PropertyInventoryItem existing = buildItem(5L, "Old", "Cat1");
            when(inventoryRepo.findByPropertyIdAndId(10L, 5L)).thenReturn(Optional.of(existing));
            when(inventoryRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

            PropertyInventoryItemDto input = new PropertyInventoryItemDto(
                    5L, 10L, "New", "Cat2", 3, "notes");
            PropertyInventoryItemDto result = service.updateInventoryItem(10L, 5L, input);

            assertThat(result.name()).isEqualTo("New");
            assertThat(result.quantity()).isEqualTo(3);
        }

        @Test
        void updateInventoryItem_whenNotFound_thenThrows() {
            when(inventoryRepo.findByPropertyIdAndId(10L, 999L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.updateInventoryItem(10L, 999L,
                    new PropertyInventoryItemDto(null, 10L, "X", null, null, null)))
                    .isInstanceOf(NotFoundException.class);
        }

        @Test
        void deleteInventoryItem_whenFound_thenDeletes() {
            PropertyInventoryItem existing = buildItem(5L, "X", "C");
            when(inventoryRepo.findByPropertyIdAndId(10L, 5L)).thenReturn(Optional.of(existing));

            service.deleteInventoryItem(10L, 5L);

            verify(inventoryRepo).delete(existing);
        }

        @Test
        void deleteInventoryItem_whenNotFound_thenThrows() {
            when(inventoryRepo.findByPropertyIdAndId(10L, 999L)).thenReturn(Optional.empty());
            assertThatThrownBy(() -> service.deleteInventoryItem(10L, 999L))
                    .isInstanceOf(NotFoundException.class);
        }
    }

    @Nested
    @DisplayName("Laundry Items")
    class LaundryItems {

        @Test
        void getLaundryItems_returnsList() {
            when(laundryRepo.findByPropertyId(10L))
                    .thenReturn(List.of(buildLaundryItem(1L, "drap", "Drap", 2)));

            List<PropertyLaundryItemDto> result = service.getLaundryItems(10L);
            assertThat(result).hasSize(1);
            assertThat(result.get(0).itemKey()).isEqualTo("drap");
        }

        @Test
        void addLaundryItem_savesAndReturnsDto() {
            PropertyLaundryItemDto input = new PropertyLaundryItemDto(
                    null, 10L, "drap", "Drap", 2);
            when(laundryRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

            PropertyLaundryItemDto result = service.addLaundryItem(10L, input);

            assertThat(result.label()).isEqualTo("Drap");
            assertThat(result.quantityPerStay()).isEqualTo(2);
        }

        @Test
        void addLaundryItem_whenQtyNull_thenDefaultsToOne() {
            PropertyLaundryItemDto input = new PropertyLaundryItemDto(
                    null, 10L, "drap", "Drap", null);
            when(laundryRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

            PropertyLaundryItemDto result = service.addLaundryItem(10L, input);
            assertThat(result.quantityPerStay()).isEqualTo(1);
        }

        @Test
        void updateLaundryItem_whenFound_thenUpdates() {
            PropertyLaundryItem existing = buildLaundryItem(5L, "drap", "OldLabel", 1);
            when(laundryRepo.findByPropertyIdAndId(10L, 5L)).thenReturn(Optional.of(existing));
            when(laundryRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

            PropertyLaundryItemDto input = new PropertyLaundryItemDto(5L, 10L, "drap", "NewLabel", 4);
            PropertyLaundryItemDto result = service.updateLaundryItem(10L, 5L, input);

            assertThat(result.label()).isEqualTo("NewLabel");
            assertThat(result.quantityPerStay()).isEqualTo(4);
        }

        @Test
        void deleteLaundryItem_whenNotFound_thenThrows() {
            when(laundryRepo.findByPropertyIdAndId(10L, 999L)).thenReturn(Optional.empty());
            assertThatThrownBy(() -> service.deleteLaundryItem(10L, 999L))
                    .isInstanceOf(NotFoundException.class);
        }
    }

    @Nested
    @DisplayName("Laundry Quotes")
    class LaundryQuotes {

        @Test
        void getQuotes_returnsList() throws Exception {
            LaundryQuote q = new LaundryQuote();
            q.setPropertyId(10L);
            q.setOrganizationId(1L);
            q.setStatus(LaundryQuoteStatus.DRAFT);
            q.setTotalHt(new BigDecimal("50.00"));
            q.setCurrency("EUR");
            q.setLines("[]");
            try {
                var f = LaundryQuote.class.getDeclaredField("id");
                f.setAccessible(true);
                f.set(q, 1L);
            } catch (Exception ignore) {}

            when(quoteRepo.findByPropertyIdOrderByGeneratedAtDesc(any(Long.class), any(Pageable.class)))
                    .thenReturn(List.of(q));

            List<LaundryQuoteDto> result = service.getQuotes(10L);
            assertThat(result).hasSize(1);
            assertThat(result.get(0).totalHt()).isEqualByComparingTo("50.00");
        }

        @Test
        void generateQuote_whenItemsEmpty_thenThrows() {
            when(laundryRepo.findByPropertyId(10L)).thenReturn(List.of());

            assertThatThrownBy(() -> service.generateQuote(10L,
                    new GenerateLaundryQuoteRequest(null, "notes")))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        void generateQuote_whenItemsAndCatalog_thenComputesTotal() {
            // Setup laundry items
            when(laundryRepo.findByPropertyId(10L))
                    .thenReturn(List.of(buildLaundryItem(1L, "drap", "Drap", 2)));

            // Setup catalog
            PricingConfigDto config = new PricingConfigDto();
            config.setBlanchisserieConfig(List.of(
                    new PricingConfigDto.BlanchisserieItem("drap", "Drap", 5.0, true)));
            when(pricingConfigService.getCurrentConfig()).thenReturn(config);

            when(quoteRepo.save(any(LaundryQuote.class))).thenAnswer(inv -> {
                LaundryQuote q = inv.getArgument(0);
                try {
                    var f = LaundryQuote.class.getDeclaredField("id");
                    f.setAccessible(true);
                    f.set(q, 99L);
                } catch (Exception ignore) {}
                return q;
            });

            LaundryQuoteDto result = service.generateQuote(10L,
                    new GenerateLaundryQuoteRequest(null, "notes"));

            assertThat(result.totalHt()).isEqualByComparingTo("10.0"); // 2 * 5
            assertThat(result.status()).isEqualTo("DRAFT");
        }

        @Test
        void generateQuote_whenCatalogMissing_thenZeroPrice() {
            when(laundryRepo.findByPropertyId(10L))
                    .thenReturn(List.of(buildLaundryItem(1L, "unknown", "Item", 5)));

            PricingConfigDto config = new PricingConfigDto();
            config.setBlanchisserieConfig(null);
            when(pricingConfigService.getCurrentConfig()).thenReturn(config);

            when(quoteRepo.save(any(LaundryQuote.class))).thenAnswer(inv -> inv.getArgument(0));

            LaundryQuoteDto result = service.generateQuote(10L,
                    new GenerateLaundryQuoteRequest(null, null));

            assertThat(result.totalHt()).isEqualByComparingTo("0");
        }

        @Test
        void confirmQuote_whenDraft_thenConfirms() {
            LaundryQuote q = new LaundryQuote();
            q.setStatus(LaundryQuoteStatus.DRAFT);
            q.setLines("[]");
            q.setTotalHt(BigDecimal.ZERO);
            q.setCurrency("EUR");
            q.setPropertyId(10L);
            when(quoteRepo.findByPropertyIdAndId(10L, 5L)).thenReturn(Optional.of(q));
            when(quoteRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

            LaundryQuoteDto result = service.confirmQuote(10L, 5L);

            assertThat(result.status()).isEqualTo("CONFIRMED");
            assertThat(q.getConfirmedAt()).isNotNull();
        }

        @Test
        void confirmQuote_whenNotDraft_thenThrows() {
            LaundryQuote q = new LaundryQuote();
            q.setStatus(LaundryQuoteStatus.CONFIRMED);
            q.setLines("[]");
            when(quoteRepo.findByPropertyIdAndId(10L, 5L)).thenReturn(Optional.of(q));

            assertThatThrownBy(() -> service.confirmQuote(10L, 5L))
                    .isInstanceOf(IllegalStateException.class);
        }

        @Test
        void confirmQuote_whenNotFound_thenThrows() {
            when(quoteRepo.findByPropertyIdAndId(anyLong(), anyLong())).thenReturn(Optional.empty());
            assertThatThrownBy(() -> service.confirmQuote(10L, 5L))
                    .isInstanceOf(NotFoundException.class);
        }
    }

    @Nested
    @DisplayName("Blanchisserie Catalog")
    class BlanchisserieCatalog {

        @Test
        void whenCatalogHasEnabledItems_thenReturnsEnabledOnly() {
            PricingConfigDto config = new PricingConfigDto();
            config.setBlanchisserieConfig(List.of(
                    new PricingConfigDto.BlanchisserieItem("a", "A", 1.0, true),
                    new PricingConfigDto.BlanchisserieItem("b", "B", 2.0, false)
            ));
            when(pricingConfigService.getCurrentConfig()).thenReturn(config);

            List<PricingConfigDto.BlanchisserieItem> result = service.getBlanchisserieCatalog();

            assertThat(result).hasSize(1);
            assertThat(result.get(0).getKey()).isEqualTo("a");
        }

        @Test
        void whenCatalogNull_thenReturnsEmpty() {
            PricingConfigDto config = new PricingConfigDto();
            config.setBlanchisserieConfig(null);
            when(pricingConfigService.getCurrentConfig()).thenReturn(config);

            List<PricingConfigDto.BlanchisserieItem> result = service.getBlanchisserieCatalog();
            assertThat(result).isEmpty();
        }
    }
}
