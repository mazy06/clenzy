package com.clenzy.booking.service;

import com.clenzy.booking.dto.BookingServiceCategoryDto;
import com.clenzy.booking.dto.BookingServiceItemDto;
import com.clenzy.booking.dto.SelectedServiceOptionDto;
import com.clenzy.booking.model.BookingServiceCategory;
import com.clenzy.booking.model.BookingServiceInputType;
import com.clenzy.booking.model.BookingServiceItem;
import com.clenzy.booking.model.BookingServicePricingMode;
import com.clenzy.booking.repository.BookingServiceCategoryRepository;
import com.clenzy.booking.repository.BookingServiceItemRepository;
import com.clenzy.model.Reservation;
import com.clenzy.model.ReservationServiceItem;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.ReservationServiceItemRepository;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link BookingServiceOptionsService}.
 * Covers admin CRUD (categories/items), public listing, ordering, price computation
 * across pricing modes, and reservation linking.
 */
@ExtendWith(MockitoExtension.class)
class BookingServiceOptionsServiceTest {

    private static final Long ORG_ID = 7L;

    @Mock private BookingServiceCategoryRepository categoryRepository;
    @Mock private BookingServiceItemRepository itemRepository;
    @Mock private ReservationServiceItemRepository reservationServiceItemRepository;
    @Mock private ReservationRepository reservationRepository;
    @Mock private TenantContext tenantContext;

    private BookingServiceOptionsService service;

