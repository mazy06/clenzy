package com.clenzy.service.messaging;

import com.clenzy.model.MessageChannelType;
import com.clenzy.model.WhatsAppConfig;
import com.clenzy.repository.WhatsAppConfigRepository;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class WhatsAppChannelTest {

    @Mock private WhatsAppApiService apiService;
    @Mock private WhatsAppConfigRepository configRepository;
    @Mock private TenantContext tenantContext;

    private WhatsAppChannel channel;

    @BeforeEach
    void setUp() {
        channel = new WhatsAppChannel(apiService, configRepository, tenantContext);
    }

    @Test
    void getChannelType_returnsWhatsApp() {
        assertThat(channel.getChannelType()).isEqualTo(MessageChannelType.WHATSAPP);
    }

    @Test
    void isAvailable_enabledConfig_returnsTrue() {
        WhatsAppConfig config = new WhatsAppConfig();
        config.setEnabled(true);
        when(tenantContext.getOrganizationId()).thenReturn(1L);
        when(configRepository.findByOrganizationId(1L)).thenReturn(Optional.of(config));

        assertThat(channel.isAvailable()).isTrue();
    }

    @Test
    void isAvailable_noConfig_returnsFalse() {
        when(tenantContext.getOrganizationId()).thenReturn(1L);
        when(configRepository.findByOrganizationId(1L)).thenReturn(Optional.empty());

        assertThat(channel.isAvailable()).isFalse();
    }

    @Test
    void isAvailable_disabledConfig_returnsFalse() {
        WhatsAppConfig config = new WhatsAppConfig();
        config.setEnabled(false);
        when(tenantContext.getOrganizationId()).thenReturn(1L);
        when(configRepository.findByOrganizationId(1L)).thenReturn(Optional.of(config));

        assertThat(channel.isAvailable()).isFalse();
    }

    @Test
    void send_noPhone_returnsFailure() {
        MessageDeliveryRequest request = new MessageDeliveryRequest(
            "test@email.com", null, "Jean", "Subject", "<p>Hello</p>", "Hello", "fr");

        MessageDeliveryResult result = channel.send(request);

        assertThat(result.success()).isFalse();
        assertThat(result.errorMessage()).contains("telephone");
    }

    @Test
    void send_emptyPhone_returnsFailure() {
        MessageDeliveryRequest request = new MessageDeliveryRequest(
            "test@email.com", "  ", "Jean", "Subject", "<p>Hello</p>", "Hello", "fr");

        MessageDeliveryResult result = channel.send(request);

        assertThat(result.success()).isFalse();
    }

    @Test
    void send_validPhone_callsApiService() {
        WhatsAppConfig config = new WhatsAppConfig();
        config.setEnabled(true);
        config.setApiToken("test-token");

        when(tenantContext.getOrganizationId()).thenReturn(1L);
        when(configRepository.findByOrganizationId(1L)).thenReturn(Optional.of(config));
        when(apiService.sendTextMessage(config, "+33612345678", "Hello")).thenReturn("msg-123");

        MessageDeliveryRequest request = new MessageDeliveryRequest(
            "test@email.com", "+33612345678", "Jean", "Subject", "<p>Hello</p>", "Hello", "fr");

        MessageDeliveryResult result = channel.send(request);

        assertThat(result.success()).isTrue();
        assertThat(result.providerMessageId()).isEqualTo("msg-123");
    }

    @Test
    void send_apiException_returnsFailure() {
        WhatsAppConfig config = new WhatsAppConfig();
        config.setEnabled(true);

        when(tenantContext.getOrganizationId()).thenReturn(1L);
        when(configRepository.findByOrganizationId(1L)).thenReturn(Optional.of(config));
        when(apiService.sendTextMessage(any(), anyString(), anyString()))
            .thenThrow(new RuntimeException("API error"));

        MessageDeliveryRequest request = new MessageDeliveryRequest(
            null, "+33612345678", "Jean", "Subject", "<p>Hello</p>", "Hello", "fr");

        MessageDeliveryResult result = channel.send(request);

        assertThat(result.success()).isFalse();
        assertThat(result.errorMessage()).contains("API error");
    }
}
