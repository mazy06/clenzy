package com.clenzy.integration.airbnb.service;

import com.clenzy.integration.airbnb.repository.AirbnbListingMappingRepository;
import com.clenzy.service.AuditLogService;
import com.clenzy.service.messaging.ConversationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.HashMap;
import java.util.Map;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link AirbnbMessageService}.
 * Covers Kafka event handling for message.received, message.sent,
 * missing data, and unknown event types.
 */
@ExtendWith(MockitoExtension.class)
class AirbnbMessageServiceTest {

    @Mock private AirbnbListingMappingRepository listingMappingRepository;
    @Mock private AirbnbWebhookService webhookService;
    @Mock private AuditLogService auditLogService;
    @Mock private ConversationService conversationService;

    private AirbnbMessageService service;

    @BeforeEach
    void setUp() {
        service = new AirbnbMessageService(listingMappingRepository, webhookService, auditLogService, conversationService);
    }

    private Map<String, Object> buildEvent(String eventType, String eventId, Map<String, Object> data) {
        Map<String, Object> event = new HashMap<>();
        event.put("event_type", eventType);
        event.put("event_id", eventId);
        event.put("data", data);
        return event;
    }

    // ===================================================================
    // Missing data
    // ===================================================================

    @Nested
    @DisplayName("handleMessageEvent - missing data")
    class MissingData {

        @Test
        @DisplayName("marks event as failed when data field is null")
        void whenDataFieldNull_thenMarksFailed() {
            // Arrange
            Map<String, Object> event = buildEvent("message.received", "evt-1", null);

            // Act
            service.handleMessageEvent(event);

            // Assert
            verify(webhookService).markAsFailed("evt-1", "Missing data field");
            verify(auditLogService, never()).logSync(any(), any(), any());
        }
    }

    // ===================================================================
    // message.received
    // ===================================================================

    @Nested
    @DisplayName("handleMessageEvent - message.received")
    class MessageReceived {

        @Test
        @DisplayName("logs audit entry for received message")
        void whenMessageReceived_thenLogsAudit() {
            // Arrange
            Map<String, Object> data = new HashMap<>();
            data.put("reservation_id", "RES-001");
            data.put("sender_name", "John Doe");
            data.put("content", "Hello, when is check-in?");
            Map<String, Object> event = buildEvent("message.received", "evt-2", data);

            // Act
            service.handleMessageEvent(event);

            // Assert
            verify(auditLogService).logSync(eq("AirbnbMessage"), eq("RES-001"),
                    contains("John Doe"));
            verify(webhookService).markAsProcessed("evt-2");
        }

        @Test
        @DisplayName("truncates long message content in log without error")
        void whenLongContent_thenProcessesWithoutError() {
            // Arrange
            Map<String, Object> data = new HashMap<>();
            data.put("reservation_id", "RES-002");
            data.put("sender_name", "Jane");
            data.put("content", "A".repeat(200));
            Map<String, Object> event = buildEvent("message.received", "evt-3", data);

            // Act
            service.handleMessageEvent(event);

            // Assert
            verify(auditLogService).logSync(eq("AirbnbMessage"), eq("RES-002"), contains("Jane"));
            verify(webhookService).markAsProcessed("evt-3");
        }

        @Test
        @DisplayName("handles null content gracefully")
        void whenNullContent_thenProcessesWithoutError() {
            // Arrange
            Map<String, Object> data = new HashMap<>();
            data.put("reservation_id", "RES-003");
            data.put("sender_name", "Guest");
            data.put("content", null);
            Map<String, Object> event = buildEvent("message.received", "evt-4", data);

            // Act
            service.handleMessageEvent(event);

            // Assert
            verify(auditLogService).logSync(eq("AirbnbMessage"), eq("RES-003"), contains("Guest"));
            verify(webhookService).markAsProcessed("evt-4");
        }
    }

    // ===================================================================
    // message.sent
    // ===================================================================

    @Nested
    @DisplayName("handleMessageEvent - message.sent")
    class MessageSent {

        @Test
        @DisplayName("processes sent message confirmation without audit log")
        void whenMessageSent_thenMarksProcessed() {
            // Arrange
            Map<String, Object> data = new HashMap<>();
            data.put("reservation_id", "RES-010");
            Map<String, Object> event = buildEvent("message.sent", "evt-5", data);

            // Act
            service.handleMessageEvent(event);

            // Assert
            verify(webhookService).markAsProcessed("evt-5");
            // message.sent only logs, no auditLogService.logSync call
            verify(auditLogService, never()).logSync(any(), any(), any());
        }
    }

    // ===================================================================
    // Unknown type
    // ===================================================================

    @Nested
    @DisplayName("handleMessageEvent - unknown type")
    class UnknownType {

        @Test
        @DisplayName("processes unknown event type without action")
        void whenUnknownType_thenMarksProcessed() {
            // Arrange
            Map<String, Object> data = new HashMap<>();
            data.put("reservation_id", "RES-020");
            Map<String, Object> event = buildEvent("message.unknown", "evt-6", data);

            // Act
            service.handleMessageEvent(event);

            // Assert
            verify(webhookService).markAsProcessed("evt-6");
            verify(auditLogService, never()).logSync(any(), any(), any());
        }
    }

    // ===================================================================
    // Exception handling
    // ===================================================================

    @Nested
    @DisplayName("handleMessageEvent - exception handling")
    class ExceptionHandling {

        @Test
        @DisplayName("marks as failed when unexpected exception occurs")
        void whenExceptionThrown_thenMarksFailed() {
            // Arrange
            Map<String, Object> data = new HashMap<>();
            data.put("reservation_id", "RES-030");
            data.put("sender_name", "Bad Guest");
            data.put("content", "Hello");
            Map<String, Object> event = buildEvent("message.received", "evt-7", data);
            doThrow(new RuntimeException("Audit DB error"))
                    .when(auditLogService).logSync(any(), any(), any());

            // Act
            service.handleMessageEvent(event);

            // Assert
            verify(webhookService).markAsFailed(eq("evt-7"), contains("Audit DB error"));
        }
    }
}
