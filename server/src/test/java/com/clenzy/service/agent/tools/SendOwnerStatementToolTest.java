package com.clenzy.service.agent.tools;

import com.clenzy.service.AccountingQueryService;
import com.clenzy.service.OwnerStatementService;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.ToolExecutionException;
import com.clenzy.service.agent.ToolResult;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tool send_owner_statement (T-09) : validations d'entree (params, dates,
 * periode), envoi via le service (org du contexte, jamais des args) et
 * masquage PII de l'email dans le retour LLM.
 */
@ExtendWith(MockitoExtension.class)
class SendOwnerStatementToolTest {

    @Mock private OwnerStatementService ownerStatementService;
    @Mock private AccountingQueryService accountingQueryService;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final AgentContext ctx = AgentContext.minimal(42L, "kc-user-1");

    private SendOwnerStatementTool tool() {
        return new SendOwnerStatementTool(ownerStatementService, accountingQueryService, objectMapper);
    }

    @Test
    void descriptor_isWriteWithConfirmation() {
        assertThat(tool().descriptor().requiresConfirmation()).isTrue();
    }

    @Test
    void missingParams_throwsWithoutSending() {
        assertThatThrownBy(() -> tool().execute(objectMapper.createObjectNode(), ctx))
                .isInstanceOf(ToolExecutionException.class);
        verify(ownerStatementService, never()).sendStatement(anyLong(), anyLong(), any(), any(), anyString());
    }

    @Test
    void invalidDateOrder_throws() {
        var args = objectMapper.createObjectNode()
                .put("ownerId", 7L).put("from", "2026-06-30").put("to", "2026-06-01");

        assertThatThrownBy(() -> tool().execute(args, ctx))
                .isInstanceOf(ToolExecutionException.class)
                .hasMessageContaining("avant");
    }

    @Test
    void success_sendsWithContextOrg_andMasksEmail() throws Exception {
        when(accountingQueryService.getOrganizationName(42L)).thenReturn(Optional.of("Conciergerie Sud"));
        when(ownerStatementService.sendStatement(eq(7L), eq(42L),
                eq(LocalDate.parse("2026-06-01")), eq(LocalDate.parse("2026-06-30")),
                eq("Conciergerie Sud")))
                .thenReturn(new OwnerStatementService.OwnerStatementResult(
                        "martin.dupont@example.com", "Martin Dupont", 2,
                        new BigDecimal("2340.00"), new BigDecimal("3000.00"),
                        new BigDecimal("540.00"), new BigDecimal("120.00")));
        var args = objectMapper.createObjectNode()
                .put("ownerId", 7L).put("from", "2026-06-01").put("to", "2026-06-30");

        ToolResult result = tool().execute(args, ctx);

        assertThat(result.isError()).isFalse();
        // L'email complet ne part JAMAIS au LLM (PII masquee).
        assertThat(result.content()).doesNotContain("martin.dupont@example.com");
        assertThat(result.content()).contains("payoutsCount");
        assertThat(result.content()).contains("2340.0");
    }
}
