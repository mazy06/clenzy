package com.clenzy.service.agent;

import com.clenzy.config.ai.ChatLLMProvider;
import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.repository.AssistantMessageRepository;
import com.clenzy.service.AiTokenBudgetService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Verifie que le choke point d'execution des outils confirmes
 * ({@link AgentToolLoopRunner#executeConfirmed}) — chemin des WRITE tools apres
 * confirmation user — declenche bien l'audit + la metrique d'observabilite.
 */
class AgentToolLoopRunnerInstrumentationTest {

    private ToolRegistry toolRegistry;
    private AgentActionAuditService auditService;
    private SimpleMeterRegistry meterRegistry;
    private AgentToolMetrics toolMetrics;
    private AgentToolLoopRunner runner;

    private final AgentContext ctx = AgentContext.minimal(42L, "kc-user-1");
    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        toolRegistry = mock(ToolRegistry.class);
        auditService = mock(AgentActionAuditService.class);
        meterRegistry = new SimpleMeterRegistry();
        toolMetrics = new AgentToolMetrics(meterRegistry);
        runner = new AgentToolLoopRunner(
                mock(ChatLLMProvider.class),
                toolRegistry,
                mock(AssistantMessageRepository.class),
                mock(PendingToolStore.class),
                objectMapper,
                mock(AiTokenBudgetService.class),
                auditService,
                toolMetrics);
    }

    private ToolHandler writeHandler(String name, ToolResult result) {
        ToolHandler handler = mock(ToolHandler.class);
        when(handler.name()).thenReturn(name);
        ToolDescriptor descriptor = ToolDescriptor.write(name, "desc", mock(JsonNode.class));
        when(handler.descriptor()).thenReturn(descriptor);
        when(handler.execute(any(), any())).thenReturn(result);
        return handler;
    }

    private PendingToolStore.PendingTool pending(String toolName, String argsJson) {
        return new PendingToolStore.PendingTool(
                "toolu_1", 1L, 42L, "kc-user-1", toolName, argsJson,
                List.of(), null, Instant.now().plusSeconds(60));
    }

    @Test
    void confirmedWriteTool_success_auditsAndCountsSuccess() {
        ToolHandler handler = writeHandler("create_reservation", ToolResult.success("{\"id\":9}"));
        when(toolRegistry.find("create_reservation")).thenReturn(Optional.of(handler));

        ToolResult result = runner.executeConfirmed(
                pending("create_reservation", "{\"propertyId\":7}"), ctx);

        assertThat(result.isError()).isFalse();
        // Audit du write tool (qui/quoi/resultat).
        verify(auditService).recordToolExecution(
                eq("create_reservation"), eq("{\"propertyId\":7}"), eq(true), eq(true), eq(ctx));
        // Metrique success.
        assertThat(meterRegistry.find(AgentToolMetrics.TOOL_EXECUTIONS)
                .tag("tool", "create_reservation").tag("outcome", "success").counter().count())
                .isEqualTo(1d);
    }

    @Test
    void confirmedWriteTool_errorResult_auditsAndCountsError() {
        ToolHandler handler = writeHandler("cancel_reservation", ToolResult.error("introuvable"));
        when(toolRegistry.find("cancel_reservation")).thenReturn(Optional.of(handler));

        ToolResult result = runner.executeConfirmed(
                pending("cancel_reservation", "{\"id\":3}"), ctx);

        assertThat(result.isError()).isTrue();
        verify(auditService).recordToolExecution(
                eq("cancel_reservation"), eq("{\"id\":3}"), eq(true), eq(false), eq(ctx));
        assertThat(meterRegistry.find(AgentToolMetrics.TOOL_EXECUTIONS)
                .tag("tool", "cancel_reservation").tag("outcome", "error").counter().count())
                .isEqualTo(1d);
    }

    @Test
    void confirmedTool_unknown_countsErrorNoAudit() {
        when(toolRegistry.find("ghost_tool")).thenReturn(Optional.empty());

        ToolResult result = runner.executeConfirmed(pending("ghost_tool", "{}"), ctx);

        assertThat(result.isError()).isTrue();
        assertThat(meterRegistry.find(AgentToolMetrics.TOOL_EXECUTIONS)
                .tag("tool", "ghost_tool").tag("outcome", "error").counter().count())
                .isEqualTo(1d);
    }
}
