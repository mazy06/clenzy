package com.clenzy.service;

import com.clenzy.dto.inventory.PropertyInventoryItemDto;
import com.clenzy.model.PropertyInventoryItem;
import com.clenzy.repository.*;
import com.clenzy.tenant.TenantContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.springframework.web.server.ResponseStatusException;
import java.sql.DriverManager;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class PropertyInventoryVisualTest {
    private final PropertyInventoryItemRepository repository = mock(PropertyInventoryItemRepository.class);
    private PropertyInventoryService service;
    private static final String PHOTO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";

    @BeforeEach void setup() {
        var tenant = new TenantContext();
        tenant.setOrganizationId(7L);
        service = new PropertyInventoryService(repository, mock(PropertyLaundryItemRepository.class),
                mock(LaundryQuoteRepository.class), mock(PricingConfigService.class), tenant, new ObjectMapper());
    }

    private PropertyInventoryItemDto dto(String name, int quantity, String key, String photo, Boolean clear) {
        return new PropertyInventoryItemDto(99L, 999L, name, "Cuisine", quantity, "Modèle personnel", key, photo, clear);
    }

    @Test void savesAndReturnsCustomPhotoAndStableReference() {
        when(repository.save(any())).thenAnswer(call -> call.getArgument(0));
        var result = service.addInventoryItem(15L, dto(" Ma cafetière ", 2, "capsule-machine", PHOTO, false));
        assertThat(result.propertyId()).isEqualTo(15L);
        assertThat(result.name()).isEqualTo("Ma cafetière");
        assertThat(result.photoUrl()).isEqualTo(PHOTO);
        assertThat(result.catalogKey()).isEqualTo("capsule-machine");
        verify(repository).save(argThat(item -> item.getOrganizationId().equals(7L) && item.getId() == null));
    }

    @Test void partialLegacyUpdatePreservesPhotoButExplicitRemovalRestoresLibrary() {
        var item = new PropertyInventoryItem();
        item.setName("Cafetière"); item.setPhotoUrl(PHOTO); item.setCatalogKey("capsule-machine");
        when(repository.findByPropertyIdAndId(15L, 3L)).thenReturn(Optional.of(item));
        when(repository.save(any())).thenAnswer(call -> call.getArgument(0));
        var result = service.updateInventoryItem(15L, 3L, new PropertyInventoryItemDto(null, null, null, null, 4, null));
        assertThat(result.photoUrl()).isEqualTo(PHOTO);
        assertThat(result.catalogKey()).isEqualTo("capsule-machine");
        result = service.updateInventoryItem(15L, 3L, dto("Cafetière", 4, "capsule-machine", null, true));
        assertThat(result.photoUrl()).isNull();
        assertThat(result.catalogKey()).isEqualTo("capsule-machine");
    }

    @Test void addsWholeSelectionWithPropertyAndTenantFromContext() {
        when(repository.saveAll(any())).thenAnswer(call -> call.getArgument(0));
        var result = service.addInventoryItems(15L, List.of(dto("Lave-linge", 1, "front-washer", null, null), dto("Lave-vaisselle", 2, "dishwasher", null, null)));
        assertThat(result).extracting(PropertyInventoryItemDto::catalogKey).containsExactly("front-washer", "dishwasher");
        verify(repository).saveAll(argThat(rows -> {
            for (var row : rows) if (!row.getOrganizationId().equals(7L) || !row.getPropertyId().equals(15L) || row.getId() != null) return false;
            return true;
        }));
    }

    @Test void validatesEntireBatchBeforeAnyWrite() {
        assertThatThrownBy(() -> service.addInventoryItems(15L, List.of(dto("Valide", 1, "custom", null, null), dto("", 1, "custom", null, null))))
                .isInstanceOf(ResponseStatusException.class);
        verifyNoInteractions(repository);
    }

    @Test void rejectsEmptyOrOversizedBatches() {
        for (var rows : List.of(List.<PropertyInventoryItemDto>of(), Collections.nCopies(101, dto("Objet", 1, "custom", null, null)))) {
            assertThatThrownBy(() -> service.addInventoryItems(15L, rows)).isInstanceOf(ResponseStatusException.class);
        }
        verifyNoInteractions(repository);
    }

    @ParameterizedTest @ValueSource(ints = { -1, 0, 10001 })
    void rejectsInvalidQuantity(int quantity) {
        assertThatThrownBy(() -> service.addInventoryItem(15L, dto("Objet", quantity, "custom", null, null))).isInstanceOf(ResponseStatusException.class);
        verifyNoInteractions(repository);
    }

    @ParameterizedTest @ValueSource(strings = { "https://example.com/photo.jpg", "data:image/svg+xml;base64,PHN2Zz4=", "data:image/png;base64,AAAA" })
    void rejectsRemoteOrActiveOrMalformedImages(String photo) {
        assertThatThrownBy(() -> service.addInventoryItem(15L, dto("Objet", 1, "custom", photo, null))).isInstanceOf(ResponseStatusException.class);
        verifyNoInteractions(repository);
    }

    @Test void rejectsInvalidKeysAndHugeImages() {
        assertThatThrownBy(() -> service.addInventoryItem(15L, dto("Objet", 1, "../../evil", null, null))).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> service.addInventoryItem(15L, dto("Objet", 1, "custom", "data:image/png;base64," + "A".repeat(400000), null))).isInstanceOf(ResponseStatusException.class);
        verifyNoInteractions(repository);
    }

    @Test void migrationPreservesOldInventoryAndPersistsNewVisuals() throws Exception {
        try (var connection = DriverManager.getConnection("jdbc:h2:mem:inventory_visuals;MODE=PostgreSQL")) {
            try (var statement = connection.createStatement()) {
                statement.execute("CREATE TABLE properties (id BIGINT PRIMARY KEY)");
                statement.execute("CREATE TABLE reservations (id BIGINT PRIMARY KEY)");
                statement.execute("INSERT INTO properties VALUES (15)");
            }
            ScriptUtils.executeSqlScript(connection, new ClassPathResource("db/changelog/changes/0098__create_property_inventory_tables.sql"));
            try (var statement = connection.createStatement()) {
                statement.execute("INSERT INTO property_inventory_items (organization_id, property_id, name) VALUES (7, 15, 'Cafetière')");
            }
            ScriptUtils.executeSqlScript(connection, new ClassPathResource("db/changelog/changes/0483__inventory_item_visuals.sql"));
            try (var statement = connection.createStatement(); var row = statement.executeQuery("SELECT * FROM property_inventory_items")) {
                assertThat(row.next()).isTrue();
                assertThat(row.getString("name")).isEqualTo("Cafetière");
                assertThat(row.getString("catalog_key")).isNull();
                assertThat(row.getString("photo_url")).isNull();
            }
            try (var update = connection.prepareStatement("UPDATE property_inventory_items SET catalog_key = ?, photo_url = ? WHERE id = 1")) {
                update.setString(1, "capsule-machine"); update.setString(2, PHOTO); assertThat(update.executeUpdate()).isEqualTo(1);
            }
            try (var statement = connection.createStatement(); var row = statement.executeQuery("SELECT catalog_key, photo_url FROM property_inventory_items")) {
                assertThat(row.next()).isTrue(); assertThat(row.getString(1)).isEqualTo("capsule-machine"); assertThat(row.getString(2)).isEqualTo(PHOTO);
            }
        }
    }
}
