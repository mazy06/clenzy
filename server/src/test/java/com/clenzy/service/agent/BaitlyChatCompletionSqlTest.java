package com.clenzy.service.agent;

import com.clenzy.model.AssistantMessage;
import com.clenzy.model.BaitlyChatTurn;
import liquibase.Liquibase;
import liquibase.changelog.DatabaseChangeLog;
import liquibase.database.DatabaseFactory;
import liquibase.database.jvm.JdbcConnection;
import liquibase.resource.ClassLoaderResourceAccessor;
import org.hibernate.cfg.Configuration;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import com.clenzy.config.ai.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Real production journal/executor and selected Liquibase changeset, isolated SQL only. */
class BaitlyChatCompletionSqlTest {
    private DriverManagerDataSource source;
    private JdbcTemplate jdbc;
    private JdbcTemplate admin;
    private String schema;
    private BaitlyChatCompletionJournal journal;
    private BaitlyChatTurnExecutor executor;
    private long nextMessage;
    private boolean postgres;

    @BeforeEach void setup() throws Exception {
        String url=System.getProperty("baitly.test.jdbc");
        postgres=url!=null;
        if(url==null) source=new DriverManagerDataSource("jdbc:h2:mem:completion"+UUID.randomUUID()+";MODE=PostgreSQL;DB_CLOSE_DELAY=-1","sa","");
        else {
            if(!url.matches("jdbc:postgresql://(?:127\\.0\\.0\\.1|localhost):[0-9]+/[a-zA-Z0-9_]*(?:test|recipe|ci)[a-zA-Z0-9_]*"))
                throw new IllegalArgumentException("Isolated recipe database required");
            admin=new JdbcTemplate(new DriverManagerDataSource(url,"postgres",""));
            schema="baitly_chat_end_"+UUID.randomUUID().toString().replace("-","");
            admin.execute("CREATE SCHEMA "+schema);
            source=new DriverManagerDataSource(url+"?currentSchema="+schema,"postgres","");
        }
        jdbc=new JdbcTemplate(source);
        jdbc.execute("CREATE TABLE assistant_conversation(id BIGINT PRIMARY KEY,organization_id BIGINT,keycloak_id VARCHAR(255),archived_at TIMESTAMP)");
        String json=postgres?"JSONB":"TEXT";
        jdbc.execute("CREATE TABLE assistant_message(id BIGINT PRIMARY KEY,organization_id BIGINT,conversation_id BIGINT,role VARCHAR(20),content TEXT,tool_calls "+json+",attachments "+json+",finish_reason VARCHAR(40),tool_call_id VARCHAR(120))");
        jdbc.execute("CREATE TABLE agent_run(id UUID PRIMARY KEY,organization_id BIGINT,conversation_id BIGINT)");
        jdbc.execute("CREATE TABLE agent_pending_action(organization_id BIGINT,keycloak_user_id VARCHAR(255),conversation_id BIGINT,tool_call_id VARCHAR(96),status VARCHAR(16),expires_at TIMESTAMP WITH TIME ZONE)");
        jdbc.update("INSERT INTO assistant_conversation(id,organization_id,keycloak_id) VALUES (9,7,'recipe-user')");
        migrate();
        journal=new BaitlyChatCompletionJournal(jdbc,new DataSourceTransactionManager(source));
        executor=new BaitlyChatTurnExecutor(journal);
    }
    @AfterEach void cleanup() { if(schema!=null) admin.execute("DROP SCHEMA "+schema+" CASCADE"); }
    private void migrate() throws Exception {
        try(var connection=source.getConnection()) {
            var database=DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new JdbcConnection(connection));
            var resources=new ClassLoaderResourceAccessor();
            try(var master=new Liquibase("db/changelog/db.changelog-master.yaml",resources,database)) {
                var selected=new DatabaseChangeLog("db/changelog/db.changelog-master.yaml");
                master.getDatabaseChangeLog().getChangeSets().stream().filter(c->Set.of("0607-baitly-chat-turn-receipts",
                    "0608-baitly-chat-tool-evidence","0609-baitly-chat-tool-turn-proofs","0610-baitly-chat-write-business-proofs").contains(c.getId())).forEach(selected::addChangeSet);
                assertThat(selected.getChangeSets()).hasSize(4);
                new Liquibase(selected,resources,database).update("");
            }
        }
    }
    private long message(String role,String text,String reason) {
        long id=++nextMessage;
        jdbc.update("INSERT INTO assistant_message(id,organization_id,conversation_id,role,content,finish_reason) VALUES (?,7,9,?,?,?)",id,role,text,reason);
        return id;
    }
    private List<AssistantMessage> history() {
        return jdbc.query("SELECT * FROM assistant_message ORDER BY id",(rs,n)->{
            var row=new AssistantMessage(); row.setId(rs.getLong("id")); row.setOrganizationId(rs.getLong("organization_id"));
            row.setConversationId(rs.getLong("conversation_id")); row.setRole(rs.getString("role")); row.setContent(rs.getString("content"));
            row.setToolCalls(rs.getString("tool_calls")); row.setAttachments(rs.getString("attachments")); return row;
        });
    }
    private String state() { return jdbc.queryForObject("SELECT status FROM baitly_chat_turns ORDER BY turn_sequence DESC LIMIT 1",String.class); }
    private void textTurn(UUID request) {
        executor.execute(request,7L,"recipe-user",9L,null,output->{
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            assertThat(state()).isEqualTo("RUNNING");
            message("user","Question synthétique",null);
            long last=message("assistant","Réponse synthétique العربية","end_turn");
            BaitlyChatTurnObservation.textPersisted(last,"end_turn");
            output.accept(AgentSseEvent.textDelta("Réponse synthétique العربية"));
            output.accept(AgentSseEvent.done("end_turn"));
            assertThat(state()).isEqualTo("RUNNING"); // Terminal is held until commit.
            return 9L;
        },event->{ if("done".equals(event.type())) assertThat(state()).isEqualTo("SAFE_TEXT"); });
    }

    @Test void migrationIsReplayableAndJpaMappingMatchesActualSchema() throws Exception {
        migrate();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM databasechangelog WHERE id='0607-baitly-chat-turn-receipts'",Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM databasechangelog WHERE id='0608-baitly-chat-tool-evidence'",Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM databasechangelog WHERE id='0609-baitly-chat-tool-turn-proofs'",Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM databasechangelog WHERE id='0610-baitly-chat-write-business-proofs'",Integer.class)).isEqualTo(1);
        var config=new Configuration().addAnnotatedClass(BaitlyChatTurn.class).addAnnotatedClass(com.clenzy.model.BaitlyChatToolEvidence.class)
            .addAnnotatedClass(com.clenzy.model.BaitlyChatToolTurnProof.class).addAnnotatedClass(com.clenzy.model.BaitlyChatWriteBusinessProof.class);
        config.getProperties().put("hibernate.connection.datasource",source);
        config.setProperty("hibernate.hbm2ddl.auto","validate");
        try(var factory=config.buildSessionFactory()) { assertThat(factory.isOpen()).isTrue(); }
    }
    @Test void twoPureTextTurnsCommitReceiptsBeforeTerminalAndSurviveReboot() {
        UUID lastRequest=UUID.randomUUID(); textTurn(UUID.randomUUID()); textTurn(lastRequest);
        var reboot=new BaitlyChatCompletionJournal(jdbc,new DataSourceTransactionManager(source));
        var proof=reboot.proof(7L,"recipe-user",9L,history());
        assertThat(proof.status()).isEqualTo("SAFE_TEXT"); assertThat(proof.lastMessageId()).isEqualTo("history-4");
        assertThat(proof.requestId()).isEqualTo(lastRequest.toString());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM baitly_chat_turns WHERE status='SAFE_TEXT'",Integer.class)).isEqualTo(2);
    }
    @Test void oldRequestIdentityCannotReplayEvenAfterAnotherCompletedTurn() {
        UUID original=UUID.randomUUID(); textTurn(original); textTurn(UUID.randomUUID());
        AtomicInteger calls=new AtomicInteger();
        assertThatThrownBy(()->executor.execute(original,7L,"recipe-user",9L,null,out->{calls.incrementAndGet();return 9L;},e->{}))
                .hasMessage("Baitly chat completion unavailable");
        assertThat(calls.get()).isZero(); assertThat(state()).isEqualTo("SAFE_TEXT");
    }
    @Test void concurrentAdmissionsHaveOnlyOneWinnerAndNoProviderInTransaction() throws Exception {
        var pool=Executors.newFixedThreadPool(2); var latch=new CountDownLatch(1);
        try {
            Callable<Boolean> attempt=()->{ latch.await(); try { journal.begin(7L,"recipe-user",9L,UUID.randomUUID(),null); return true; }
                catch(IllegalStateException rejected) { return false; } };
            var a=pool.submit(attempt); var b=pool.submit(attempt); latch.countDown();
            assertThat(List.of(a.get(10,TimeUnit.SECONDS),b.get(10,TimeUnit.SECONDS))).containsExactlyInAnyOrder(true,false);
            assertThat(state()).isEqualTo("RUNNING");
        } finally { pool.shutdownNow(); }
    }
    @Test void crashAfterAdmissionIsNeverExpiredIntoPermissionToReplay() {
        journal.requireLegacyUntracked(7L,"recipe-user",9L,null);
        journal.begin(7L,"recipe-user",9L,UUID.randomUUID(),null);
        var reboot=new BaitlyChatCompletionJournal(jdbc,new DataSourceTransactionManager(source));
        assertThat(reboot.proof(7L,"recipe-user",9L,List.of()).status()).isEqualTo("RUNNING");
        assertThatThrownBy(()->reboot.begin(7L,"recipe-user",9L,UUID.randomUUID(),null)).hasMessage("Baitly chat completion unavailable");
        assertThatThrownBy(()->reboot.requireLegacyUntracked(7L,"recipe-user",9L,null)).hasMessage("Baitly chat completion unavailable");
    }
    @Test void admissionOutageDoesNotRunWorkOrExposeDiagnostics() {
        var failing=mock(BaitlyChatCompletionJournal.class);
        when(failing.begin(any(),any(),any(),any(),any())).thenThrow(new IllegalStateException("private-storage-canary"));
        AtomicInteger calls=new AtomicInteger();
        assertThatThrownBy(()->new BaitlyChatTurnExecutor(failing).execute(UUID.randomUUID(),7L,"recipe-user",9L,null,
                out->{calls.incrementAndGet();return 9L;},e->{})).hasMessage("Baitly chat completion unavailable").hasNoCause();
        assertThat(calls.get()).isZero();
    }
    @Test void unavailableReceiptStorageDoesNotExposeSqlDiagnosticsThroughReadsOrLegacyGuard() {
        jdbc.execute("DROP TABLE baitly_chat_turns");
        assertThatThrownBy(()->journal.proof(7L,"recipe-user",9L,List.of()))
                .hasMessage("Baitly chat completion unavailable").hasNoCause();
        assertThatThrownBy(()->journal.requireLegacyUntracked(7L,"recipe-user",9L,null))
                .hasMessage("Baitly chat completion unavailable").hasNoCause();
    }
    @Test void outerTransactionIsRejectedBeforeAdmissionOrProviderWork() {
        var outer=new org.springframework.transaction.support.TransactionTemplate(new DataSourceTransactionManager(source));
        AtomicInteger calls=new AtomicInteger();
        outer.executeWithoutResult(tx -> assertThatThrownBy(()->executor.execute(UUID.randomUUID(),7L,"recipe-user",9L,null,
                out->{calls.incrementAndGet();return 9L;},e->{})).hasMessage("Baitly chat completion unavailable"));
        assertThat(calls.get()).isZero();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM baitly_chat_turns",Integer.class)).isZero();
        assertThat(BaitlyChatTurnObservation.active()).isFalse();
    }
    @Test void failedFinishNeverEmitsTerminalAndKeepsPersistentFence() {
        var failing=spy(journal);
        doThrow(new IllegalStateException("private-finish-canary")).when(failing).finish(any(),any());
        doThrow(new IllegalStateException("private-outage-canary")).when(failing).uncertain(any());
        var events=new ArrayList<AgentSseEvent>();
        assertThatThrownBy(()->new BaitlyChatTurnExecutor(failing).execute(UUID.randomUUID(),7L,"recipe-user",9L,null,out->{
            message("user","Synthetic question",null); long id=message("assistant","Synthetic response","stop");
            BaitlyChatTurnObservation.textPersisted(id,"stop"); out.accept(AgentSseEvent.done("stop")); return 9L;
        },events::add)).hasMessage("Baitly chat completion unavailable").hasNoCause();
        assertThat(events).isEmpty(); assertThat(state()).isEqualTo("RUNNING");
        assertThatThrownBy(()->journal.begin(7L,"recipe-user",9L,UUID.randomUUID(),null)).isInstanceOf(IllegalStateException.class);
    }
    @Test void toolAttemptsAndErrorsStayUncertainDespiteSseFinishAndPersistedResult() {
        AtomicInteger effects=new AtomicInteger();
        executor.execute(UUID.randomUUID(),7L,"recipe-user",9L,null,out->{
            message("user","Synthetic question",null); BaitlyChatTurnObservation.toolsRequested();
            effects.incrementAndGet(); long result=message("tool","Synthetic result",null);
            jdbc.update("UPDATE assistant_message SET tool_call_id='synthetic-tool' WHERE id=?",result);
            out.accept(AgentSseEvent.toolCallExecuted("synthetic_tool","synthetic-tool",true,null,null));
            long last=message("assistant","Synthetic response","end_turn"); BaitlyChatTurnObservation.textPersisted(last,"end_turn");
            out.accept(AgentSseEvent.done("end_turn")); return 9L;
        },e->{});
        assertThat(state()).isEqualTo("UNCERTAIN");
        assertThat(journal.proof(7L,"recipe-user",9L,history()).status()).isEqualTo("UNCERTAIN");
        assertThatThrownBy(()->executor.execute(UUID.randomUUID(),7L,"recipe-user",9L,null,out->{effects.incrementAndGet();return 9L;},e->{})).isInstanceOf(IllegalStateException.class);
        assertThat(effects.get()).isEqualTo(1);
    }
    @Test void sseDoneWithoutPersistedCompletionHookIsNotSafe() {
        executor.execute(UUID.randomUUID(),7L,"recipe-user",9L,null,out->{
            message("user","Synthetic question",null); message("assistant","Synthetic response","end_turn");
            out.accept(AgentSseEvent.done("end_turn")); return 9L;
        },e->{});
        assertThat(state()).isEqualTo("UNCERTAIN");
    }
    @Test void multiAgentOrInconsistentHistoryCannotBecomeSafeText() {
        executor.execute(UUID.randomUUID(),7L,"recipe-user",9L,null,out->{
            message("user","Synthetic question",null); BaitlyChatTurnObservation.multiAgent();
            long id=message("assistant","Synthetic response","stop"); BaitlyChatTurnObservation.textPersisted(id,"stop");
            out.accept(AgentSseEvent.done("stop")); return 9L;
        },e->{});
        assertThat(state()).isEqualTo("UNCERTAIN");
    }
    @Test void legacyMessagesAfterReceiptInvalidateProofAndNextAdmission() {
        textTurn(UUID.randomUUID()); message("user","Unjournalled synthetic turn",null);
        assertThat(journal.proof(7L,"recipe-user",9L,history()).status()).isEqualTo("UNCERTAIN");
        assertThatThrownBy(()->journal.begin(7L,"recipe-user",9L,UUID.randomUUID(),null)).isInstanceOf(IllegalStateException.class);
    }
    @Test void foreignOwnerOrOrganizationCannotCreateReceiptOrGainProof() {
        assertThatThrownBy(()->journal.begin(8L,"recipe-user",9L,UUID.randomUUID(),null)).isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        assertThatThrownBy(()->journal.begin(7L,"foreign",9L,UUID.randomUUID(),null)).isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        textTurn(UUID.randomUUID());
        assertThat(journal.proof(8L,"recipe-user",9L,history())).isNull();
        assertThat(journal.proof(7L,"foreign",9L,history())).isNull();
    }
    @Test void explicitPauseCanResumeOnceButNeverCertifiesItsExternalEffect() {
        executor.execute(UUID.randomUUID(),7L,"recipe-user",9L,null,out->{
            message("user","Synthetic question",null); message("assistant","Synthetic request","tool_use");
            BaitlyChatTurnObservation.toolsRequested();
            jdbc.update("INSERT INTO agent_pending_action VALUES (7,'recipe-user',9,'pending','PENDING',?)",Timestamp.from(Instant.now().plusSeconds(600)));
            out.accept(AgentSseEvent.pausedAwaitingConfirmation()); return 9L;
        },e->{});
        assertThat(state()).isEqualTo("PAUSED");
        executor.execute(UUID.randomUUID(),7L,"recipe-user",9L,"pending",out->{
            jdbc.update("UPDATE agent_pending_action SET status='CONFIRMED'");
            long id=message("tool","Synthetic result",null); jdbc.update("UPDATE assistant_message SET tool_call_id='pending' WHERE id=?",id);
            out.accept(AgentSseEvent.toolCallExecuted("synthetic_tool","pending",false,null,null));
            out.accept(AgentSseEvent.done("stop")); return 9L;
        },e->{});
        assertThat(state()).isEqualTo("UNCERTAIN");
        assertThatThrownBy(()->journal.begin(7L,"recipe-user",9L,UUID.randomUUID(),"pending")).isInstanceOf(IllegalStateException.class);
    }
    @ParameterizedTest
    @ValueSource(strings={"length","error","extra-message","attachment","missing-user","duplicate-done","mismatched-hook","blank-text"})
    void incompleteOrContradictoryCompletionRemainsUncertain(String variant) {
        executor.execute(UUID.randomUUID(),7L,"recipe-user",9L,null,out->{
            if(!"missing-user".equals(variant)) {
                long user=message("user","Synthetic question",null);
                if("attachment".equals(variant)) jdbc.update("UPDATE assistant_message SET attachments='[{}]' WHERE id=?",user);
            }
            if("extra-message".equals(variant)) message("user","Concurrent synthetic turn",null);
            String reason="length".equals(variant)?"length":"stop";
            long id=message("assistant","blank-text".equals(variant)?" ":"Synthetic response",reason);
            BaitlyChatTurnObservation.textPersisted("mismatched-hook".equals(variant)?id+100:id,reason);
            if("error".equals(variant)) out.accept(AgentSseEvent.error("private-error-canary"));
            out.accept(AgentSseEvent.done(reason));
            if("duplicate-done".equals(variant)) out.accept(AgentSseEvent.done(reason));
            return 9L;
        },event->{if("error".equals(event.type())) assertThat(event.error()).doesNotContain("private-error-canary");});
        assertThat(state()).isEqualTo("UNCERTAIN");
    }
    @Test void legacyHistoryCannotBeBootstrappedIntoSafeReceipt() {
        message("user","Legacy synthetic question",null);
        assertThatThrownBy(()->journal.begin(7L,"recipe-user",9L,UUID.randomUUID(),null)).isInstanceOf(IllegalStateException.class);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM baitly_chat_turns",Integer.class)).isZero();
    }
    @Test void recoveryUsesActualReceiptAndNeverTreatsRunningEmptyHistoryAsUntouched() {
        var pending=mock(com.clenzy.repository.AgentPendingActionRepository.class);
        var conversations=mock(com.clenzy.repository.AssistantConversationRepository.class);
        var messages=mock(com.clenzy.repository.AssistantMessageRepository.class);
        var runs=mock(com.clenzy.repository.AgentRunRepository.class);
        when(conversations.findByIdAndUser(9L,"recipe-user"))
                .thenReturn(Optional.of(new com.clenzy.model.AssistantConversation(7L,"recipe-user")));
        var recovery=new BaitlyChatRecoveryService(pending,conversations,messages,runs,mock(PendingToolStore.class),journal);
        textTurn(UUID.randomUUID());
        when(messages.findByOrganizationIdAndConversationIdOrderByCreatedAtAscIdAsc(7L,9L)).thenReturn(history());
        assertThat(recovery.read(9L,"recipe-user",7L).canStart()).isTrue();
        journal.begin(7L,"recipe-user",9L,UUID.randomUUID(),null);
        jdbc.update("DELETE FROM assistant_message");
        when(messages.findByOrganizationIdAndConversationIdOrderByCreatedAtAscIdAsc(7L,9L)).thenReturn(List.of());
        assertThat(recovery.read(9L,"recipe-user",7L).canStart()).isFalse();
        verify(pending,never()).claimDecision(any(),any(),any(),any(),any());
    }
    @ParameterizedTest @ValueSource(strings={"none","synthetic","navigation","tax","duplicate","outage"})
    void realMonoLoopProvesTextAndRecordsBoundedToolEvidence(String variant) {
        boolean withTool=!"none".equals(variant);
        var provider=mock(ChatLLMProvider.class);
        var repository=mock(com.clenzy.repository.AssistantMessageRepository.class);
        when(repository.save(any())).thenAnswer(call->{
            AssistantMessage row=call.getArgument(0);
            long id=message(row.getRole(),row.getContent(),row.getFinishReason());
            jdbc.update("UPDATE assistant_message SET tool_calls="+(postgres?"CAST(? AS JSONB)":"?")+",tool_call_id=? WHERE id=?",row.getToolCalls(),row.getToolCallId(),id);
            row.setId(id); return row;
        });
        var effects=new AtomicInteger(); var providerCalls=new AtomicInteger();
        var mapper=new com.fasterxml.jackson.databind.ObjectMapper();
        var fake=mock(ToolHandler.class);
        when(fake.name()).thenReturn("synthetic_tool");
        when(fake.descriptor()).thenReturn(ToolDescriptor.readOnly("synthetic_tool","Synthetic fixture",mapper.createObjectNode()));
        when(fake.execute(any(),any())).thenAnswer(call->{
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            assertThat(jdbc.queryForObject("SELECT status FROM baitly_chat_tool_evidence",String.class)).isEqualTo("STARTED");
            effects.incrementAndGet(); return ToolResult.success("{}");
        });
        var tax=mock(com.clenzy.service.TouristTaxService.class);
        when(tax.computeForReservationId(1L,7L)).thenAnswer(call->{
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            assertThat(jdbc.queryForObject("SELECT status FROM baitly_chat_tool_evidence",String.class)).isEqualTo("STARTED");
            return Optional.empty();
        });
        ToolHandler handler=switch(variant) {
            case "navigation" -> new com.clenzy.service.agent.tools.SuggestNavigationTool(mapper);
            case "tax" -> new com.clenzy.service.agent.tools.ComputeTouristTaxTool(tax,mapper);
            default -> fake;
        };
        String args=switch(variant) {
            case "navigation" -> "{\"path\":\"/reports\",\"label\":\"Synthetic\",\"reason\":\"Synthetic\"}";
            case "tax" -> "{\"reservationId\":1}";
            default -> "{}";
        };
        doAnswer(call->{
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            java.util.function.Consumer<ChatEvent> output=call.getArgument(1);
            if(withTool && providerCalls.getAndIncrement()==0) {
                var toolCall=new ChatMessage.ToolCall("fixture-tool",handler.name(),args);
                output.accept(new ChatEvent.ToolCallRequest("duplicate".equals(variant)?List.of(toolCall,toolCall):List.of(toolCall)));
                output.accept(new ChatEvent.Done(0,0,"synthetic-model","tool_use",""));
            } else {
                output.accept(new ChatEvent.TextDelta("Synthetic response"));
                output.accept(new ChatEvent.Done(0,0,"synthetic-model","stop","Synthetic response"));
            }
            return null;
        }).when(provider).streamChat(any(ChatRequest.class),any());
        var registry=new ToolRegistry(withTool?List.of(handler):List.of());
        var loop=new AgentToolLoopRunner(provider,registry,repository,new PendingToolStore(),mapper,
                mock(com.clenzy.service.AiTokenBudgetService.class),null,null,null,null,null,null);
        var conversation=new com.clenzy.model.AssistantConversation(7L,"recipe-user"); conversation.setId(9L);
        Runnable run=()->executor.execute(UUID.randomUUID(),7L,"recipe-user",9L,null,out->{
            message("user","Synthetic question",null);
            if("outage".equals(variant)) jdbc.execute("DROP TABLE baitly_chat_tool_evidence");
            loop.runToolLoop(new ChatRequest("Synthetic system",List.of(ChatMessage.user("Synthetic question")),
                    registry.listDescriptors(),"synthetic-model",0,128),conversation,AgentContext.minimal(7L,"recipe-user"),null,out);
            return 9L;
        },e->{});
        if(Set.of("duplicate","outage").contains(variant)) {
            assertThatThrownBy(run::run).hasMessage("Baitly chat completion unavailable").hasNoCause();
            assertThat(effects.get()).isEqualTo("duplicate".equals(variant)?1:0);
            assertThat(state()).isEqualTo("UNCERTAIN");
            return;
        }
        run.run();
        assertThat(state()).isEqualTo(withTool?"UNCERTAIN":"SAFE_TEXT");
        assertThat(effects.get()).isEqualTo("synthetic".equals(variant)?1:0);
        var proofs=new BaitlyChatCompletionJournal(jdbc,new DataSourceTransactionManager(source)).toolEvidence(7L,"recipe-user",9L);
        if(!withTool) assertThat(proofs).isEmpty();
        else {
            assertThat(proofs).hasSize(1);
            assertThat(proofs.getFirst().status()).isEqualTo("synthetic".equals(variant)?"UNCERTAIN":"READ_ONLY_COMPLETED");
            assertThat(proofs.getFirst().proofKind()).isEqualTo(switch(variant) {
                case "tax" -> "TAX_READ_ONLY_V1"; case "navigation" -> "NAVIGATION_ONLY_V1"; default -> "UNVERIFIED";
            });
        }
    }

    private BaitlyChatCompletionJournal.Ticket startedTool(String id,ToolHandler handler) {
        var ticket=journal.begin(7L,"recipe-user",9L,UUID.randomUUID(),null);
        journal.startTool(ticket,id,handler);
        return ticket;
    }
    private long toolMessage(String id) {
        long message=message("tool","synthetic-private-result",null);
        jdbc.update("UPDATE assistant_message SET tool_call_id=? WHERE id=?",id,message);
        return message;
    }
    private ToolHandler navigation() {
        return new com.clenzy.service.agent.tools.SuggestNavigationTool(new com.fasterxml.jackson.databind.ObjectMapper());
    }
    @Test void startedInvocationSurvivesCrashAndCannotBeClaimedTwice() {
        var ticket=startedTool("invocation",navigation());
        var reboot=new BaitlyChatCompletionJournal(jdbc,new DataSourceTransactionManager(source));
        assertThat(reboot.toolEvidence(7L,"recipe-user",9L).getFirst().status()).isEqualTo("STARTED");
        assertThatThrownBy(()->reboot.startTool(ticket,"invocation",navigation())).hasMessage("Baitly chat completion unavailable").hasNoCause();
        assertThat(state()).isEqualTo("RUNNING");
    }
    @Test void successfulWriteReturnNeverBecomesBusinessSuccess() {
        var handler=mock(ToolHandler.class);
        when(handler.name()).thenReturn("suggest_navigation"); // Even a borrowed name/read-only descriptor proves nothing.
        when(handler.descriptor()).thenReturn(navigation().descriptor());
        var ticket=startedTool("write",handler);
        journal.finishTool(ticket,"write",toolMessage("write"),false);
        var proof=journal.toolEvidence(7L,"recipe-user",9L).getFirst();
        assertThat(proof.status()).isEqualTo("UNCERTAIN"); assertThat(proof.proofKind()).isEqualTo("UNVERIFIED");
        assertThat(proof.resultMessageId()).isNull();
        verify(handler,never()).descriptor(); // Unreviewed code is not invoked to classify evidence.
        assertThatThrownBy(()->journal.startTool(ticket,"write",handler)).hasMessage("Baitly chat completion unavailable");
    }
    @ParameterizedTest @ValueSource(strings={"error","missing","wrong-call","duplicate"})
    void incompleteReadEvidenceCannotBeQualified(String variant) {
        var ticket=startedTool("read",navigation());
        Long id="missing".equals(variant)?999L:toolMessage("wrong-call".equals(variant)?"other":"read");
        if("duplicate".equals(variant)) toolMessage("read");
        journal.finishTool(ticket,"read",id,"error".equals(variant));
        assertThat(journal.toolEvidence(7L,"recipe-user",9L).getFirst().status()).isEqualTo("UNCERTAIN");
    }
    @Test void proofReadRevalidatesResultAndNeverLeaksPayloadOrOtherScope() throws Exception {
        var ticket=startedTool("read",navigation()); long id=toolMessage("read");
        journal.finishTool(ticket,"read",id,false);
        assertThat(journal.toolEvidence(7L,"recipe-user",9L).getFirst().resultMessageId()).isEqualTo("history-"+id);
        String json=new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(journal.toolEvidence(7L,"recipe-user",9L));
        assertThat(json).doesNotContain("synthetic-private-result","arguments","content","recipe-user");
        assertThat(journal.toolEvidence(8L,"recipe-user",9L)).isEmpty();
        assertThat(journal.toolEvidence(7L,"other-user",9L)).isEmpty();
        assertThat(journal.toolEvidence(7L,"recipe-user",10L)).isEmpty();
        toolMessage("read");
        assertThat(journal.toolEvidence(7L,"recipe-user",9L).getFirst().status()).isEqualTo("UNCERTAIN");
    }
    @Test void journalOutageAndOuterTransactionsFailClosedWithoutDiagnostics() {
        var ticket=journal.begin(7L,"recipe-user",9L,UUID.randomUUID(),null);
        var tx=new org.springframework.transaction.support.TransactionTemplate(new DataSourceTransactionManager(source));
        tx.executeWithoutResult(status->assertThatThrownBy(()->journal.startTool(ticket,"read",navigation()))
            .hasMessage("Baitly chat completion unavailable").hasNoCause());
        jdbc.execute("DROP TABLE baitly_chat_tool_evidence");
        assertThatThrownBy(()->journal.startTool(ticket,"read",navigation())).hasMessage("Baitly chat completion unavailable").hasNoCause();
        assertThatThrownBy(()->journal.toolEvidence(7L,"recipe-user",9L)).hasMessage("Baitly chat completion unavailable").hasNoCause();
    }
    @Test void finishedTurnCannotAdmitAnotherToolOrRequalifyAnUncertainResult() {
        var ticket=startedTool("read",navigation());
        journal.finishTool(ticket,"read",toolMessage("read"),true);
        assertThatThrownBy(()->journal.finishTool(ticket,"read",1L,false)).hasMessage("Baitly chat completion unavailable");
        journal.uncertain(ticket);
        assertThatThrownBy(()->journal.startTool(ticket,"another",navigation())).hasMessage("Baitly chat completion unavailable");
    }
    @Test void concurrentToolClaimsHaveOneWinner() throws Exception {
        var ticket=journal.begin(7L,"recipe-user",9L,UUID.randomUUID(),null);
        var pool=Executors.newFixedThreadPool(2); var latch=new CountDownLatch(1);
        try {
            Callable<Boolean> claim=()->{ latch.await(); try { journal.startTool(ticket,"same-call",navigation()); return true; }
                catch(IllegalStateException unavailable) { return false; } };
            var first=pool.submit(claim); var second=pool.submit(claim); latch.countDown();
            assertThat(List.of(first.get(10,TimeUnit.SECONDS),second.get(10,TimeUnit.SECONDS))).containsExactlyInAnyOrder(true,false);
            assertThat(journal.toolEvidence(7L,"recipe-user",9L)).hasSize(1);
        } finally { pool.shutdownNow(); }
    }
    @Test void confirmedEffectInterruptedBeforeResultRemainsFencedWithoutReplay() {
        var mapper=new com.fasterxml.jackson.databind.ObjectMapper();
        var handler=mock(ToolHandler.class); var effects=new AtomicInteger();
        when(handler.name()).thenReturn("synthetic_write");
        when(handler.descriptor()).thenReturn(ToolDescriptor.write("synthetic_write","Synthetic",mapper.createObjectNode()));
        when(handler.execute(any(),any())).thenAnswer(call->{
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            assertThat(journal.toolEvidence(7L,"recipe-user",9L).getFirst().status()).isEqualTo("STARTED");
            effects.incrementAndGet(); return ToolResult.success("synthetic-private-result");
        });
        var loop=new AgentToolLoopRunner(mock(ChatLLMProvider.class),new ToolRegistry(List.of(handler)),
            mock(com.clenzy.repository.AssistantMessageRepository.class),new PendingToolStore(),mapper,
            mock(com.clenzy.service.AiTokenBudgetService.class),null,null,null,null,null,null);
        var pending=new PendingToolStore.PendingTool("confirmed-call",9L,7L,"recipe-user","synthetic_write","{}",
            List.of(),null,Instant.now().plusSeconds(60));
        assertThatThrownBy(()->executor.execute(UUID.randomUUID(),7L,"recipe-user",9L,null,out->{
            loop.executeConfirmed(pending,AgentContext.minimal(7L,"recipe-user"));
            throw new IllegalStateException("synthetic-crash-after-effect");
        },e->{})).hasMessage("Baitly chat completion unavailable").hasNoCause();
        assertThat(effects.get()).isEqualTo(1);
        assertThat(state()).isEqualTo("UNCERTAIN");
        assertThat(journal.toolEvidence(7L,"recipe-user",9L).getFirst().status()).isEqualTo("STARTED");
        assertThatThrownBy(()->executor.execute(UUID.randomUUID(),7L,"recipe-user",9L,null,out->{
            loop.executeConfirmed(pending,AgentContext.minimal(7L,"recipe-user")); return 9L;
        },e->{})).hasMessage("Baitly chat completion unavailable");
        assertThat(effects.get()).isEqualTo(1);
    }
    @Test void recoveryExposesReadEvidenceWithoutPromotingToolTurnToAdmission() {
        var ticket=startedTool("read",navigation()); toolMessage("read");
        journal.finishTool(ticket,"read",nextMessage,false); journal.uncertain(ticket);
        var pending=mock(com.clenzy.repository.AgentPendingActionRepository.class);
        var conversations=mock(com.clenzy.repository.AssistantConversationRepository.class);
        var messages=mock(com.clenzy.repository.AssistantMessageRepository.class);
        when(conversations.findByIdAndUser(9L,"recipe-user"))
            .thenReturn(Optional.of(new com.clenzy.model.AssistantConversation(7L,"recipe-user")));
        when(messages.findByOrganizationIdAndConversationIdOrderByCreatedAtAscIdAsc(7L,9L)).thenReturn(history());
        var recovery=new BaitlyChatRecoveryService(pending,conversations,messages,
            mock(com.clenzy.repository.AgentRunRepository.class),mock(PendingToolStore.class),journal).read(9L,"recipe-user",7L);
        assertThat(recovery.canStart()).isFalse();
        assertThat(recovery.toolEvidence().getFirst().status()).isEqualTo("READ_ONLY_COMPLETED");
        assertThat(recovery.history().getFirst().content()).isNull();
        verify(pending,never()).claimDecision(any(),any(),any(),any(),any());
    }
    @ParameterizedTest @ValueSource(strings={"organization","user","conversation"})
    void invocationContextMustMatchAdmittedTurnBeforeDispatch(String variant) {
        var ticket=journal.begin(7L,"recipe-user",9L,UUID.randomUUID(),null);
        try(var observation=BaitlyChatTurnObservation.open()) {
            observation.bind(journal,ticket);
            var context=AgentContext.minimal("organization".equals(variant)?8L:7L,
                "user".equals(variant)?"other-user":"recipe-user");
            assertThatThrownBy(()->BaitlyChatTurnObservation.toolStarted("read",navigation(),context,
                "conversation".equals(variant)?10L:9L)).hasMessage("Baitly chat completion unavailable").hasNoCause();
            assertThat(journal.toolEvidence(7L,"recipe-user",9L)).isEmpty();
        }
    }
    @Test void unstructuredInvocationIdentifiersAreRejectedWithoutStoringThem() {
        var ticket=journal.begin(7L,"recipe-user",9L,UUID.randomUUID(),null);
        assertThatThrownBy(()->journal.startTool(ticket,"https://private-canary.invalid/?token=canary",navigation()))
            .hasMessage("Baitly chat completion unavailable").hasNoCause();
        assertThat(journal.toolEvidence(7L,"recipe-user",9L)).isEmpty();
    }
    @Test void resultAlreadyRecordedWithoutInvocationReceiptStillPreventsDispatch() {
        var ticket=journal.begin(7L,"recipe-user",9L,UUID.randomUUID(),null);
        toolMessage("legacy-result");
        assertThatThrownBy(()->journal.startTool(ticket,"legacy-result",navigation()))
            .hasMessage("Baitly chat completion unavailable").hasNoCause();
        assertThat(journal.toolEvidence(7L,"recipe-user",9L)).isEmpty();
    }
    private void toolTurn(String variant,UUID request) {
        var mapper=new com.fasterxml.jackson.databind.ObjectMapper();
        var tax=mock(com.clenzy.service.TouristTaxService.class);
        when(tax.computeForReservationId(1L,7L)).thenReturn(Optional.empty());
        ToolHandler navigation=navigation(); ToolHandler taxHandler=new com.clenzy.service.agent.tools.ComputeTouristTaxTool(tax,mapper);
        var provider=mock(ChatLLMProvider.class); var step=new AtomicInteger();
        var repository=mock(com.clenzy.repository.AssistantMessageRepository.class);
        when(repository.save(any())).thenAnswer(call->{
            AssistantMessage row=call.getArgument(0); long id=message(row.getRole(),row.getContent(),row.getFinishReason());
            jdbc.update("UPDATE assistant_message SET tool_calls="+(postgres?"CAST(? AS JSONB)":"?")+",tool_call_id=? WHERE id=?",row.getToolCalls(),row.getToolCallId(),id);
            row.setId(id); return row;
        });
        String navigationArgs="{\"path\":\"/reports\",\"label\":\"Synthetic\",\"reason\":\"Synthetic\"}";
        doAnswer(call->{
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            java.util.function.Consumer<ChatEvent> output=call.getArgument(1);
            int current=step.getAndIncrement();
            var first=new ChatMessage.ToolCall("nav-call",navigation.name(),navigationArgs);
            var second=new ChatMessage.ToolCall("tax-call",taxHandler.name(),"{\"reservationId\":1}");
            if(current==0 || ("iterations".equals(variant) && current==1)) {
                var calls="iterations".equals(variant)?List.of(current==0?first:second):List.of(first,second);
                output.accept(new ChatEvent.ToolCallRequest(calls));
                output.accept(new ChatEvent.Done(0,0,"synthetic","tool_use",""));
            } else {
                output.accept(new ChatEvent.TextDelta("Synthetic final answer"));
                output.accept(new ChatEvent.Done(0,0,"synthetic","stop","Synthetic final answer"));
            }
            return null;
        }).when(provider).streamChat(any(ChatRequest.class),any());
        var registry=new ToolRegistry(List.of(navigation,taxHandler));
        var loop=new AgentToolLoopRunner(provider,registry,repository,new PendingToolStore(),mapper,
            mock(com.clenzy.service.AiTokenBudgetService.class),null,null,null,null,null,null);
        var conversation=new com.clenzy.model.AssistantConversation(7L,"recipe-user"); conversation.setId(9L);
        executor.executeWithTools(request,7L,"recipe-user",9L,null,out->{
            message("user","Synthetic question",null);
            loop.runToolLoop(new ChatRequest("Synthetic system",List.of(ChatMessage.user("Synthetic question")),registry.listDescriptors(),
                "synthetic",0,128),conversation,AgentContext.minimal(7L,"recipe-user"),null,event->{
                    if("missing-event".equals(variant) && "tool_call_executed".equals(event.type())) return;
                    out.accept(event);
                    if("duplicate-event".equals(variant) && "tool_call_executed".equals(event.type())) out.accept(event);
                });
            switch(variant) {
                case "missing-result" -> jdbc.update("DELETE FROM assistant_message WHERE role='tool' AND tool_call_id='nav-call'");
                case "extra-result" -> toolMessage("uncovered-call");
                case "unknown-proof" -> jdbc.update("UPDATE baitly_chat_tool_evidence SET proof_kind='UNVERIFIED',status='UNCERTAIN' WHERE tool_call_id='nav-call'");
                case "attachment" -> jdbc.update("UPDATE assistant_message SET attachments="+(postgres?"CAST(? AS JSONB)":"?")+" WHERE id=?","[{}]",nextMessage);
                case "multi-agent" -> BaitlyChatTurnObservation.multiAgent();
                case "error-event" -> out.accept(AgentSseEvent.error("synthetic-private-canary"));
                case "missing-evidence" -> jdbc.update("DELETE FROM baitly_chat_tool_evidence WHERE tool_call_id='nav-call'");
                case "extra-evidence" -> journal.startTool(jdbcTicket(),"uncovered",navigation);
                case "certificate-outage" -> jdbc.execute("DROP TABLE baitly_chat_tool_turn_proofs");
                case "blank-final" -> jdbc.update("UPDATE assistant_message SET content=' ' WHERE id=?",nextMessage);
                case "wrong-finish" -> jdbc.update("UPDATE assistant_message SET finish_reason='length' WHERE id=?",nextMessage);
                case "extra-user" -> message("user","Uncovered concurrent question",null);
                case "wrong-name" -> jdbc.update("UPDATE assistant_message SET tool_calls="+(postgres?"CAST(? AS JSONB)":"?")
                    +" WHERE role='assistant' AND tool_calls IS NOT NULL","[{\"id\":\"nav-call\",\"name\":\"unreviewed_write\"}]");
                default -> { }
            }
            return 9L;
        },event->{
            if("done".equals(event.type()) && Set.of("batch","iterations").contains(variant))
                assertThat(journal.proof(7L,"recipe-user",9L,history()).status()).isEqualTo("SAFE_TOOLS");
        });
    }
    private BaitlyChatCompletionJournal.Ticket jdbcTicket() {
        UUID id=jdbc.queryForObject("SELECT id FROM baitly_chat_turns ORDER BY turn_sequence DESC LIMIT 1",UUID.class);
        return new BaitlyChatCompletionJournal.Ticket(id,7L,"recipe-user",9L,null,0,false,true);
    }
    @ParameterizedTest @ValueSource(strings={"batch","iterations"})
    void completeReadToolTurnCommitsCertificateBeforeTerminalAndRestoresWithoutReplay(String variant) {
        UUID request=UUID.randomUUID(); toolTurn(variant,request);
        var reboot=new BaitlyChatCompletionJournal(jdbc,new DataSourceTransactionManager(source));
        var proof=reboot.proof(7L,"recipe-user",9L,history());
        assertThat(proof.status()).isEqualTo("SAFE_TOOLS"); assertThat(proof.policy()).isEqualTo(BaitlyChatCompletionJournal.TOOLS_POLICY);
        assertThat(proof.requestId()).isEqualTo(request.toString());
        assertThat(state()).isEqualTo("UNCERTAIN"); // Old implementations remain fail-closed on rollback.
        assertThatThrownBy(()->journal.begin(7L,"recipe-user",9L,UUID.randomUUID(),null)).hasMessage("Baitly chat completion unavailable");
        executor.executeWithTools(UUID.randomUUID(),7L,"recipe-user",9L,null,out->{
            message("user","Next explicit question",null); long end=message("assistant","Next response","stop");
            BaitlyChatTurnObservation.textPersisted(end,"stop"); out.accept(AgentSseEvent.done("stop")); return 9L;
        },e->{});
        assertThat(reboot.proof(7L,"recipe-user",9L,history()).status()).isEqualTo("SAFE_TOOLS");
        assertThatThrownBy(()->executor.executeWithTools(request,7L,"recipe-user",9L,null,out->{throw new AssertionError("Must never replay");},e->{}))
            .hasMessage("Baitly chat completion unavailable");
    }
    @ParameterizedTest @ValueSource(strings={"missing-result","extra-result","unknown-proof","attachment","multi-agent",
        "error-event","missing-evidence","extra-evidence","missing-event","duplicate-event","blank-final","wrong-finish","extra-user","wrong-name"})
    void partialOrAmbiguousToolTurnNeverReceivesACompletionCertificate(String variant) {
        toolTurn(variant,UUID.randomUUID());
        assertThat(journal.proof(7L,"recipe-user",9L,history()).status()).isEqualTo("UNCERTAIN");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM baitly_chat_tool_turn_proofs",Integer.class)).isZero();
        assertThatThrownBy(()->journal.begin(7L,"recipe-user",9L,UUID.randomUUID(),null,true)).hasMessage("Baitly chat completion unavailable");
    }
    @Test void certificateOutageCannotFlushTerminalOrReleaseUncertainty() {
        assertThatThrownBy(()->toolTurn("certificate-outage",UUID.randomUUID())).hasMessage("Baitly chat completion unavailable").hasNoCause();
        assertThat(state()).isEqualTo("UNCERTAIN");
    }
    @ParameterizedTest @ValueSource(strings={"result","calls","certificate","evidence"})
    void readProofRechecksEntireCoveredToolHistory(String variant) {
        toolTurn("batch",UUID.randomUUID());
        switch(variant) {
            case "result" -> jdbc.update("DELETE FROM assistant_message WHERE tool_call_id='nav-call'");
            case "calls" -> jdbc.update("UPDATE assistant_message SET tool_calls="+(postgres?"CAST(? AS JSONB)":"?")+" WHERE role='assistant' AND tool_calls IS NOT NULL","[]");
            case "certificate" -> jdbc.update("UPDATE baitly_chat_tool_turn_proofs SET end_message_id=999");
            case "evidence" -> jdbc.update("UPDATE baitly_chat_tool_evidence SET result_message_id=999");
            default -> throw new AssertionError();
        }
        assertThat(journal.proof(7L,"recipe-user",9L,history()).status()).isEqualTo("UNCERTAIN");
        assertThatThrownBy(()->journal.begin(7L,"recipe-user",9L,UUID.randomUUID(),null,true)).hasMessage("Baitly chat completion unavailable");
    }
    @Test void laterTextReceiptCannotHideCorruptionInEarlierToolTurn() {
        toolTurn("batch",UUID.randomUUID());
        executor.executeWithTools(UUID.randomUUID(),7L,"recipe-user",9L,null,out->{
            message("user","Next explicit question",null); long end=message("assistant","Next response","stop");
            BaitlyChatTurnObservation.textPersisted(end,"stop"); out.accept(AgentSseEvent.done("stop")); return 9L;
        },e->{});
        jdbc.update("UPDATE baitly_chat_tool_evidence SET result_message_id=999 WHERE tool_call_id='nav-call'");
        assertThat(journal.proof(7L,"recipe-user",9L,history()).status()).isEqualTo("UNCERTAIN");
        assertThatThrownBy(()->journal.begin(7L,"recipe-user",9L,UUID.randomUUID(),null,true)).hasMessage("Baitly chat completion unavailable");
    }
    @Test void certifiedToolsPermitOnlyOneConcurrentNewAdmission() throws Exception {
        toolTurn("batch",UUID.randomUUID());
        var pool=Executors.newFixedThreadPool(2); var latch=new CountDownLatch(1);
        try {
            Callable<Boolean> claim=()->{ latch.await(); try { journal.begin(7L,"recipe-user",9L,UUID.randomUUID(),null,true); return true; }
                catch(IllegalStateException unavailable) { return false; } };
            var first=pool.submit(claim); var second=pool.submit(claim); latch.countDown();
            assertThat(List.of(first.get(10,TimeUnit.SECONDS),second.get(10,TimeUnit.SECONDS))).containsExactlyInAnyOrder(true,false);
        } finally { pool.shutdownNow(); }
    }

    private com.clenzy.service.agent.ToolHandler writeHandler(String kind,String variant) {
        jdbc.execute("CREATE TABLE properties(id BIGINT PRIMARY KEY,organization_id BIGINT,status VARCHAR(32))");
        jdbc.update("INSERT INTO properties VALUES (11,7,'ACTIVE')");
        jdbc.execute("CREATE TABLE assistant_memory(id BIGINT PRIMARY KEY,organization_id BIGINT,keycloak_id VARCHAR(255),memory_key VARCHAR(120),memory_value TEXT)");
        jdbc.update("INSERT INTO assistant_memory VALUES (12,7,'recipe-user','synthetic-private-key','synthetic-private-value')");
        var mapper=new com.fasterxml.jackson.databind.ObjectMapper();
        if("property".equals(kind)) {
            var property=new com.clenzy.model.Property(); property.setId(11L); property.setOrganizationId(7L);
            property.setName("synthetic-private-name"); property.setStatus(com.clenzy.model.PropertyStatus.ACTIVE);
            var repository=mock(com.clenzy.repository.PropertyRepository.class);
            when(repository.findById(11L)).thenReturn(Optional.of(property));
            when(repository.save(any())).thenAnswer(call->{
                var saved=(com.clenzy.model.Property)call.getArgument(0);
                assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isTrue();
                jdbc.update("UPDATE properties SET status=? WHERE id=? AND organization_id=?",saved.getStatus().name(),saved.getId(),saved.getOrganizationId());
                if("rollback".equals(variant)) failBeforeCommit();
                return saved;
            });
            var tenant=mock(com.clenzy.tenant.TenantContext.class); when(tenant.getOrganizationId()).thenReturn(7L);
            var service=new com.clenzy.service.PropertyService(repository,mock(com.clenzy.repository.UserRepository.class),
                mock(com.clenzy.repository.ManagerPropertyRepository.class),mock(com.clenzy.repository.PortfolioClientRepository.class),
                mock(com.clenzy.repository.PortfolioRepository.class),mock(com.clenzy.repository.CheckInInstructionsRepository.class),
                mock(com.clenzy.repository.PropertyPhotoRepository.class),mock(com.clenzy.integration.airbnb.repository.AirbnbListingMappingRepository.class),
                mock(com.clenzy.service.NotificationService.class),tenant,new com.clenzy.service.access.OrganizationAccessGuard(tenant),
                mock(com.clenzy.service.regulatory.FrCommuneResolver.class),mock(com.clenzy.service.TouristTaxService.class));
            if("cross-org".equals(variant)) property.setOrganizationId(8L);
            if("staff-cross-org".equals(variant)) {
                property.setOrganizationId(8L); when(tenant.isSuperAdmin()).thenReturn(true);
                jdbc.update("UPDATE properties SET organization_id=8");
            }
            return new com.clenzy.service.agent.tools.UpdatePropertyStatusTool(transactional(service),mapper);
        }
        var repository=mock(com.clenzy.repository.AssistantMemoryRepository.class);
        when(repository.findOwnedForDeletion(any(),any(),any())).thenAnswer(call->{
            var rows=jdbc.query("SELECT * FROM assistant_memory WHERE organization_id=? AND keycloak_id=? AND memory_key=?",
                (rs,n)->{var memory=new com.clenzy.model.AssistantMemory(rs.getLong("organization_id"),rs.getString("keycloak_id"),
                    rs.getString("memory_key"),rs.getString("memory_value"),com.clenzy.model.AssistantMemory.Scope.FACT);
                    memory.setId(rs.getLong("id")); return memory;},call.getArgument(0),call.getArgument(1),call.getArgument(2));
            return rows.stream().findFirst();
        });
        when(repository.deleteOwnedById(any(),any(),any())).thenAnswer(call->{
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isTrue();
            int changed=jdbc.update("DELETE FROM assistant_memory WHERE organization_id=? AND keycloak_id=? AND id=?",
                call.getArgument(0),call.getArgument(1),call.getArgument(2));
            if("rollback".equals(variant)) failBeforeCommit();
            return changed;
        });
        if("missing".equals(variant)) jdbc.update("DELETE FROM assistant_memory");
        if("cross-org".equals(variant)) jdbc.update("UPDATE assistant_memory SET organization_id=8");
        var service=new com.clenzy.service.AssistantMemoryService(repository,Optional.empty(),false);
        return new com.clenzy.service.agent.tools.ForgetFactTool(transactional(service),mapper);
    }
    private void failBeforeCommit() {
        TransactionSynchronizationManager.registerSynchronization(new org.springframework.transaction.support.TransactionSynchronization() {
            @Override public void beforeCommit(boolean readOnly) { throw new IllegalStateException("synthetic-private-commit-failure"); }
        });
    }
    @SuppressWarnings("unchecked") private <T> T transactional(T target) {
        var proxy=new org.springframework.aop.framework.ProxyFactory(target); proxy.setProxyTargetClass(true);
        proxy.addAdvice(new org.springframework.transaction.interceptor.TransactionInterceptor(new DataSourceTransactionManager(source),
            new org.springframework.transaction.annotation.AnnotationTransactionAttributeSource()));
        return (T)proxy.getProxy();
    }
    private void executeWrite(String kind,String variant) {
        var concrete=writeHandler(kind,variant);
        ToolHandler handler="unreviewed".equals(variant)?new ToolHandler() {
            public String name() { return concrete.name(); }
            public ToolDescriptor descriptor() { return concrete.descriptor(); }
            public ToolResult execute(com.fasterxml.jackson.databind.JsonNode args,AgentContext context) { return concrete.execute(args,context); }
        }:concrete;
        var mapper=new com.fasterxml.jackson.databind.ObjectMapper();
        var loop=new AgentToolLoopRunner(mock(ChatLLMProvider.class),new ToolRegistry(List.of(handler)),
            mock(com.clenzy.repository.AssistantMessageRepository.class),new PendingToolStore(),mapper,
            mock(com.clenzy.service.AiTokenBudgetService.class),null,null,null,null,null,null);
        String args="property".equals(kind)?"{\"propertyId\":11,\"status\":\"INACTIVE\"}":"{\"key\":\"synthetic-private-key\"}";
        var pending=new PendingToolStore.PendingTool("write-call",9L,7L,"recipe-user",handler.name(),args,List.of(),null,Instant.now().plusSeconds(60));
        executor.executeWithTools(UUID.randomUUID(),7L,"recipe-user",9L,null,out->{
            if("proof-outage".equals(variant)) jdbc.execute("DROP TABLE baitly_chat_write_business_proofs");
            var result=loop.executeConfirmed(pending,AgentContext.minimal(7L,"recipe-user"));
            if("crash-after-effect".equals(variant)) throw new IllegalStateException("synthetic-private-crash");
            out.accept(AgentSseEvent.toolCallExecuted(handler.name(),"write-call",result.isError(),null,null));
            long id=message("tool",result.content(),null);
            jdbc.update("UPDATE assistant_message SET tool_call_id='write-call' WHERE id=?",id);
            BaitlyChatTurnObservation.toolPersisted("write-call",id,result.isError());
            out.accept(AgentSseEvent.done("stop")); return 9L;
        },e->{});
    }
    @ParameterizedTest @ValueSource(strings={"property","memory"})
    void internalWriteProofCommitsWithBusinessMutationButDoesNotReleaseConversation(String kind) throws Exception {
        executeWrite(kind,"success");
        var proof=journal.writeEvidence(7L,"recipe-user",9L).getFirst();
        assertThat(proof.outcome()).isEqualTo("COMMITTED"); assertThat(proof.resultState()).isEqualTo("RECORDED");
        assertThat(proof.proofKind()).isEqualTo("property".equals(kind)?"PROPERTY_STATUS_V1":"MEMORY_DELETE_V1");
        assertThat(journal.proof(7L,"recipe-user",9L,history()).status()).isEqualTo("UNCERTAIN");
        assertThat(journal.toolEvidence(7L,"recipe-user",9L).getFirst().status()).isEqualTo("UNCERTAIN");
        String json=new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(proof);
        assertThat(json).doesNotContain("synthetic-private","resourceId","targetState","recipe-user");
        assertThat(journal.writeEvidence(8L,"recipe-user",9L)).isEmpty();
        assertThat(journal.writeEvidence(7L,"other-user",9L)).isEmpty();
        assertThat(journal.writeEvidence(7L,"recipe-user",10L)).isEmpty();
        var conversations=mock(com.clenzy.repository.AssistantConversationRepository.class);
        var messages=mock(com.clenzy.repository.AssistantMessageRepository.class);
        when(conversations.findByIdAndUser(9L,"recipe-user")).thenReturn(Optional.of(new com.clenzy.model.AssistantConversation(7L,"recipe-user")));
        when(messages.findByOrganizationIdAndConversationIdOrderByCreatedAtAscIdAsc(7L,9L)).thenReturn(history());
        var recovery=new BaitlyChatRecoveryService(mock(com.clenzy.repository.AgentPendingActionRepository.class),conversations,messages,
            mock(com.clenzy.repository.AgentRunRepository.class),mock(PendingToolStore.class),journal).read(9L,"recipe-user",7L);
        assertThat(recovery.canStart()).isFalse(); assertThat(recovery.writeEvidence()).hasSize(1);
        assertThatThrownBy(()->journal.begin(7L,"recipe-user",9L,UUID.randomUUID(),null,true)).hasMessage("Baitly chat completion unavailable");
        if("property".equals(kind)) assertThat(jdbc.queryForObject("SELECT status FROM properties",String.class)).isEqualTo("INACTIVE");
        else assertThat(jdbc.queryForObject("SELECT count(*) FROM assistant_memory",Integer.class)).isZero();
    }
    @ParameterizedTest @ValueSource(strings={"property","memory"})
    void businessRollbackAlsoRollsBackProof(String kind) {
        executeWrite(kind,"rollback");
        assertThat(journal.writeEvidence(7L,"recipe-user",9L)).isEmpty();
        if("property".equals(kind)) assertThat(jdbc.queryForObject("SELECT status FROM properties",String.class)).isEqualTo("ACTIVE");
        else assertThat(jdbc.queryForObject("SELECT count(*) FROM assistant_memory",Integer.class)).isEqualTo(1);
    }
    @ParameterizedTest @ValueSource(strings={"property","memory"})
    void proofOutagePreventsBusinessCommit(String kind) {
        executeWrite(kind,"proof-outage");
        if("property".equals(kind)) assertThat(jdbc.queryForObject("SELECT status FROM properties",String.class)).isEqualTo("ACTIVE");
        else assertThat(jdbc.queryForObject("SELECT count(*) FROM assistant_memory",Integer.class)).isEqualTo(1);
        assertThatThrownBy(()->journal.writeEvidence(7L,"recipe-user",9L)).hasMessage("Baitly write proof unavailable").hasNoCause();
    }
    @ParameterizedTest @ValueSource(strings={"property","memory"})
    void committedEffectSurvivesMissingResultWithoutReplay(String kind) {
        assertThatThrownBy(()->executeWrite(kind,"crash-after-effect")).hasMessage("Baitly chat completion unavailable");
        var reboot=new BaitlyChatCompletionJournal(jdbc,new DataSourceTransactionManager(source));
        var proof=reboot.writeEvidence(7L,"recipe-user",9L).getFirst();
        assertThat(proof.outcome()).isEqualTo("COMMITTED"); assertThat(proof.resultState()).isEqualTo("MISSING");
        assertThatThrownBy(()->reboot.begin(7L,"recipe-user",9L,UUID.randomUUID(),null,true)).hasMessage("Baitly chat completion unavailable");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM baitly_chat_write_business_proofs",Integer.class)).isEqualTo(1);
    }
    @ParameterizedTest @ValueSource(strings={"property","memory"})
    void crossOrganizationMutationNeverProducesProof(String kind) {
        executeWrite(kind,"cross-org"); assertThat(journal.writeEvidence(7L,"recipe-user",9L)).isEmpty();
    }
    @Test void absentMemoryIsNotInventedIntoADeletionProof() {
        executeWrite("memory","missing"); assertThat(journal.writeEvidence(7L,"recipe-user",9L)).isEmpty();
    }
    @Test void recordingOutsideBusinessTransactionIsRefused() {
        var ticket=journal.begin(7L,"recipe-user",9L,UUID.randomUUID(),null);
        assertThatThrownBy(()->journal.recordWrite(ticket,"write-call","PROPERTY_STATUS_V1",11L,"INACTIVE"))
            .hasMessage("Baitly write proof unavailable").hasNoCause();
        assertThat(journal.writeEvidence(7L,"recipe-user",9L)).isEmpty();
    }
    @Test void duplicateResultDoesNotEraseCommittedBusinessEvidenceOrAuthorizeReplay() {
        executeWrite("property","success"); toolMessage("write-call");
        var proof=journal.writeEvidence(7L,"recipe-user",9L).getFirst();
        assertThat(proof.outcome()).isEqualTo("COMMITTED"); assertThat(proof.resultState()).isEqualTo("CONFLICT");
        assertThat(proof.resultMessageId()).isNull();
        assertThatThrownBy(()->journal.begin(7L,"recipe-user",9L,UUID.randomUUID(),null,true)).hasMessage("Baitly chat completion unavailable");
    }
    @Test void unrelatedTransactionCannotAutocommitAnIndependentProof() {
        var ticket=journal.begin(7L,"recipe-user",9L,UUID.randomUUID(),null);
        var unrelated=new DriverManagerDataSource("jdbc:h2:mem:unrelated"+UUID.randomUUID(),"sa","");
        var tx=new org.springframework.transaction.support.TransactionTemplate(new DataSourceTransactionManager(unrelated));
        tx.executeWithoutResult(status->assertThatThrownBy(()->journal.recordWrite(ticket,"write-call","PROPERTY_STATUS_V1",11L,"INACTIVE"))
            .hasMessage("Baitly write proof unavailable").hasNoCause());
        assertThat(journal.writeEvidence(7L,"recipe-user",9L)).isEmpty();
    }
    @Test void borrowedNameAndPositiveReturnDoNotCreateBusinessProof() {
        executeWrite("property","unreviewed");
        assertThat(jdbc.queryForObject("SELECT status FROM properties",String.class)).isEqualTo("INACTIVE");
        assertThat(journal.writeEvidence(7L,"recipe-user",9L)).isEmpty();
        assertThat(state()).isEqualTo("UNCERTAIN");
    }
    @Test void authorizedCrossOrganizationStaffWriteRemainsAllowedButUnqualified() {
        executeWrite("property","staff-cross-org");
        assertThat(jdbc.queryForObject("SELECT status FROM properties",String.class)).isEqualTo("INACTIVE");
        assertThat(journal.writeEvidence(7L,"recipe-user",9L)).isEmpty();
        assertThat(state()).isEqualTo("UNCERTAIN");
    }
    @jakarta.persistence.Entity(name="BaitlyWriteFixture")
    @jakarta.persistence.Table(name="baitly_write_fixture")
    public static class BaitlyWriteFixture {
        @jakarta.persistence.Id Long id;
        @jakarta.persistence.Column(nullable=false,length=32) String status;
        public BaitlyWriteFixture() {}
    }
    @ParameterizedTest @ValueSource(booleans={false,true})
    void actualJpaCommitAndLateFlushRollbackShareTheProofConnection(boolean failAtFlush) {
        jdbc.execute("CREATE TABLE baitly_write_fixture(id BIGINT PRIMARY KEY,status VARCHAR(32) NOT NULL CHECK(status IN ('ACTIVE','INACTIVE')))");
        jdbc.update("INSERT INTO baitly_write_fixture VALUES (11,'ACTIVE')");
        var config=new Configuration().addAnnotatedClass(BaitlyWriteFixture.class);
        config.getProperties().put("hibernate.connection.datasource",source);
        config.setProperty("hibernate.hbm2ddl.auto","validate");
        try(var factory=config.buildSessionFactory()) {
            var manager=new org.springframework.orm.jpa.JpaTransactionManager(factory);
            manager.setDataSource(source); manager.setJpaDialect(new org.springframework.orm.jpa.vendor.HibernateJpaDialect()); manager.afterPropertiesSet();
            var ticket=journal.begin(7L,"recipe-user",9L,UUID.randomUUID(),null);
            journal.startTool(ticket,"jpa-write",mock(ToolHandler.class));
            var tx=new org.springframework.transaction.support.TransactionTemplate(manager);
            Runnable mutation=()->tx.executeWithoutResult(status->{
                var entityManager=org.springframework.orm.jpa.EntityManagerFactoryUtils.getTransactionalEntityManager(factory);
                var entity=entityManager.find(BaitlyWriteFixture.class,11L);
                entity.status=failAtFlush?"INVALID":"INACTIVE";
                journal.recordWrite(ticket,"jpa-write","PROPERTY_STATUS_V1",11L,"INACTIVE");
                assertThatThrownBy(()->journal.writeEvidence(7L,"recipe-user",9L)).hasMessage("Baitly write proof unavailable");
            });
            if(failAtFlush) assertThatThrownBy(mutation::run).isInstanceOf(RuntimeException.class);
            else mutation.run();
            assertThat(jdbc.queryForObject("SELECT status FROM baitly_write_fixture",String.class)).isEqualTo(failAtFlush?"ACTIVE":"INACTIVE");
            assertThat(journal.writeEvidence(7L,"recipe-user",9L)).hasSize(failAtFlush?0:1);
        }
    }
}
