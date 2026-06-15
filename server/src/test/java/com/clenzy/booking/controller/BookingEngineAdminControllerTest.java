package com.clenzy.booking.controller;

import com.clenzy.booking.dto.BookingEngineAdminConfigDto;
import com.clenzy.booking.model.BookingEngineConfig;
import com.clenzy.booking.repository.BookingEngineConfigRepository;
import com.clenzy.booking.service.BookingEngineAdminService;
import com.clenzy.booking.service.BookingEngineConfigService;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BookingEngineAdminControllerTest {

    @Mock private BookingEngineAdminService adminService;
    @Mock private BookingEngineConfigRepository configRepository;
    @Mock private TenantContext tenantContext;

    private BookingEngineAdminController controller;

    @BeforeEach
    void setUp() {
        // Pattern Vague A : service de statut REEL construit au-dessus des mocks
        // (configRepository + tenantContext) pour conserver la couverture e2e.
        BookingEngineConfigService configService = new BookingEngineConfigService(
            configRepository, mock(OrganizationRepository.class), tenantContext);
        controller = new BookingEngineAdminController(adminService, configService);
    }

    private BookingEngineAdminConfigDto dto(Long id) {
        return new BookingEngineAdminConfigDto(id, 1L, "Template", true, "key-xxxxxxxxxxxxxxxxxxxx-1234",
                "#000", "#fff", null, null, "fr", "EUR", 0, 365, "Flex", null, null,
                "https://*", true, true, true, true, null, null, null, null, null, null,
                null, null, null, null, null, null, null, null, null);
    }

    @Test
    void status_noConfig_returnsNotConfigured() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        when(configRepository.findAllByOrganizationId(1L)).thenReturn(List.of());

        ResponseEntity<Map<String, Object>> response = controller.getStatus();
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        Map<String, Object> body = response.getBody();
        assertThat(body).containsEntry("configured", false);
        assertThat(body).containsEntry("enabled", false);
        assertThat(body).containsEntry("templateCount", 0);
    }

    @Test
    void status_configsExist_returnsConfigured() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        BookingEngineConfig c1 = mock(BookingEngineConfig.class);
        when(c1.isEnabled()).thenReturn(true);
        when(c1.getApiKey()).thenReturn("apikey1234567890abcdefxx");
        BookingEngineConfig c2 = mock(BookingEngineConfig.class);
        lenient().when(c2.isEnabled()).thenReturn(false);
        when(configRepository.findAllByOrganizationId(1L)).thenReturn(List.of(c1, c2));

        ResponseEntity<Map<String, Object>> response = controller.getStatus();
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        Map<String, Object> body = response.getBody();
        assertThat(body).containsEntry("configured", true);
        assertThat(body).containsEntry("enabled", true);
        assertThat(body).containsEntry("templateCount", 2);
        assertThat((String) body.get("apiKey")).contains("...");
    }

    @Test
    void status_disabledConfigs() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        BookingEngineConfig c = mock(BookingEngineConfig.class);
        when(c.isEnabled()).thenReturn(false);
        when(c.getApiKey()).thenReturn("short");
        when(configRepository.findAllByOrganizationId(1L)).thenReturn(List.of(c));

        ResponseEntity<Map<String, Object>> response = controller.getStatus();
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        Map<String, Object> body = response.getBody();
        assertThat(body).containsEntry("enabled", false);
        assertThat(body).containsEntry("apiKey", "****");
    }

    @Test
    void listConfigs() {
        when(adminService.listConfigs()).thenReturn(List.of(dto(1L), dto(2L)));

        ResponseEntity<List<BookingEngineAdminConfigDto>> response = controller.listConfigs();
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).hasSize(2);
    }

    @Test
    void listAllConfigs() {
        when(adminService.listAllConfigs()).thenReturn(List.of(dto(1L)));

        ResponseEntity<List<BookingEngineAdminConfigDto>> response = controller.listAllConfigs();
        assertThat(response.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void getConfigById() {
        when(adminService.getConfigById(5L)).thenReturn(dto(5L));

        ResponseEntity<BookingEngineAdminConfigDto> response = controller.getConfigById(5L);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().id()).isEqualTo(5L);
    }

    @Test
    void createConfig() {
        BookingEngineAdminConfigDto in = dto(null);
        BookingEngineAdminConfigDto out = dto(10L);
        when(adminService.createConfig(in)).thenReturn(out);

        ResponseEntity<BookingEngineAdminConfigDto> response = controller.createConfig(in);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().id()).isEqualTo(10L);
    }

    @Test
    void updateConfig_byId() {
        BookingEngineAdminConfigDto in = dto(5L);
        when(adminService.updateConfig(5L, in)).thenReturn(in);

        ResponseEntity<BookingEngineAdminConfigDto> response = controller.updateConfig(5L, in);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void deleteConfig_noContent() {
        ResponseEntity<Void> response = controller.deleteConfig(5L);
        assertThat(response.getStatusCode().value()).isEqualTo(204);
        verify(adminService).deleteConfig(5L);
    }

    @Test
    void toggleEnabled_byId_true() {
        when(adminService.toggleEnabled(5L, true)).thenReturn(dto(5L));

        ResponseEntity<BookingEngineAdminConfigDto> response = controller.toggleEnabled(5L, Map.of("enabled", true));
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        verify(adminService).toggleEnabled(5L, true);
    }

    @Test
    void toggleEnabled_byId_false() {
        when(adminService.toggleEnabled(5L, false)).thenReturn(dto(5L));

        ResponseEntity<BookingEngineAdminConfigDto> response = controller.toggleEnabled(5L, Map.of("enabled", false));
        assertThat(response.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void toggleEnabled_byId_nullValue_treatsAsFalse() {
        when(adminService.toggleEnabled(5L, false)).thenReturn(dto(5L));

        ResponseEntity<BookingEngineAdminConfigDto> response = controller.toggleEnabled(5L, Map.of());
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        verify(adminService).toggleEnabled(5L, false);
    }

    @Test
    void regenerateApiKey_byId() {
        when(adminService.regenerateApiKey(5L)).thenReturn(dto(5L));

        ResponseEntity<BookingEngineAdminConfigDto> response = controller.regenerateApiKey(5L);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void legacyGetConfig() {
        when(adminService.getConfig()).thenReturn(dto(1L));

        ResponseEntity<BookingEngineAdminConfigDto> response = controller.getConfig();
        assertThat(response.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void legacyUpdateConfig() {
        BookingEngineAdminConfigDto existing = dto(1L);
        when(adminService.getConfig()).thenReturn(existing);
        BookingEngineAdminConfigDto in = dto(null);
        when(adminService.updateConfig(1L, in)).thenReturn(existing);

        ResponseEntity<BookingEngineAdminConfigDto> response = controller.updateConfig(in);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void legacyToggle() {
        BookingEngineAdminConfigDto existing = dto(1L);
        when(adminService.getConfig()).thenReturn(existing);
        when(adminService.toggleEnabled(1L, true)).thenReturn(existing);

        ResponseEntity<BookingEngineAdminConfigDto> response = controller.toggleEnabled(Map.of("enabled", true));
        assertThat(response.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void legacyRegenerateKey() {
        BookingEngineAdminConfigDto existing = dto(1L);
        when(adminService.getConfig()).thenReturn(existing);
        when(adminService.regenerateApiKey(1L)).thenReturn(existing);

        ResponseEntity<BookingEngineAdminConfigDto> response = controller.regenerateApiKey();
        assertThat(response.getStatusCode().value()).isEqualTo(200);
    }
}
