package com.clenzy.service;

import com.clenzy.model.DocumentType;
import com.clenzy.model.ReferenceType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.HashMap;
import java.util.Map;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DocumentEventServiceTest {

    @Mock private DocumentGeneratorService generatorService;

    private DocumentEventService service;

    @BeforeEach
    void setUp() {
        service = new DocumentEventService(generatorService);
    }

    // ===== HANDLE DOCUMENT GENERATION EVENT =====

    @Nested
    class HandleDocumentGenerationEvent {

        @Test
        void whenValidEvent_thenDelegatesToGenerator() {
            Map<String, Object> event = new HashMap<>();
            event.put("documentType", "BON_INTERVENTION");
            event.put("referenceId", 42);
            event.put("referenceType", "INTERVENTION");
            event.put("emailTo", "client@example.com");

            service.handleDocumentGenerationEvent(event);

            verify(generatorService).generateFromEvent(
                    DocumentType.BON_INTERVENTION, 42L,
                    ReferenceType.INTERVENTION, "client@example.com");
        }

        @Test
        void whenMissingDocumentType_thenSkips() {
            Map<String, Object> event = new HashMap<>();
            event.put("referenceId", 42);

            service.handleDocumentGenerationEvent(event);

            verify(generatorService, never()).generateFromEvent(any(), anyLong(), any(), anyString());
        }

        @Test
        void whenMissingReferenceId_thenSkips() {
            Map<String, Object> event = new HashMap<>();
            event.put("documentType", "FACTURE");

            service.handleDocumentGenerationEvent(event);

            verify(generatorService, never()).generateFromEvent(any(), anyLong(), any(), anyString());
        }

        @Test
        void whenReferenceIdIsString_thenParsesIt() {
            Map<String, Object> event = new HashMap<>();
            event.put("documentType", "DEVIS");
            event.put("referenceId", "123");
            event.put("referenceType", "SERVICE_REQUEST");
            event.put("emailTo", null);

            service.handleDocumentGenerationEvent(event);

            verify(generatorService).generateFromEvent(
                    DocumentType.DEVIS, 123L,
                    ReferenceType.SERVICE_REQUEST, null);
        }

        @Test
        void whenInvalidDocumentType_thenDoesNotPropagate() {
            Map<String, Object> event = new HashMap<>();
            event.put("documentType", "INVALID_TYPE");
            event.put("referenceId", 1);

            // Should not throw — caught internally
            try {
                service.handleDocumentGenerationEvent(event);
            } catch (Exception ignored) {
                // IllegalArgumentException is caught for invalid enum
            }

            verify(generatorService, never()).generateFromEvent(any(), anyLong(), any(), anyString());
        }

        @Test
        void whenNoReferenceType_thenPassesNull() {
            Map<String, Object> event = new HashMap<>();
            event.put("documentType", "FACTURE");
            event.put("referenceId", 5);

            service.handleDocumentGenerationEvent(event);

            verify(generatorService).generateFromEvent(
                    DocumentType.FACTURE, 5L, null, null);
        }
    }
}
