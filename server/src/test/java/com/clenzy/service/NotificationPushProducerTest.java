package com.clenzy.service;

import com.clenzy.config.KafkaConfig;
import com.clenzy.model.Notification;
import com.clenzy.model.NotificationKey;
import com.clenzy.repository.NotificationRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.tenant.TenantContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Moteur Ménage 2B (P4) — producteur push : la notification in-app persiste une
 * entrée OUTBOX ({@code notifications.send}) pour les clés TERRAIN whitelistées,
 * rien pour les autres, et un échec de publication ne casse jamais l'in-app.
 */
@ExtendWith(MockitoExtension.class)
class NotificationPushProducerTest {

    @Mock private NotificationRepository notificationRepository;
    @Mock private NotificationPreferenceService preferenceService;
    @Mock private UserRepository userRepository;
    @Mock private TenantContext tenantContext;
    @Mock private OutboxPublisher outboxPublisher;

    private NotificationService service;

    @BeforeEach
    void setUp() {
        service = new NotificationService(notificationRepository, preferenceService,
                userRepository, tenantContext, outboxPublisher, new ObjectMapper());
        when(preferenceService.isEnabled(anyString(), any())).thenReturn(true);
        when(notificationRepository.save(any())).thenAnswer(inv -> {
            Notification n = inv.getArgument(0);
            n.setId(77L);
            return n;
        });
    }

    @Test
    @DisplayName("clé whitelistée → événement push publié dans l'outbox (topic notifications.send)")
    void whenWhitelistedKey_thenOutboxEventPublished() {
        service.send("kc-user", NotificationKey.INTERVENTION_ASSIGNED_TO_USER,
                "Intervention assignee", "Vous etes assigne. Remuneration: 88 EUR.",
                "/interventions/42", 7L);

        verify(outboxPublisher).publish(
                eq("NOTIFICATION"), eq("77"), eq("PUSH_INTERVENTION_ASSIGNED_TO_USER"),
                eq(KafkaConfig.TOPIC_NOTIFICATIONS), eq("kc-user"),
                argThat(payload -> payload.contains("\"userId\":\"kc-user\"")
                        && payload.contains("\"notificationType\":\"INTERVENTION_ASSIGNED_TO_USER\"")
                        && payload.contains("\"entityId\":\"42\"")
                        && payload.contains("\"actionUrl\":\"/interventions/42\"")),
                eq(7L));
    }

    @Test
    @DisplayName("clé hors whitelist → aucun événement push")
    void whenNonWhitelistedKey_thenNoOutboxEvent() {
        service.send("kc-user", NotificationKey.PAYMENT_CONFIRMED,
                "Paiement confirme", "Montant: 120 EUR.", "/interventions/42", 7L);

        verify(outboxPublisher, never()).publish(any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("échec de publication outbox → la notification in-app survit")
    void whenOutboxFails_thenInAppNotificationStillCreated() {
        doThrow(new RuntimeException("kafka/outbox down")).when(outboxPublisher)
                .publish(any(), any(), any(), any(), any(), any(), any());

        var dto = service.send("kc-user", NotificationKey.INTERVENTION_STARTED,
                "Intervention demarree", "C'est parti.", "/interventions/9", 7L);

        assertThat(dto).isNotNull();
        verify(notificationRepository).save(any());
    }

    @Test
    @DisplayName("actionUrl sans id numérique → payload sans entityId (pas d'erreur)")
    void whenActionUrlHasNoNumericId_thenNoEntityId() {
        service.send("kc-user", NotificationKey.SERVICE_REQUEST_ESCALATION,
                "Escalade", "Demande escaladee.", "/service-requests", 7L);

        verify(outboxPublisher).publish(any(), any(), any(), any(), any(),
                argThat(payload -> !payload.contains("entityId")), any());
    }
}