    @BeforeEach
    void setUp() {
        service = new BookingServiceOptionsService(
                categoryRepository, itemRepository,
                reservationServiceItemRepository, reservationRepository,
                tenantContext);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private BookingServiceCategory cat(Long id, String name, Integer sort, boolean active) {
        BookingServiceCategory c = new BookingServiceCategory();
        c.setId(id);
        c.setOrganizationId(ORG_ID);
        c.setName(name);
        c.setDescription("desc " + name);
        c.setSortOrder(sort != null ? sort : 0);
        c.setActive(active);
        c.setItems(new ArrayList<>());
        return c;
    }

    private BookingServiceItem item(Long id, BookingServiceCategory parent,
                                     String name, BigDecimal price,
                                     BookingServicePricingMode mode, Integer maxQty,
                                     boolean active) {
        BookingServiceItem i = new BookingServiceItem();
        i.setId(id);
        i.setCategory(parent);
        i.setOrganizationId(ORG_ID);
        i.setName(name);
        i.setDescription("desc " + name);
        i.setPrice(price);
        i.setPricingMode(mode);
        i.setInputType(BookingServiceInputType.QUANTITY);
        i.setMaxQuantity(maxQty);
        i.setMandatory(false);
        i.setSortOrder(0);
        i.setActive(active);
        if (parent != null) {
            parent.getItems().add(i);
        }
        return i;
    }

    private BookingServiceCategoryDto dtoCat(String name, Integer sort, boolean active) {
        return new BookingServiceCategoryDto(null, null, name, "desc", sort, active, Collections.emptyList());
    }

    private BookingServiceItemDto dtoItem(String name, BigDecimal price,
                                           BookingServicePricingMode mode,
                                           Integer maxQty, boolean active) {
        return new BookingServiceItemDto(null, null, name, "desc", price, mode,
                BookingServiceInputType.QUANTITY, maxQty, false, 1, active);
    }

    // ─── listCategories ─────────────────────────────────────────────────────

    @Nested
    @DisplayName("listCategories")
    class ListCategories {

        @Test
        @DisplayName("returns DTOs ordered by sortOrder for the tenant org")
        void returnsDtos() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            BookingServiceCategory c1 = cat(1L, "Romantic", 0, true);
            BookingServiceCategory c2 = cat(2L, "Food", 1, true);
            when(categoryRepository.findAllByOrganizationIdOrderBySortOrderAsc(ORG_ID))
                    .thenReturn(List.of(c1, c2));

            List<BookingServiceCategoryDto> result = service.listCategories();

            assertThat(result).hasSize(2);
            assertThat(result.get(0).id()).isEqualTo(1L);
            assertThat(result.get(0).name()).isEqualTo("Romantic");
            assertThat(result.get(1).id()).isEqualTo(2L);
        }

        @Test
        @DisplayName("returns empty list when no categories exist")
        void emptyResult() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(categoryRepository.findAllByOrganizationIdOrderBySortOrderAsc(ORG_ID))
                    .thenReturn(List.of());
            assertThat(service.listCategories()).isEmpty();
        }
    }

    // ─── createCategory ─────────────────────────────────────────────────────

    @Nested
    @DisplayName("createCategory")
    class CreateCategory {

        @Test
        @DisplayName("creates a category with provided fields")
        void create_setsAllFields() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(categoryRepository.save(any(BookingServiceCategory.class))).thenAnswer(inv -> {
                BookingServiceCategory c = inv.getArgument(0);
                c.setId(42L);
                return c;
            });

            BookingServiceCategoryDto dto = dtoCat("Romantic", 3, true);
            BookingServiceCategoryDto result = service.createCategory(dto);

            ArgumentCaptor<BookingServiceCategory> captor = ArgumentCaptor.forClass(BookingServiceCategory.class);
            verify(categoryRepository).save(captor.capture());
            BookingServiceCategory saved = captor.getValue();
            assertThat(saved.getOrganizationId()).isEqualTo(ORG_ID);
            assertThat(saved.getName()).isEqualTo("Romantic");
            assertThat(saved.getDescription()).isEqualTo("desc");
            assertThat(saved.getSortOrder()).isEqualTo(3);
            assertThat(saved.isActive()).isTrue();
            assertThat(result.id()).isEqualTo(42L);
        }

        @Test
        @DisplayName("defaults sortOrder to 0 when null")
        void defaultsSortOrder() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(categoryRepository.save(any(BookingServiceCategory.class))).thenAnswer(inv -> inv.getArgument(0));
            BookingServiceCategoryDto dto = dtoCat("X", null, false);

            service.createCategory(dto);

            ArgumentCaptor<BookingServiceCategory> captor = ArgumentCaptor.forClass(BookingServiceCategory.class);
            verify(categoryRepository).save(captor.capture());
            assertThat(captor.getValue().getSortOrder()).isEqualTo(0);
            assertThat(captor.getValue().isActive()).isFalse();
        }
    }

    // ─── updateCategory ─────────────────────────────────────────────────────

    @Nested
    @DisplayName("updateCategory")
    class UpdateCategory {

        @Test
        @DisplayName("updates fields when category exists for org")
        void update_setsFields() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            BookingServiceCategory existing = cat(5L, "Old", 0, true);
            when(categoryRepository.findByIdAndOrganizationId(5L, ORG_ID))
                    .thenReturn(Optional.of(existing));
            when(categoryRepository.save(existing)).thenReturn(existing);

            BookingServiceCategoryDto dto = dtoCat("New", 9, false);
            BookingServiceCategoryDto result = service.updateCategory(5L, dto);

            assertThat(existing.getName()).isEqualTo("New");
            assertThat(existing.getSortOrder()).isEqualTo(9);
            assertThat(existing.isActive()).isFalse();
            assertThat(result.name()).isEqualTo("New");
        }

        @Test
        @DisplayName("keeps existing sortOrder when null in DTO")
        void update_keepsSortOrderWhenNull() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            BookingServiceCategory existing = cat(5L, "Old", 7, true);
            when(categoryRepository.findByIdAndOrganizationId(5L, ORG_ID))
                    .thenReturn(Optional.of(existing));
            when(categoryRepository.save(existing)).thenReturn(existing);

            service.updateCategory(5L, dtoCat("Renamed", null, true));

            assertThat(existing.getSortOrder()).isEqualTo(7);
        }

        @Test
        @DisplayName("throws when category not found")
        void update_throwsWhenNotFound() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(categoryRepository.findByIdAndOrganizationId(99L, ORG_ID))
                    .thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.updateCategory(99L, dtoCat("X", 0, true)))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("introuvable");
        }
    }

    // ─── deleteCategory ─────────────────────────────────────────────────────

    @Nested
    @DisplayName("deleteCategory")
    class DeleteCategory {

        @Test
        void delete_callsRepoDelete() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            BookingServiceCategory existing = cat(3L, "X", 0, true);
            when(categoryRepository.findByIdAndOrganizationId(3L, ORG_ID))
                    .thenReturn(Optional.of(existing));

            service.deleteCategory(3L);

            verify(categoryRepository).delete(existing);
        }

        @Test
        void delete_throwsWhenMissing() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(categoryRepository.findByIdAndOrganizationId(404L, ORG_ID))
                    .thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.deleteCategory(404L))
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }

    // ─── reorderCategories ─────────────────────────────────────────────────

    @Nested
    @DisplayName("reorderCategories")
    class ReorderCategories {

        @Test
        @DisplayName("assigns sortOrder by position and returns sorted DTOs")
        void reorder_setsSortOrder() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            BookingServiceCategory a = cat(1L, "A", 0, true);
            BookingServiceCategory b = cat(2L, "B", 1, true);
            BookingServiceCategory c = cat(3L, "C", 2, true);
            when(categoryRepository.findAllByOrganizationIdOrderBySortOrderAsc(ORG_ID))
                    .thenReturn(List.of(a, b, c));

            List<BookingServiceCategoryDto> result =
                    service.reorderCategories(List.of(3L, 1L, 2L));

            assertThat(c.getSortOrder()).isEqualTo(0);
            assertThat(a.getSortOrder()).isEqualTo(1);
            assertThat(b.getSortOrder()).isEqualTo(2);
            assertThat(result).extracting(BookingServiceCategoryDto::id)
                    .containsExactly(3L, 1L, 2L);
            verify(categoryRepository).saveAll(anyList());
        }

        @Test
        @DisplayName("ignores IDs that do not belong to the org")
        void reorder_skipsUnknownIds() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            BookingServiceCategory a = cat(1L, "A", 5, true);
            when(categoryRepository.findAllByOrganizationIdOrderBySortOrderAsc(ORG_ID))
                    .thenReturn(List.of(a));

            List<BookingServiceCategoryDto> result =
                    service.reorderCategories(List.of(99L, 1L));

            assertThat(a.getSortOrder()).isEqualTo(1);
            assertThat(result).hasSize(1).extracting(BookingServiceCategoryDto::id).containsExactly(1L);
        }
    }

    // ─── createItem ─────────────────────────────────────────────────────────

    @Nested
    @DisplayName("createItem")
    class CreateItem {

        @Test
        @DisplayName("creates item under existing category with all defaults")
        void create_setsDefaults() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            BookingServiceCategory parent = cat(1L, "Parent", 0, true);
            when(categoryRepository.findByIdAndOrganizationId(1L, ORG_ID))
                    .thenReturn(Optional.of(parent));
            when(itemRepository.save(any(BookingServiceItem.class))).thenAnswer(inv -> {
                BookingServiceItem i = inv.getArgument(0);
                i.setId(11L);
                return i;
            });

            BookingServiceItemDto dto = new BookingServiceItemDto(
                    null, null, "Champagne", "desc", null, null, null, null, false, null, true);

            BookingServiceItemDto result = service.createItem(1L, dto);

            ArgumentCaptor<BookingServiceItem> captor = ArgumentCaptor.forClass(BookingServiceItem.class);
            verify(itemRepository).save(captor.capture());
            BookingServiceItem saved = captor.getValue();
            assertThat(saved.getCategory()).isSameAs(parent);
            assertThat(saved.getOrganizationId()).isEqualTo(ORG_ID);
            assertThat(saved.getPrice()).isEqualByComparingTo(BigDecimal.ZERO);
            assertThat(saved.getPricingMode()).isEqualTo(BookingServicePricingMode.PER_BOOKING);
            assertThat(saved.getInputType()).isEqualTo(BookingServiceInputType.CHECKBOX);
            assertThat(saved.getMaxQuantity()).isEqualTo(10);
            assertThat(saved.getSortOrder()).isEqualTo(0);
            assertThat(result.id()).isEqualTo(11L);
        }

        @Test
        @DisplayName("uses provided values when set")
        void create_respectsDtoValues() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            BookingServiceCategory parent = cat(1L, "P", 0, true);
            when(categoryRepository.findByIdAndOrganizationId(1L, ORG_ID))
                    .thenReturn(Optional.of(parent));
            when(itemRepository.save(any(BookingServiceItem.class))).thenAnswer(inv -> inv.getArgument(0));

            BookingServiceItemDto dto = dtoItem("Spa", new BigDecimal("50.00"),
                    BookingServicePricingMode.PER_PERSON, 5, true);
            service.createItem(1L, dto);

            ArgumentCaptor<BookingServiceItem> captor = ArgumentCaptor.forClass(BookingServiceItem.class);
            verify(itemRepository).save(captor.capture());
            BookingServiceItem saved = captor.getValue();
            assertThat(saved.getPrice()).isEqualByComparingTo("50.00");
            assertThat(saved.getPricingMode()).isEqualTo(BookingServicePricingMode.PER_PERSON);
            assertThat(saved.getMaxQuantity()).isEqualTo(5);
        }

        @Test
        @DisplayName("throws when parent category not found")
        void create_throwsWhenParentMissing() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(categoryRepository.findByIdAndOrganizationId(99L, ORG_ID))
                    .thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.createItem(99L,
                    dtoItem("x", null, null, null, true)))
                    .isInstanceOf(IllegalArgumentException.class);
            verifyNoInteractions(itemRepository);
        }
    }

    // ─── updateItem ─────────────────────────────────────────────────────────

    @Nested
    @DisplayName("updateItem")
    class UpdateItem {

        @Test
        @DisplayName("updates only non-null DTO fields")
        void update_setsFields() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            BookingServiceCategory parent = cat(1L, "P", 0, true);
            BookingServiceItem existing = item(11L, parent, "Old",
                    new BigDecimal("10"), BookingServicePricingMode.PER_BOOKING, 10, true);
            when(itemRepository.findByIdAndOrganizationId(11L, ORG_ID))
                    .thenReturn(Optional.of(existing));
            when(itemRepository.save(existing)).thenReturn(existing);

            BookingServiceItemDto dto = dtoItem("New", new BigDecimal("25"),
                    BookingServicePricingMode.PER_NIGHT, 3, false);
            service.updateItem(11L, dto);

            assertThat(existing.getName()).isEqualTo("New");
            assertThat(existing.getPrice()).isEqualByComparingTo("25");
            assertThat(existing.getPricingMode()).isEqualTo(BookingServicePricingMode.PER_NIGHT);
            assertThat(existing.getMaxQuantity()).isEqualTo(3);
            assertThat(existing.isActive()).isFalse();
        }

        @Test
        @DisplayName("preserves price/mode/maxQty when DTO has nulls")
        void update_keepsValuesWhenNull() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            BookingServiceCategory parent = cat(1L, "P", 0, true);
            BookingServiceItem existing = item(11L, parent, "Old",
                    new BigDecimal("15"), BookingServicePricingMode.PER_PERSON, 7, true);
            when(itemRepository.findByIdAndOrganizationId(11L, ORG_ID))
                    .thenReturn(Optional.of(existing));
            when(itemRepository.save(existing)).thenReturn(existing);

            BookingServiceItemDto dto = new BookingServiceItemDto(
                    null, null, "Renamed", "d", null, null, null, null, false, null, true);
            service.updateItem(11L, dto);

            assertThat(existing.getName()).isEqualTo("Renamed");
            assertThat(existing.getPrice()).isEqualByComparingTo("15");
            assertThat(existing.getPricingMode()).isEqualTo(BookingServicePricingMode.PER_PERSON);
            assertThat(existing.getMaxQuantity()).isEqualTo(7);
        }

        @Test
        void update_throwsWhenMissing() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(itemRepository.findByIdAndOrganizationId(404L, ORG_ID))
                    .thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.updateItem(404L,
                    dtoItem("x", null, null, null, true)))
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }

    // ─── deleteItem ─────────────────────────────────────────────────────────

    @Nested
    @DisplayName("deleteItem")
    class DeleteItem {

        @Test
        void delete_callsRepoDelete() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            BookingServiceCategory parent = cat(1L, "P", 0, true);
            BookingServiceItem existing = item(11L, parent, "X",
                    BigDecimal.ZERO, BookingServicePricingMode.PER_BOOKING, 10, true);
            when(itemRepository.findByIdAndOrganizationId(11L, ORG_ID))
                    .thenReturn(Optional.of(existing));

            service.deleteItem(11L);
            verify(itemRepository).delete(existing);
        }

        @Test
        void delete_throwsWhenMissing() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(itemRepository.findByIdAndOrganizationId(404L, ORG_ID))
                    .thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.deleteItem(404L))
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }

    // ─── listActiveCategories ───────────────────────────────────────────────

    @Nested
    @DisplayName("listActiveCategories (public API)")
    class ListActiveCategories {

        @Test
        @DisplayName("filters out inactive items and categories without items")
        void filters() {
            BookingServiceCategory withItems = cat(1L, "A", 0, true);
            item(10L, withItems, "active item", new BigDecimal("5"),
                    BookingServicePricingMode.PER_BOOKING, 5, true);
            item(11L, withItems, "inactive item", BigDecimal.ZERO,
                    BookingServicePricingMode.PER_BOOKING, 5, false);

            BookingServiceCategory empty = cat(2L, "B", 1, true);
            BookingServiceCategory onlyInactive = cat(3L, "C", 2, true);
            item(12L, onlyInactive, "inactive only", BigDecimal.ZERO,
                    BookingServicePricingMode.PER_BOOKING, 5, false);

            when(categoryRepository.findAllByOrganizationIdAndActiveTrueOrderBySortOrderAsc(ORG_ID))
                    .thenReturn(List.of(withItems, empty, onlyInactive));

            List<BookingServiceCategoryDto> result = service.listActiveCategories(ORG_ID);

            assertThat(result).hasSize(1);
            assertThat(result.get(0).id()).isEqualTo(1L);
            assertThat(result.get(0).items()).hasSize(1);
            assertThat(result.get(0).items().get(0).name()).isEqualTo("active item");
        }
    }

    // ─── computeServiceOptionsTotal ─────────────────────────────────────────

    @Nested
    @DisplayName("computeServiceOptionsTotal")
    class ComputeTotal {

        @Test
        @DisplayName("returns ZERO when selections are null or empty")
        void emptyOrNullSelections() {
            assertThat(service.computeServiceOptionsTotal(null, 2, 3, ORG_ID))
                    .isEqualByComparingTo(BigDecimal.ZERO);
            assertThat(service.computeServiceOptionsTotal(List.of(), 2, 3, ORG_ID))
                    .isEqualByComparingTo(BigDecimal.ZERO);
            verifyNoInteractions(itemRepository);
        }

        @Test
        @DisplayName("PER_BOOKING: price * quantity")
        void perBooking() {
            BookingServiceItem i = item(1L, null, "x", new BigDecimal("20"),
                    BookingServicePricingMode.PER_BOOKING, 10, true);
            when(itemRepository.findAllByIdInAndOrganizationId(List.of(1L), ORG_ID))
                    .thenReturn(List.of(i));

            BigDecimal total = service.computeServiceOptionsTotal(
                    List.of(new SelectedServiceOptionDto(1L, 3)), 4, 2, ORG_ID);

            assertThat(total).isEqualByComparingTo("60"); // 20 * 3
        }

        @Test
        @DisplayName("PER_PERSON: price * quantity * guests")
        void perPerson() {
            BookingServiceItem i = item(1L, null, "x", new BigDecimal("10"),
                    BookingServicePricingMode.PER_PERSON, 10, true);
            when(itemRepository.findAllByIdInAndOrganizationId(List.of(1L), ORG_ID))
                    .thenReturn(List.of(i));

            BigDecimal total = service.computeServiceOptionsTotal(
                    List.of(new SelectedServiceOptionDto(1L, 2)), 4, 3, ORG_ID);

            assertThat(total).isEqualByComparingTo("80"); // 10 * 2 * 4
        }

        @Test
        @DisplayName("PER_NIGHT: price * quantity * nights")
        void perNight() {
            BookingServiceItem i = item(1L, null, "x", new BigDecimal("7"),
                    BookingServicePricingMode.PER_NIGHT, 10, true);
            when(itemRepository.findAllByIdInAndOrganizationId(List.of(1L), ORG_ID))
                    .thenReturn(List.of(i));

            BigDecimal total = service.computeServiceOptionsTotal(
                    List.of(new SelectedServiceOptionDto(1L, 2)), 4, 5, ORG_ID);

            assertThat(total).isEqualByComparingTo("70"); // 7 * 2 * 5
        }

        @Test
        @DisplayName("clamps quantity to maxQuantity server-side")
        void clampsMaxQuantity() {
            BookingServiceItem i = item(1L, null, "x", new BigDecimal("10"),
                    BookingServicePricingMode.PER_BOOKING, 3, true);
            when(itemRepository.findAllByIdInAndOrganizationId(List.of(1L), ORG_ID))
                    .thenReturn(List.of(i));

            BigDecimal total = service.computeServiceOptionsTotal(
                    List.of(new SelectedServiceOptionDto(1L, 99)), 1, 1, ORG_ID);

            assertThat(total).isEqualByComparingTo("30"); // 10 * 3 (clamped)
        }

        @Test
        @DisplayName("uses raw quantity when maxQuantity is null")
        void noMaxQuantity_usesRawQty() {
            BookingServiceItem i = item(1L, null, "x", new BigDecimal("2"),
                    BookingServicePricingMode.PER_BOOKING, null, true);
            when(itemRepository.findAllByIdInAndOrganizationId(List.of(1L), ORG_ID))
                    .thenReturn(List.of(i));

            BigDecimal total = service.computeServiceOptionsTotal(
                    List.of(new SelectedServiceOptionDto(1L, 50)), 1, 1, ORG_ID);

            assertThat(total).isEqualByComparingTo("100");
        }

        @Test
        @DisplayName("skips inactive items and items missing in repo")
        void skipsMissingOrInactive() {
            BookingServiceItem active = item(1L, null, "x", new BigDecimal("10"),
                    BookingServicePricingMode.PER_BOOKING, 10, true);
            BookingServiceItem inactive = item(2L, null, "y", new BigDecimal("99"),
                    BookingServicePricingMode.PER_BOOKING, 10, false);
            when(itemRepository.findAllByIdInAndOrganizationId(any(), eq(ORG_ID)))
                    .thenReturn(List.of(active, inactive));

            BigDecimal total = service.computeServiceOptionsTotal(
                    List.of(new SelectedServiceOptionDto(1L, 1),
                            new SelectedServiceOptionDto(2L, 1),
                            new SelectedServiceOptionDto(3L, 1)), // 3L missing
                    1, 1, ORG_ID);

            assertThat(total).isEqualByComparingTo("10");
        }
    }

    // ─── createReservationServiceItems ──────────────────────────────────────

    @Nested
    @DisplayName("createReservationServiceItems")
    class CreateReservationItems {

        @Test
        @DisplayName("no-op when selections are empty/null")
        void noopOnEmpty() {
            Reservation r = new Reservation();
            r.setId(1L);
            service.createReservationServiceItems(r, null, 2, 3, ORG_ID);
            service.createReservationServiceItems(r, List.of(), 2, 3, ORG_ID);

            verifyNoInteractions(reservationServiceItemRepository);
            verifyNoInteractions(reservationRepository);
        }

        @Test
        @DisplayName("creates RSI snapshots, totals, and updates reservation")
        void createsSnapshots() {
            BookingServiceItem i1 = item(1L, null, "Petit-dej",
                    new BigDecimal("15"), BookingServicePricingMode.PER_PERSON, 10, true);
            BookingServiceItem i2 = item(2L, null, "Spa",
                    new BigDecimal("50"), BookingServicePricingMode.PER_BOOKING, 5, true);
            when(itemRepository.findAllByIdInAndOrganizationId(any(), eq(ORG_ID)))
                    .thenReturn(List.of(i1, i2));

            Reservation r = new Reservation();
            r.setId(99L);

            service.createReservationServiceItems(r,
                    List.of(new SelectedServiceOptionDto(1L, 1),
                            new SelectedServiceOptionDto(2L, 1)),
                    2, 3, ORG_ID);

            ArgumentCaptor<ReservationServiceItem> captor = ArgumentCaptor.forClass(ReservationServiceItem.class);
            verify(reservationServiceItemRepository, org.mockito.Mockito.times(2)).save(captor.capture());

            List<ReservationServiceItem> saved = captor.getAllValues();
            ReservationServiceItem rsi1 = saved.get(0);
            assertThat(rsi1.getReservation()).isSameAs(r);
            assertThat(rsi1.getServiceItemName()).isEqualTo("Petit-dej");
            assertThat(rsi1.getUnitPrice()).isEqualByComparingTo("15");
            assertThat(rsi1.getTotalPrice()).isEqualByComparingTo("30"); // 15*1*2

            ReservationServiceItem rsi2 = saved.get(1);
            assertThat(rsi2.getServiceItemName()).isEqualTo("Spa");
            assertThat(rsi2.getTotalPrice()).isEqualByComparingTo("50"); // 50*1

            // Reservation updated with 30 + 50 = 80
            assertThat(r.getServiceOptionsTotal()).isEqualByComparingTo("80");
            verify(reservationRepository).save(r);
        }

        @Test
        @DisplayName("skips inactive items entirely")
        void skipsInactive() {
            BookingServiceItem inactive = item(1L, null, "X",
                    new BigDecimal("10"), BookingServicePricingMode.PER_BOOKING, 10, false);
            when(itemRepository.findAllByIdInAndOrganizationId(any(), eq(ORG_ID)))
                    .thenReturn(List.of(inactive));

            Reservation r = new Reservation();
            r.setId(99L);

            service.createReservationServiceItems(r,
                    List.of(new SelectedServiceOptionDto(1L, 1)),
                    1, 1, ORG_ID);

            verify(reservationServiceItemRepository, never()).save(any());
            assertThat(r.getServiceOptionsTotal()).isEqualByComparingTo(BigDecimal.ZERO);
            verify(reservationRepository).save(r);
        }
    }
}
