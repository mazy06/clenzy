package com.clenzy.service.agent;

import com.clenzy.model.AuditAction;
import com.clenzy.model.AuditSource;
import com.clenzy.service.AuditLogService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

/**
 * Tests de l'audit-logging des actions de l'assistant.
 * Verifie : WRITE audite / READ ignore, qui-quoi-quand-resultat, masquage PII/secrets,
 * troncature, isolation des erreurs (l'audit ne fait jamais echouer l'execution).
 */
@ExtendWith(MockitoExtension.class)
class AgentActionAuditServiceTest {

    @Mock
    private AuditLogService auditLogService;

    private AgentActionAuditService service;

    private final AgentContext ctx = AgentContext.minimal(42L, "kc-user-1");

    @BeforeEach
    void setUp() {
        service = new AgentActionAuditService(auditLogService, new ObjectMapper());
    }

    @Nested
    @DisplayName("Write vs read scoping")
    class WriteVsRead {

        @Test
        void writeTool_isAudited_withWhoWhatResult() {
            service.recordToolExecution("create_reservation",
                    "{\"propertyId\":7,\"guestName\":\"Jean Dupont\"}", true, true, ctx);

            verify(auditLogService).logAction(
                    eq(AuditAction.ASSISTANT_TOOL),
                    eq("create_reservation"),     // quoi = nom de l'outil
                    eq("kc-user-1"),               // qui = keycloakId
                    eq(null),                      // oldValue non pertinent
                    anyString(),                   // newValue = resume args
                    anyString(),                   // details = resultat + résumé
                    eq(AuditSource.ASSISTANT),
                    eq(42L)                        // orgId explicite
            );
        }

        @Test
        void readTool_isNotAudited() {
            service.recordToolExecution("list_reservations", "{\"status\":\"CONFIRMED\"}",
                    false, true, ctx);

            verifyNoInteractions(auditLogService);
        }

        @Test
        void writeTool_failure_recordsErrorOutcome() {
            service.recordToolExecution("cancel_reservation", "{\"id\":3}", true, false, ctx);

            ArgumentCaptor<String> details = ArgumentCaptor.forClass(String.class);
            verify(auditLogService).logAction(eq(AuditAction.ASSISTANT_TOOL), anyString(),
                    anyString(), any(), any(), details.capture(), eq(AuditSource.ASSISTANT), eq(42L));
            assertThat(details.getValue()).startsWith("ERROR");
            assertThat(details.getValue()).contains("cancel_reservation");
        }

        @Test
        void writeTool_success_recordsSuccessOutcome() {
            service.recordToolExecution("set_rate_override", "{\"price\":120}", true, true, ctx);

            ArgumentCaptor<String> details = ArgumentCaptor.forClass(String.class);
            verify(auditLogService).logAction(eq(AuditAction.ASSISTANT_TOOL), anyString(),
                    anyString(), any(), any(), details.capture(), eq(AuditSource.ASSISTANT), eq(42L));
            assertThat(details.getValue()).startsWith("SUCCESS");
        }
    }

    @Nested
    @DisplayName("Args summarization — PII & secrets")
    class ArgsSummarization {

        @Test
        void emailValue_isMasked() {
            String summary = service.summarizeArgs("{\"email\":\"toufik@clenzy.fr\"}");
            assertThat(summary).contains("email=t***@clenzy.fr");
            assertThat(summary).doesNotContain("toufik@clenzy.fr");
        }

        @Test
        void secretKeys_areRedacted() {
            String summary = service.summarizeArgs(
                    "{\"password\":\"hunter2\",\"api_key\":\"sk-12345\",\"token\":\"abc\"}");
            assertThat(summary).doesNotContain("hunter2");
            assertThat(summary).doesNotContain("sk-12345");
            assertThat(summary).contains("password=***");
            assertThat(summary).contains("api_key=***");
            assertThat(summary).contains("token=***");
        }

        @Test
        void nestedObjectsAndArrays_areCollapsed() {
            String summary = service.summarizeArgs(
                    "{\"filters\":{\"a\":1},\"ids\":[1,2,3]}");
            assertThat(summary).contains("filters={...}");
            assertThat(summary).contains("ids=[3 items]");
        }

        @Test
        void longValue_isTruncated() {
            String longVal = "x".repeat(200);
            String summary = service.summarizeArgs("{\"note\":\"" + longVal + "\"}");
            // Valeur tronquee a MAX_VALUE_LEN (+ ellipse), bien en deca de 200.
            assertThat(summary.length()).isLessThan(200);
            assertThat(summary).contains("…");
        }

        @Test
        void blankArgs_yieldEmptySummary() {
            assertThat(service.summarizeArgs(null)).isEmpty();
            assertThat(service.summarizeArgs("")).isEmpty();
        }

        @Test
        void invalidJson_yieldsSafePlaceholder() {
            assertThat(service.summarizeArgs("{not json")).isEqualTo("<args non lisibles>");
        }
    }

    @Nested
    @DisplayName("Failure isolation")
    class FailureIsolation {

        @Test
        void auditServiceThrows_doesNotPropagate() {
            org.mockito.Mockito.doThrow(new RuntimeException("DB down"))
                    .when(auditLogService).logAction(any(), any(), any(), any(), any(), any(), any(), any());

            // Must NOT throw — l'audit ne casse jamais l'execution de l'outil.
            service.recordToolExecution("create_invoice", "{\"amount\":50}", true, true, ctx);
        }

        @Test
        void nullContext_doesNotThrow_passesNullWhoOrg() {
            service.recordToolExecution("block_calendar_day", "{\"date\":\"2026-07-01\"}",
                    true, true, null);

            verify(auditLogService).logAction(eq(AuditAction.ASSISTANT_TOOL), anyString(),
                    eq(null), any(), any(), anyString(), eq(AuditSource.ASSISTANT), eq(null));
        }
    }
}
