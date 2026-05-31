package com.clenzy.controller;

import com.clenzy.dto.UpdateWhatsAppConfigRequest;
import com.clenzy.dto.WhatsAppConfigDto;
import com.clenzy.dto.WhatsAppTemplateDto;
import com.clenzy.model.WhatsAppConfig;
import com.clenzy.model.WhatsAppProviderType;
import com.clenzy.model.WhatsAppTemplate;
import com.clenzy.repository.WhatsAppConfigRepository;
import com.clenzy.repository.WhatsAppTemplateRepository;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class WhatsAppConfigControllerTest {

    @Mock private WhatsAppConfigRepository configRepository;
    @Mock private WhatsAppTemplateRepository templateRepository;
    @Mock private TenantContext tenantContext;

    private WhatsAppConfigController controller;

    @BeforeEach
    void setUp() {
        controller = new WhatsAppConfigController(configRepository, templateRepository, tenantContext);
        lenient().when(tenantContext.getOrganizationId()).thenReturn(11L);
    }

    private WhatsAppConfig existingConfig() {
        WhatsAppConfig c = new WhatsAppConfig();
        c.setId(5L);
        c.setOrganizationId(11L);
        c.setProvider(WhatsAppProviderType.META);
        c.setApiToken("old-token");
        c.setPhoneNumberId("100");
        c.setBusinessAccountId("200");
        c.setEnabled(true);
        return c;
    }

    @Test
    void getConfig_whenExists_returnsDto() {
        when(configRepository.findByOrganizationId(11L)).thenReturn(Optional.of(existingConfig()));

        ResponseEntity<WhatsAppConfigDto> resp = controller.getConfig();

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).isNotNull();
        assertThat(resp.getBody().id()).isEqualTo(5L);
        assertThat(resp.getBody().provider()).isEqualTo(WhatsAppProviderType.META);
        assertThat(resp.getBody().hasApiToken()).isTrue();
        assertThat(resp.getBody().enabled()).isTrue();
    }

    @Test
    void getConfig_whenAbsent_returns404() {
        when(configRepository.findByOrganizationId(11L)).thenReturn(Optional.empty());

        ResponseEntity<WhatsAppConfigDto> resp = controller.getConfig();
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void updateConfig_existingOrg_mergesAndSaves() {
        WhatsAppConfig existing = existingConfig();
        when(configRepository.findByOrganizationId(11L)).thenReturn(Optional.of(existing));
        when(configRepository.save(any(WhatsAppConfig.class))).thenAnswer(inv -> inv.getArgument(0));

        UpdateWhatsAppConfigRequest req = new UpdateWhatsAppConfigRequest(
                WhatsAppProviderType.OPENWA, "new-token", "999", "888", "verify-token",
                "owa-session", "owa-key", false);

        ResponseEntity<WhatsAppConfigDto> resp = controller.updateConfig(req);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        verify(configRepository).save(existing);
        assertThat(existing.getProvider()).isEqualTo(WhatsAppProviderType.OPENWA);
        assertThat(existing.getApiToken()).isEqualTo("new-token");
        assertThat(existing.getPhoneNumberId()).isEqualTo("999");
        assertThat(existing.getOpenwaSessionId()).isEqualTo("owa-session");
        assertThat(existing.getOpenwaApiKey()).isEqualTo("owa-key");
        assertThat(existing.isEnabled()).isFalse();
    }

    @Test
    void updateConfig_newOrg_createsNewConfig() {
        when(configRepository.findByOrganizationId(11L)).thenReturn(Optional.empty());
        when(configRepository.save(any(WhatsAppConfig.class))).thenAnswer(inv -> {
            WhatsAppConfig c = inv.getArgument(0);
            c.setId(99L);
            return c;
        });

        UpdateWhatsAppConfigRequest req = new UpdateWhatsAppConfigRequest(
                WhatsAppProviderType.META, "first-token", "p-id", "b-id", null,
                null, null, true);

        ResponseEntity<WhatsAppConfigDto> resp = controller.updateConfig(req);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody().id()).isEqualTo(99L);
        assertThat(resp.getBody().enabled()).isTrue();
    }

    @Test
    void updateConfig_nullFields_doNotOverwriteExisting() {
        WhatsAppConfig existing = existingConfig();
        when(configRepository.findByOrganizationId(11L)).thenReturn(Optional.of(existing));
        when(configRepository.save(any(WhatsAppConfig.class))).thenAnswer(inv -> inv.getArgument(0));

        UpdateWhatsAppConfigRequest req = new UpdateWhatsAppConfigRequest(
                null, null, null, null, null, null, null, null);

        controller.updateConfig(req);
        assertThat(existing.getProvider()).isEqualTo(WhatsAppProviderType.META);
        assertThat(existing.getApiToken()).isEqualTo("old-token");
        assertThat(existing.getPhoneNumberId()).isEqualTo("100");
        assertThat(existing.isEnabled()).isTrue();
    }

    @Test
    void getTemplates_returnsMappedList() {
        WhatsAppTemplate t = new WhatsAppTemplate();
        when(templateRepository.findByOrganizationId(11L)).thenReturn(List.of(t));

        ResponseEntity<List<WhatsAppTemplateDto>> resp = controller.getTemplates();

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).hasSize(1);
    }

    @Test
    void getTemplates_emptyOrg_returnsEmpty() {
        when(templateRepository.findByOrganizationId(11L)).thenReturn(List.of());

        ResponseEntity<List<WhatsAppTemplateDto>> resp = controller.getTemplates();
        assertThat(resp.getBody()).isEmpty();
    }
}
