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
                master.getDatabaseChangeLog().getChangeSets().stream().filter(c->"0607-baitly-chat-turn-receipts".equals(c.getId())).forEach(selected::addChangeSet);
                assertThat(selected.getChangeSets()).hasSize(1);
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
        var config=new Configuration().addAnnotatedClass(BaitlyChatTurn.class);
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
    @ParameterizedTest @ValueSource(booleans={false,true})
    void realMonoLoopProvesTextButNeverCertifiesAToolCall(boolean withTool) {
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
        var handler=mock(ToolHandler.class);
        when(handler.name()).thenReturn("synthetic_tool");
        when(handler.descriptor()).thenReturn(ToolDescriptor.readOnly("synthetic_tool","Synthetic fixture",mapper.createObjectNode()));
        when(handler.execute(any(),any())).thenAnswer(call->{
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            effects.incrementAndGet(); return ToolResult.success("{}");
        });
        doAnswer(call->{
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            java.util.function.Consumer<ChatEvent> output=call.getArgument(1);
            if(withTool && providerCalls.getAndIncrement()==0) {
                output.accept(new ChatEvent.ToolCallRequest(List.of(new ChatMessage.ToolCall("fixture-tool","synthetic_tool","{}"))));
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
        executor.execute(UUID.randomUUID(),7L,"recipe-user",9L,null,out->{
            message("user","Synthetic question",null);
            loop.runToolLoop(new ChatRequest("Synthetic system",List.of(ChatMessage.user("Synthetic question")),
                    registry.listDescriptors(),"synthetic-model",0,128),conversation,AgentContext.minimal(7L,"recipe-user"),null,out);
            return 9L;
        },e->{});
        assertThat(state()).isEqualTo(withTool?"UNCERTAIN":"SAFE_TEXT");
        assertThat(effects.get()).isEqualTo(withTool?1:0);
    }
}
