package com.clenzy.booking.dto;

import com.clenzy.booking.model.BookingServiceCategory;
import com.clenzy.booking.model.BookingServiceInputType;
import com.clenzy.booking.model.BookingServiceItem;
import com.clenzy.booking.model.BookingServicePricingMode;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class BookingServiceCategoryDtoTest {

    @Test
    void recordAccessors_returnAllConstructorValues() {
        BookingServiceItemDto item = new BookingServiceItemDto(
                100L, 1L, "Item", null, BigDecimal.TEN,
                BookingServicePricingMode.PER_BOOKING,
                BookingServiceInputType.CHECKBOX,
                10, false, 0, true
        );
        List<BookingServiceItemDto> items = List.of(item);

        BookingServiceCategoryDto dto = new BookingServiceCategoryDto(
                1L, 50L,
                "Concierge",
                "Premium services",
                3,
                true,
                items
        );

        assertEquals(1L, dto.id());
        assertEquals(50L, dto.organizationId());
        assertEquals("Concierge", dto.name());
        assertEquals("Premium services", dto.description());
        assertEquals(3, dto.sortOrder());
        assertTrue(dto.active());
        assertEquals(items, dto.items());
    }

    @Test
    void from_mapsAllItemsRegardlessOfActiveFlag() {
        BookingServiceCategory category = buildCategory(1L, "Cat", true);
        category.getItems().add(buildItem(100L, "Active item", true, category));
        category.getItems().add(buildItem(101L, "Inactive item", false, category));

        BookingServiceCategoryDto dto = BookingServiceCategoryDto.from(category);

        assertEquals(1L, dto.id());
        assertEquals("Cat", dto.name());
        assertTrue(dto.active());
        assertEquals(2, dto.items().size());
        assertEquals(100L, dto.items().get(0).id());
        assertEquals(101L, dto.items().get(1).id());
    }

    @Test
    void fromActiveOnly_filtersInactiveItems() {
        BookingServiceCategory category = buildCategory(5L, "Cat2", true);
        category.getItems().add(buildItem(200L, "Active", true, category));
        category.getItems().add(buildItem(201L, "Inactive", false, category));
        category.getItems().add(buildItem(202L, "Active2", true, category));

        BookingServiceCategoryDto dto = BookingServiceCategoryDto.fromActiveOnly(category);

        assertEquals(2, dto.items().size());
        assertEquals(200L, dto.items().get(0).id());
        assertEquals(202L, dto.items().get(1).id());
    }

    @Test
    void from_emptyItemsList_returnsEmptyList() {
        BookingServiceCategory category = buildCategory(9L, "Empty", false);

        BookingServiceCategoryDto dto = BookingServiceCategoryDto.from(category);

        assertNotNull(dto.items());
        assertTrue(dto.items().isEmpty());
        assertFalse(dto.active());
    }

    @Test
    void fromActiveOnly_emptyItemsList_returnsEmptyList() {
        BookingServiceCategory category = buildCategory(9L, "Empty", true);

        BookingServiceCategoryDto dto = BookingServiceCategoryDto.fromActiveOnly(category);

        assertNotNull(dto.items());
        assertTrue(dto.items().isEmpty());
    }

    // --- Helpers ---

    private BookingServiceCategory buildCategory(Long id, String name, boolean active) {
        BookingServiceCategory cat = new BookingServiceCategory();
        cat.setId(id);
        cat.setOrganizationId(99L);
        cat.setName(name);
        cat.setDescription("desc");
        cat.setSortOrder(0);
        cat.setActive(active);
        cat.setItems(new ArrayList<>());
        return cat;
    }

    private BookingServiceItem buildItem(Long id, String name, boolean active, BookingServiceCategory parent) {
        BookingServiceItem item = new BookingServiceItem();
        item.setId(id);
        item.setCategory(parent);
        item.setOrganizationId(99L);
        item.setName(name);
        item.setDescription("desc");
        item.setPrice(new BigDecimal("10.00"));
        item.setPricingMode(BookingServicePricingMode.PER_BOOKING);
        item.setInputType(BookingServiceInputType.CHECKBOX);
        item.setMaxQuantity(5);
        item.setMandatory(false);
        item.setSortOrder(0);
        item.setActive(active);
        return item;
    }
}
