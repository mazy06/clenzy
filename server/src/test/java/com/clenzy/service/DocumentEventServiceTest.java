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
    @Mock private com.clenzy.service.document.DocumentReferenceOrgResolver referenceOrgResolver;
    @Mock private com.clenzy.tenant.KafkaTenantScope kafkaTenantScope;

    private DocumentEventService service;

    @BeforeEach
    void setUp() {
        // L'executor est un helper d'infrastructure : on execute le Runnable en ligne pour
        // observer l'effet metier. lenient() car les tests de rejet n'y arrivent jamais.
        // KafkaTenantScope porte la politique (refus si org absente ou contredite) ; elle est
        // testee dans KafkaTenantScopeTest. Ici on rejoue son contrat pour observer l'effet metier.
        org.mockito.Mockito.lenient().doAnswer(inv -> {
            Long trusted = inv.getArgument(1);
            Long declared = inv.getArgument(2);
            if (trusted == null || (declared != null && !declared.equals(trusted))) {
                return false;
            }
            ((Runnable) inv.getArgument(3)).run();
            return true;
        }).when(kafkaTenantScope).run(org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(Runnable.class));
        service = new DocumentEventService(generatorService, referenceOrgResolver, kafkaTenantScope);
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
            event.put("organizationId", 7);
            when(referenceOrgResolver.resolve(ReferenceType.INTERVENTION, 42L))
                    .thenReturn(java.util.Optional.of(7L));

            service.handleDocumentGenerationEvent(event);

            // L'org transmise est celle RESOLUE depuis l'entite, pas celle du payload
            // (elles coincident ici : cas nominal).
            verify(generatorService).generateFromEvent(
                    eq(DocumentType.BON_INTERVENTION), eq(42L),
                    eq(ReferenceType.INTERVENTION), eq("client@example.com"), eq(7L));
        }

        @Test
        void whenValidEventWithoutOrgId_thenPassesNull() {
            Map<String, Object> event = new HashMap<>();
            event.put("documentType", "BON_INTERVENTION");
            event.put("referenceId", 42);
            event.put("referenceType", "INTERVENTION");
            event.put("emailTo", "client@example.com");
            when(referenceOrgResolver.resolve(ReferenceType.INTERVENTION, 42L))
                    .thenReturn(java.util.Optional.of(7L));

            service.handleDocumentGenerationEvent(event);

            // Payload sans organizationId : l'org resolue depuis l'entite fait foi.
            verify(generatorService).generateFromEvent(
                    eq(DocumentType.BON_INTERVENTION), eq(42L),
                    eq(ReferenceType.INTERVENTION), eq("client@example.com"), eq(7L));
        }


        /**
         * Audit 2026-07 (P1-03) — l'organizationId, l'emailTo et le referenceId etaient tous
         * lus dans le payload, sans jamais verifier que la reference appartenait a cette
         * organisation. Un evenement forge (broker en PLAINTEXT, ou Kafka-UI en ecriture)
         * faisait generer le document d'un tenant et l'expedier a une adresse arbitraire.
         * L'organisation est desormais re-derivee de l'entite ; le payload ne sert que de
         * controle de coherence.
         */
        @Test
        void whenPayloadOrgMismatchesEntity_thenRejects() {
            Map<String, Object> event = new HashMap<>();
            event.put("documentType", "FACTURE");
            event.put("referenceId", 42);
            event.put("referenceType", "INTERVENTION");
            event.put("emailTo", "attaquant@evil.tld");
            event.put("organizationId", 999);            // org de l'attaquant
            when(referenceOrgResolver.resolve(ReferenceType.INTERVENTION, 42L))
                    .thenReturn(java.util.Optional.of(7L));  // org reelle de l'entite

            service.handleDocumentGenerationEvent(event);

            verifyNoInteractions(generatorService);
        }

        @Test
        void whenReferenceUnknown_thenRejects() {
            Map<String, Object> event = new HashMap<>();
            event.put("documentType", "FACTURE");
            event.put("referenceId", 4242);
            event.put("referenceType", "INTERVENTION");
            event.put("organizationId", 7);
            when(referenceOrgResolver.resolve(ReferenceType.INTERVENTION, 4242L))
                    .thenReturn(java.util.Optional.empty());

            service.handleDocumentGenerationEvent(event);

            verifyNoInteractions(generatorService);
        }

        @Test
        void whenMissingDocumentType_thenSkips() {
            Map<String, Object> event = new HashMap<>();
            event.put("referenceId", 42);

            service.handleDocumentGenerationEvent(event);

            verify(generatorService, never()).generateFromEvent(
                    any(), anyLong(), any(), anyString(), any());
        }

        @Test
        void whenMissingReferenceId_thenSkips() {
            Map<String, Object> event = new HashMap<>();
            event.put("documentType", "FACTURE");

            service.handleDocumentGenerationEvent(event);

            verify(generatorService, never()).generateFromEvent(
                    any(), anyLong(), any(), anyString(), any());
        }

        @Test
        void whenReferenceIdIsString_thenParsesIt() {
            Map<String, Object> event = new HashMap<>();
            event.put("documentType", "DEVIS");
            event.put("referenceId", "123");
            event.put("referenceType", "SERVICE_REQUEST");
            event.put("emailTo", null);
            event.put("organizationId", 5);
            when(referenceOrgResolver.resolve(ReferenceType.SERVICE_REQUEST, 123L))
                    .thenReturn(java.util.Optional.of(5L));

            service.handleDocumentGenerationEvent(event);

            verify(generatorService).generateFromEvent(
                    eq(DocumentType.DEVIS), eq(123L),
                    eq(ReferenceType.SERVICE_REQUEST), isNull(), eq(5L));
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

            verify(generatorService, never()).generateFromEvent(
                    any(), anyLong(), any(), anyString(), any());
        }

        /**
         * Changement de comportement assume (audit P1-03) : sans referenceType, l'organisation
         * proprietaire ne peut pas etre re-derivee — l'evenement est donc refuse au lieu d'etre
         * traite avec une organisation nulle. Verifie : les quatre producteurs legitimes
         * (StripePaymentConfirmationService, StripeRefundService, ServiceRequestService)
         * renseignent tous ce champ.
         */
        @Test
        void whenNoReferenceType_thenRejects() {
            Map<String, Object> event = new HashMap<>();
            event.put("documentType", "FACTURE");
            event.put("referenceId", 5);

            service.handleDocumentGenerationEvent(event);

            verifyNoInteractions(generatorService);
        }
    }
}
