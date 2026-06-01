package com.clenzy.controller;

import com.clenzy.dto.PaymentMethodConfigDto;
import com.clenzy.dto.PaymentMethodConfigUpdateRequest;
import com.clenzy.model.PaymentMethodConfig;
import com.clenzy.model.PaymentProviderType;
import com.clenzy.service.PaymentMethodConfigService;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PaymentMethodConfigControllerTest {

    @Mock private PaymentMethodConfigService configService;
    @Mock private TenantContext tenantContext;

    @InjectMocks
    private PaymentMethodConfigController controller;

    @BeforeEach
    void setUp() {
        lenient().when(tenantContext.getRequiredOrganizationId()).thenReturn(7L);
    }

    @Test
    void listConfigs_mapsToDtos() {
        PaymentMethodConfig stripe = buildConfig(1L, PaymentProviderType.STRIPE, "FR,BE", true, false);
        PaymentMethodConfig paytabs = buildConfig(2L, PaymentProviderType.PAYTABS, null, true, true);
        when(configService.getConfigsForOrganization(7L)).thenReturn(List.of(stripe, paytabs));

        ResponseEntity<List<PaymentMethodConfigDto>> response = controller.listConfigs();

        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<PaymentMethodConfigDto> body = response.getBody();
        assertNotNull(body);
        assertEquals(2, body.size());

        PaymentMethodConfigDto first = body.get(0);
        assertEquals(1L, first.id());
        assertEquals("STRIPE", first.providerType());
        assertTrue(first.enabled());
        assertEquals(List.of("FR", "BE"), first.countryCodes());
        assertFalse(first.sandboxMode());

        PaymentMethodConfigDto second = body.get(1);
        assertEquals("PAYTABS", second.providerType());
        assertEquals(List.of(), second.countryCodes());
        assertTrue(second.sandboxMode());
    }

    @Test
    void listConfigs_emptyList_returnsEmpty() {
        when(configService.getConfigsForOrganization(7L)).thenReturn(List.of());

        ResponseEntity<List<PaymentMethodConfigDto>> response = controller.listConfigs();

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertTrue(response.getBody().isEmpty());
    }

    @Test
    void updateConfig_passesThroughToService() {
        PaymentMethodConfigUpdateRequest req = new PaymentMethodConfigUpdateRequest(
            true, "FR", true, "apiKey", "apiSecret", "webhookSecret", null);
        PaymentMethodConfig saved = buildConfig(99L, PaymentProviderType.STRIPE, "FR", true, true);
        when(configService.updateConfig(eq(7L), eq(PaymentProviderType.STRIPE),
            eq(true), eq("FR"), eq(true), eq("apiKey"), eq("apiSecret"),
            eq("webhookSecret"), isNull())).thenReturn(saved);

        ResponseEntity<PaymentMethodConfigDto> response = controller.updateConfig("stripe", req);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        PaymentMethodConfigDto body = response.getBody();
        assertNotNull(body);
        assertEquals(99L, body.id());
        assertEquals("STRIPE", body.providerType());
    }

    @Test
    void updateConfig_lowercaseProvider_isUppercased() {
        PaymentMethodConfigUpdateRequest req = new PaymentMethodConfigUpdateRequest(
            null, null, null, null, null, null, null);
        PaymentMethodConfig saved = buildConfig(2L, PaymentProviderType.PAYPAL, null, false, false);
        when(configService.updateConfig(anyLong(), eq(PaymentProviderType.PAYPAL),
            any(), any(), any(), any(), any(), any(), any())).thenReturn(saved);

        ResponseEntity<PaymentMethodConfigDto> response = controller.updateConfig("paypal", req);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("PAYPAL", response.getBody().providerType());
    }

    @Test
    void updateConfig_invalidProvider_throwsException() {
        PaymentMethodConfigUpdateRequest req = new PaymentMethodConfigUpdateRequest(
            null, null, null, null, null, null, null);
        assertThrows(IllegalArgumentException.class,
            () -> controller.updateConfig("not-a-provider", req));
    }

    @Test
    void getDefaults_returnsProviderNames() {
        when(configService.getDefaultProvidersForCountry("FR"))
            .thenReturn(List.of(PaymentProviderType.STRIPE, PaymentProviderType.PAYPAL));

        ResponseEntity<List<String>> response = controller.getDefaults("FR");

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(List.of("STRIPE", "PAYPAL"), response.getBody());
    }

    @Test
    void getDefaults_emptyListWhenNoProviders() {
        when(configService.getDefaultProvidersForCountry("XX")).thenReturn(List.of());

        ResponseEntity<List<String>> response = controller.getDefaults("XX");

        assertTrue(response.getBody().isEmpty());
    }

    private PaymentMethodConfig buildConfig(Long id, PaymentProviderType type,
                                             String countries, boolean enabled, boolean sandbox) {
        PaymentMethodConfig c = mock(PaymentMethodConfig.class);
        when(c.getId()).thenReturn(id);
        when(c.getProviderType()).thenReturn(type);
        when(c.getEnabled()).thenReturn(enabled);
        when(c.getCountryCodes()).thenReturn(countries);
        when(c.getSandboxMode()).thenReturn(sandbox);
        lenient().when(c.getConfigJson()).thenReturn(null);
        return c;
    }
}
