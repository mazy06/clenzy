package com.clenzy.controller;

import com.clenzy.service.agent.*;
import com.clenzy.tenant.TenantContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.*;
import java.util.function.Consumer;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;

/** In-memory HTTP/SSE wiring; authorization is independently covered by method security tests. */
class BaitlyChatCompletionHttpTest {
    private final AgentOrchestrator orchestrator=mock(AgentOrchestrator.class);
    private final BaitlyChatTurnExecutor executor=mock(BaitlyChatTurnExecutor.class);
    private final TenantContext tenant=mock(TenantContext.class);
    private final ObjectMapper mapper=new ObjectMapper();
    private MockMvc mvc;
    private final UUID request=UUID.randomUUID();
    @BeforeEach void setup() {
        when(tenant.getRequiredOrganizationId()).thenReturn(7L);
        var controller=new AgUiController(orchestrator,tenant,mapper,mock(PendingToolStore.class),
                mock(com.clenzy.service.agent.supervision.SupervisionActivityService.class),mock(AgentRunQueryService.class),executor);
        mvc=MockMvcBuilders.standaloneSetup(controller)
                .setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver()).build();
        var jwt=Jwt.withTokenValue("synthetic-not-a-secret").header("alg","none").subject("recipe-user").build();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt));
    }
    @AfterEach void cleanup() { SecurityContextHolder.clearContext(); }
    private Map<String,Object> input() {
        var body=new LinkedHashMap<String,Object>(); body.put("threadId","synthetic-thread"); body.put("runId",request.toString());
        body.put("messages",List.of(Map.of("role","user","content","Synthetic question")));
        body.put("forwardedProps",Map.of("conversationId",9,"completionPolicy",BaitlyChatCompletionJournal.POLICY)); return body;
    }
    private String performRun(Map<String,Object> body) throws Exception {
        var result=mvc.perform(post("/api/agui/run").contentType("application/json").content(mapper.writeValueAsString(body))).andReturn();
        result.getAsyncResult(5000);
        return mvc.perform(asyncDispatch(result)).andReturn().getResponse().getContentAsString();
    }
    @Test void candidateDispatchesThroughDurableBoundaryWithAuthenticatedScopeAndRequestIdentity() throws Exception {
        when(executor.execute(eq(request),eq(7L),eq("recipe-user"),eq(9L),isNull(),any(),any())).thenAnswer(call->{
            Consumer<AgentSseEvent> downstream=call.getArgument(6);
            downstream.accept(AgentSseEvent.done("stop")); return 9L;
        });
        assertThat(performRun(input())).contains("RUN_FINISHED");
        verify(executor).execute(eq(request),eq(7L),eq("recipe-user"),eq(9L),isNull(),any(),any());
        verifyNoInteractions(orchestrator);
    }
    @Test void unknownPolicyAndInvalidRequestIdentityNeverFallBackToLegacyExecution() throws Exception {
        var wrong=input(); wrong.put("forwardedProps",Map.of("conversationId",9,"completionPolicy","unsupported"));
        assertThat(performRun(wrong)).contains("RUN_ERROR");
        var invalid=input(); invalid.put("runId","private-invalid-canary");
        assertThat(performRun(invalid)).contains("RUN_ERROR").doesNotContain("private-invalid-canary");
        verifyNoInteractions(executor,orchestrator);
    }
    @Test void malformedResumeCannotBecomeNewMessageOrImplicitApproval() throws Exception {
        for(var resume:List.of(Map.of("interruptId","pending","status","resolved"),
                Map.of("interruptId","pending","status","resolved","payload",Map.of("confirmed",false)))) {
            var body=input(); body.put("resume",List.of(resume));
            assertThat(performRun(body)).contains("RUN_ERROR");
        }
        for(Object resume:List.of(Map.of("interruptId","pending"),List.of())) {
            var body=input(); body.put("resume",resume);
            assertThat(performRun(body)).contains("RUN_ERROR");
        }
        var legacyShape=input(); legacyShape.put("forwardedProps",Map.of("conversationId",9,
                "completionPolicy",BaitlyChatCompletionJournal.POLICY,"resume",Map.of("interruptId","pending")));
        assertThat(performRun(legacyShape)).contains("RUN_ERROR");
        verifyNoInteractions(executor,orchestrator);
    }
    @Test void durableFailureDoesNotExposeRemoteDiagnosticsOrExecuteLegacyPath() throws Exception {
        when(executor.execute(any(),any(),any(),any(),any(),any(),any())).thenThrow(new IllegalStateException("private-provider-canary"));
        assertThat(performRun(input())).contains("RUN_ERROR").doesNotContain("private-provider-canary");
        verifyNoInteractions(orchestrator);
    }
    @Test void legacyClientKeepsExistingPathWithoutDurableClaim() throws Exception {
        when(orchestrator.handleMessage(eq(9L),anyString(),anyList(),any(),any())).thenAnswer(call->{
            Consumer<AgentSseEvent> output=call.getArgument(4); output.accept(AgentSseEvent.done("stop")); return 9L;
        });
        var body=input(); body.put("forwardedProps",Map.of("conversationId",9));
        assertThat(performRun(body)).contains("RUN_FINISHED");
        verify(executor).requireLegacyUntracked(7L,"recipe-user",9L,null);
        verify(executor,never()).execute(any(),any(),any(),any(),any(),any(),any());
    }
    @Test void removingPolicyCannotBypassExistingDurableFence() throws Exception {
        doThrow(new IllegalStateException("Baitly chat completion unavailable")).when(executor)
                .requireLegacyUntracked(7L,"recipe-user",9L,null);
        var body=input(); body.put("forwardedProps",Map.of("conversationId",9));
        assertThat(performRun(body)).contains("RUN_ERROR");
        verifyNoInteractions(orchestrator);
    }
}
