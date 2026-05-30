package com.clenzy.integration.zapier.controller;

import com.clenzy.integration.zapier.config.ZapierConfig;
import com.clenzy.integration.zapier.model.WebhookSubscription;
import com.clenzy.integration.zapier.repository.WebhookSubscriptionRepository;
import com.clenzy.service.TokenEncryptionService;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ZapierControllerTest {

    @Mock private WebhookSubscriptionRepository subscriptionRepository;
    @Mock private TokenEncryptionService tokenEncryptionService;
    @Mock private ZapierConfig config;
    @Mock private TenantContext tenantContext;

    private ZapierController controller;

    @BeforeEach
    void setUp() {
        controller = new ZapierController(subscriptionRepository, tokenEncryptionService, config, tenantContext);
    }

    private WebhookSubscription sub(Long id, Long orgId, String event) {
        WebhookSubscription s = new WebhookSubscription();
        s.setId(id);
        s.setOrganizationId(orgId);
        s.setEventType(event);
        s.setTargetUrl("https://hook.test/" + id);
        s.setActive(true);
        return s;
    }

    @Test
    void list_returnsActiveSubscriptions() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        when(subscriptionRepository.findByOrganizationIdAndActive(1L, true))
                .thenReturn(List.of(sub(1L, 1L, "reservation.created"), sub(2L, 1L, "review.received")));

        ResponseEntity<List<ZapierController.WebhookSubscriptionResponse>> response = controller.listSubscriptions();
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).hasSize(2);
    }

    @Test
    void list_empty() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        when(subscriptionRepository.findByOrganizationIdAndActive(1L, true)).thenReturn(List.of());

        ResponseEntity<List<ZapierController.WebhookSubscriptionResponse>> response = controller.listSubscriptions();
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).isEmpty();
    }

    @Test
    void create_atLimit_429() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        when(config.getMaxSubscriptionsPerOrg()).thenReturn(10);
        when(subscriptionRepository.countByOrganizationId(1L)).thenReturn(10L);

        ResponseEntity<?> response = controller.createSubscription(
                new ZapierController.CreateSubscriptionRequest("reservation.created", "https://hook.test"));
        assertThat(response.getStatusCode().value()).isEqualTo(429);
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertThat(body).containsKey("error");
    }

    @Test
    void create_success() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        when(config.getMaxSubscriptionsPerOrg()).thenReturn(10);
        when(subscriptionRepository.countByOrganizationId(1L)).thenReturn(2L);
        when(tokenEncryptionService.encrypt(anyString())).thenReturn("enc-secret");

        WebhookSubscription saved = sub(5L, 1L, "reservation.created");
        when(subscriptionRepository.save(any(WebhookSubscription.class))).thenReturn(saved);

        ResponseEntity<?> response = controller.createSubscription(
                new ZapierController.CreateSubscriptionRequest("reservation.created", "https://hook.test"));
        assertThat(response.getStatusCode().value()).isEqualTo(201);
        ZapierController.CreateSubscriptionResponse body = (ZapierController.CreateSubscriptionResponse) response.getBody();
        assertThat(body).isNotNull();
        assertThat(body.id()).isEqualTo(5L);
        assertThat(body.secret()).startsWith("whsec_");
        verify(subscriptionRepository).save(any(WebhookSubscription.class));
    }

    @Test
    void deactivate_notFound_404() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        when(subscriptionRepository.findById(99L)).thenReturn(Optional.empty());

        ResponseEntity<Void> response = controller.deactivateSubscription(99L);
        assertThat(response.getStatusCode().value()).isEqualTo(404);
    }

    @Test
    void deactivate_wrongOrg_404() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        when(subscriptionRepository.findById(5L)).thenReturn(Optional.of(sub(5L, 99L, "x")));

        ResponseEntity<Void> response = controller.deactivateSubscription(5L);
        assertThat(response.getStatusCode().value()).isEqualTo(404);
    }

    @Test
    void deactivate_success_204() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        WebhookSubscription s = sub(5L, 1L, "x");
        when(subscriptionRepository.findById(5L)).thenReturn(Optional.of(s));

        ResponseEntity<Void> response = controller.deactivateSubscription(5L);
        assertThat(response.getStatusCode().value()).isEqualTo(204);
        assertThat(s.isActive()).isFalse();
        verify(subscriptionRepository).save(s);
    }
}
