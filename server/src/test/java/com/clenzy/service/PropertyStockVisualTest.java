package com.clenzy.service;

import com.clenzy.exception.NotFoundException;
import com.clenzy.model.PropertyStockItem;
import com.clenzy.repository.PropertyStockItemRepository;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.time.Clock;
import java.time.Instant;
import java.util.Base64;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.any;

class PropertyStockVisualTest {
    private final PropertyStockItemRepository repository = mock(PropertyStockItemRepository.class);
    private final PropertyStockService service = new PropertyStockService(repository, Clock.systemUTC());
    // Petite image PNG réelle, pas une URL distante.
    private static final String PHOTO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXO8AAAAASUVORK5CYII=";

    private PropertyStockItem item() {
        var item = new PropertyStockItem();
        item.setId(10L);
        item.setPropertyId(7L);
        item.setOrganizationId(3L);
        item.setName("Café local");
        return item;
    }

    @Test void persistsLibraryAndCustomPhotoWithoutErasingRestockHistory() {
        var existing = item();
        var restockedAt = Instant.parse("2026-09-30T10:00:00Z");
        existing.setLastRestockedAt(restockedAt);
        when(repository.findByIdAndOrganizationId(10L, 3L)).thenReturn(Optional.of(existing));
        when(repository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        var request = item();
        request.setCatalogKey("coffee-capsules");
        request.setPhotoUrl(PHOTO);
        request.setQuantity(12);
        var saved = service.save(3L, 7L, request);
        assertThat(saved).isSameAs(existing);
        assertThat(saved.getCatalogKey()).isEqualTo("coffee-capsules");
        assertThat(saved.getPhotoUrl()).isEqualTo(PHOTO);
        assertThat(saved.getQuantity()).isEqualTo(12);
        assertThat(saved.getLastRestockedAt()).isEqualTo(restockedAt);
        request.setPhotoUrl(null);
        assertThat(service.save(3L, 7L, request).getPhotoUrl()).isNull();
    }

    @Test void visualIsScopedToTheAuthenticatedOrganization() {
        when(repository.findByIdAndOrganizationId(10L, 9L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.findForOrganization(10L, 9L)).isInstanceOf(NotFoundException.class);
        verify(repository).findByIdAndOrganizationId(10L, 9L);
    }

    @Test void anotherPropertyCannotUpdateThePhoto() {
        when(repository.findByIdAndOrganizationId(10L, 3L)).thenReturn(Optional.of(item()));
        assertThatThrownBy(() -> service.save(3L, 8L, item())).isInstanceOf(NotFoundException.class);
        verify(repository, never()).save(any());
    }

    @Test void acceptsLegacyAndCustomEntries() {
        assertThatCode(() -> StockItemVisualValidator.validate(null, null)).doesNotThrowAnyException();
        assertThatCode(() -> StockItemVisualValidator.validate("custom", PHOTO)).doesNotThrowAnyException();
    }

    @Test void rejectsRemoteUrlsSvgInvalidContentAndOversizedImages() {
        for (String invalid : new String[] { "https://example.com/photo.png", "http://127.0.0.1/test",
                "data:image/svg+xml;base64,PHN2Zy8+", "data:image/png;base64,PGh0bWw+aW52YWxpZDwvaHRtbD4=",
                "data:image/png;base64," + Base64.getEncoder().encodeToString(new byte[256 * 1024 + 1]) }) {
            assertThatThrownBy(() -> StockItemVisualValidator.validate("custom", invalid))
                    .isInstanceOf(ResponseStatusException.class);
        }
        assertThatThrownBy(() -> StockItemVisualValidator.validate("../../file", null))
                .isInstanceOf(ResponseStatusException.class);
    }
}
