package com.clenzy.service.agent;

import com.clenzy.model.AssistantMessage;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/** Short, committed transactions only. Provider work never runs in this service. */
@Service
public class BaitlyChatCompletionJournal {
    public static final String POLICY = "durable-text-v1";
    public static final String TOOLS_POLICY = "durable-tools-v2";
    private final JdbcTemplate jdbc;
    private final TransactionTemplate transaction;
    public BaitlyChatCompletionJournal(JdbcTemplate jdbc, PlatformTransactionManager manager) {
        this.jdbc=jdbc;
        transaction=new TransactionTemplate(manager);
        transaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }
    public record Ticket(UUID id, Long organizationId, String userId, Long conversationId,
                         Long baselineId, int baselineCount, boolean resume, boolean toolsPolicy) {
        public Ticket(UUID id,Long org,String user,Long conversation,Long baseline,int count,boolean resume) {
            this(id,org,user,conversation,baseline,count,resume,false);
        }
    }
    public record Proof(String policy, String status, String lastMessageId, String requestId) {}
    /** Evidence of a bounded read, never an execution or replay permit. */
    public record ToolEvidence(String toolCallId, String proofKind, String status, String resultMessageId) {}
    public record WriteEvidence(String toolCallId,String proofKind,String outcome,String proofId,
                                String resultState,String resultMessageId) {}
    public record WriteTurnEvidence(String policy,String requestId,String status,String lastMessageId,boolean resumed) {}
    public List<WriteTurnEvidence> writeTurnEvidence(Long org,String user,Long conversation) {
        try {
            if(TransactionSynchronizationManager.isActualTransactionActive()
                    && !TransactionSynchronizationManager.isCurrentTransactionReadOnly()) throw writeUnavailable();
            return new BaitlyChatWriteTurnEvidence(jdbc).read(org,user,conversation).stream()
                .map(e->new WriteTurnEvidence(e.policy(),e.requestId(),e.status(),e.lastMessageId(),e.resumed())).toList();
        } catch(org.springframework.dao.DataAccessException failure) { throw writeUnavailable(); }
    }

    /** Participate in the mutation transaction. Never open an independent proof transaction. */
    void recordWrite(Ticket ticket,String callId,String kind,Long resource,String targetState) {
      try {
        if(!TransactionSynchronizationManager.isActualTransactionActive()
                || TransactionSynchronizationManager.isCurrentTransactionReadOnly()
                || !TransactionSynchronizationManager.hasResource(jdbc.getDataSource())
                || resource==null || resource<=0) throw writeUnavailable();
        var ids=jdbc.queryForList("""
            SELECT e.id FROM baitly_chat_tool_evidence e JOIN baitly_chat_turns t ON t.id=e.turn_id
                AND t.organization_id=e.organization_id AND t.conversation_id=e.conversation_id
            JOIN assistant_conversation c ON c.id=t.conversation_id AND c.organization_id=t.organization_id
            WHERE e.turn_id=? AND e.organization_id=? AND e.conversation_id=? AND e.tool_call_id=?
                AND e.status='STARTED' AND e.proof_kind='UNVERIFIED' AND t.status='RUNNING'
                AND t.keycloak_user_id=? AND c.keycloak_id=? AND c.archived_at IS NULL FOR UPDATE
            """,UUID.class,ticket.id(),ticket.organizationId(),ticket.conversationId(),callId,ticket.userId(),ticket.userId());
        if(ids.size()!=1) throw writeUnavailable();
        jdbc.update("""
            INSERT INTO baitly_chat_write_business_proofs
                (id,tool_evidence_id,organization_id,conversation_id,proof_kind,resource_id,target_state,committed_at)
            VALUES (?,?,?,?,?,?,?,?)
            """,UUID.randomUUID(),ids.getFirst(),ticket.organizationId(),ticket.conversationId(),kind,resource,targetState,Timestamp.from(Instant.now()));
      } catch(org.springframework.dao.DataAccessException failure) { throw writeUnavailable(); }
    }

    public List<WriteEvidence> writeEvidence(Long org,String user,Long conversation) {
      try {
        if(TransactionSynchronizationManager.isActualTransactionActive()
                && !TransactionSynchronizationManager.isCurrentTransactionReadOnly())
            throw writeUnavailable(); // Never publish a pending local transaction as committed.
        return jdbc.query("""
            SELECT p.id,p.proof_kind,e.tool_call_id,
                (SELECT count(*) FROM assistant_message m WHERE m.organization_id=e.organization_id
                    AND m.conversation_id=e.conversation_id AND m.role='tool' AND m.tool_call_id=e.tool_call_id) AS result_count,
                (SELECT min(m.id) FROM assistant_message m WHERE m.organization_id=e.organization_id
                    AND m.conversation_id=e.conversation_id AND m.role='tool' AND m.tool_call_id=e.tool_call_id) AS result_id
            FROM baitly_chat_write_business_proofs p JOIN baitly_chat_tool_evidence e ON e.id=p.tool_evidence_id
                AND e.organization_id=p.organization_id AND e.conversation_id=p.conversation_id
            JOIN baitly_chat_turns t ON t.id=e.turn_id AND t.organization_id=e.organization_id AND t.conversation_id=e.conversation_id
            JOIN assistant_conversation c ON c.id=t.conversation_id AND c.organization_id=t.organization_id
            WHERE t.organization_id=? AND t.keycloak_user_id=? AND t.conversation_id=?
                AND c.keycloak_id=? AND c.archived_at IS NULL ORDER BY t.turn_sequence,p.committed_at,p.id
            """,(rs,n)->{
                int count=rs.getInt("result_count"); Long id=rs.getObject("result_id",Long.class);
                return new WriteEvidence(rs.getString("tool_call_id"),rs.getString("proof_kind"),"COMMITTED",
                    rs.getObject("id",UUID.class).toString(),count==0?"MISSING":count==1?"RECORDED":"CONFLICT",
                    count==1 && id!=null?"history-"+id:null);
            },org,user,conversation,user);
      } catch(org.springframework.dao.DataAccessException failure) { throw writeUnavailable(); }
    }
    private static IllegalStateException writeUnavailable() { return new IllegalStateException("Baitly write proof unavailable"); }
    private record Receipt(UUID id, UUID requestId, long sequence, String status, Long baselineId,Long endId,int covered,
                           String certificate,Long certificateEnd,Integer certificateCount) {}
    private record Message(Long id, String role, boolean toolCalls, boolean attachments,
                           boolean content, String finishReason,String calls,String callId) {}

    public void startTool(Ticket ticket,String callId,ToolHandler handler) {
      try {
        requireNoOuterTransaction();
        if(callId==null || !callId.matches("[A-Za-z0-9_-]{1,96}")) throw unavailable();
        String kind=proofKind(handler);
        transaction.executeWithoutResult(tx -> {
            requireRunning(ticket);
            Integer recorded=jdbc.queryForObject("""
                SELECT count(*) FROM assistant_message WHERE organization_id=? AND conversation_id=?
                    AND role='tool' AND tool_call_id=?
                """,Integer.class,ticket.organizationId(),ticket.conversationId(),callId);
            if(!Integer.valueOf(0).equals(recorded)) throw unavailable();
            jdbc.update("""
                INSERT INTO baitly_chat_tool_evidence
                (id,turn_id,organization_id,conversation_id,tool_call_id,proof_kind,status,started_at)
                VALUES (?,?,?,?,?,?,'STARTED',?)
                """,UUID.randomUUID(),ticket.id(),ticket.organizationId(),ticket.conversationId(),callId,
                    kind,Timestamp.from(Instant.now()));
        });
      } catch(org.springframework.dao.DataAccessException storageFailure) { throw unavailable(); }
    }

    public void finishTool(Ticket ticket,String callId,Long messageId,boolean error) {
      try {
        requireNoOuterTransaction();
        transaction.executeWithoutResult(tx -> {
            requireRunning(ticket);
            var kinds=jdbc.queryForList("""
                SELECT proof_kind FROM baitly_chat_tool_evidence WHERE turn_id=? AND organization_id=?
                AND conversation_id=? AND tool_call_id=? AND status='STARTED'
                """,String.class,ticket.id(),ticket.organizationId(),ticket.conversationId(),callId);
            if(kinds.size()!=1) throw unavailable();
            Integer results=jdbc.queryForObject("""
                SELECT count(*) FROM assistant_message WHERE organization_id=? AND conversation_id=?
                AND role='tool' AND tool_call_id=?
                """,Integer.class,ticket.organizationId(),ticket.conversationId(),callId);
            Integer matching=jdbc.queryForObject("""
                SELECT count(*) FROM assistant_message WHERE organization_id=? AND conversation_id=?
                AND id=? AND role='tool' AND tool_call_id=? AND content IS NOT NULL AND length(trim(content))>0
                """,Integer.class,ticket.organizationId(),ticket.conversationId(),messageId,callId);
            boolean read=!error && !"UNVERIFIED".equals(kinds.getFirst()) && Integer.valueOf(1).equals(results)
                && Integer.valueOf(1).equals(matching);
            int changed=jdbc.update("""
                UPDATE baitly_chat_tool_evidence SET status=?,result_message_id=?,finished_at=?
                WHERE turn_id=? AND organization_id=? AND conversation_id=? AND tool_call_id=? AND status='STARTED'
                """,read?"READ_ONLY_COMPLETED":"UNCERTAIN",messageId,Timestamp.from(Instant.now()),ticket.id(),
                    ticket.organizationId(),ticket.conversationId(),callId);
            if(changed!=1) throw unavailable();
        });
      } catch(org.springframework.dao.DataAccessException storageFailure) { throw unavailable(); }
    }

    public List<ToolEvidence> toolEvidence(Long org,String user,Long conversation) {
      try {
        // Join the authoritative owner and receipt too: an orphan row proves nothing.
        return jdbc.query("""
            SELECT e.tool_call_id,e.proof_kind,e.status,e.result_message_id,
                (SELECT count(*) FROM assistant_message m WHERE m.organization_id=e.organization_id
                    AND m.conversation_id=e.conversation_id AND m.role='tool' AND m.tool_call_id=e.tool_call_id) AS result_count,
                (SELECT count(*) FROM assistant_message m WHERE m.organization_id=e.organization_id
                    AND m.conversation_id=e.conversation_id AND m.role='tool' AND m.tool_call_id=e.tool_call_id
                    AND m.id=e.result_message_id AND m.content IS NOT NULL AND length(trim(m.content))>0) AS matching
            FROM baitly_chat_tool_evidence e JOIN baitly_chat_turns t ON t.id=e.turn_id
                AND t.organization_id=e.organization_id AND t.conversation_id=e.conversation_id
            JOIN assistant_conversation c ON c.id=t.conversation_id AND c.organization_id=t.organization_id
            WHERE t.organization_id=? AND t.keycloak_user_id=? AND t.conversation_id=?
                AND c.keycloak_id=? AND c.archived_at IS NULL ORDER BY t.turn_sequence,e.started_at,e.id
            """,(rs,n)->{
                String status=rs.getString("status");
                if("READ_ONLY_COMPLETED".equals(status) && (rs.getInt("result_count")!=1 || rs.getInt("matching")!=1
                        || "UNVERIFIED".equals(rs.getString("proof_kind")))) status="UNCERTAIN";
                Long id=rs.getObject("result_message_id",Long.class);
                return new ToolEvidence(rs.getString("tool_call_id"),rs.getString("proof_kind"),status,
                    "READ_ONLY_COMPLETED".equals(status) && id!=null?"history-"+id:null);
            },org,user,conversation,user);
      } catch(org.springframework.dao.DataAccessException storageFailure) { throw unavailable(); }
    }

    private void requireRunning(Ticket ticket) {
        lockOwned(ticket.organizationId(),ticket.userId(),ticket.conversationId());
        Integer count=jdbc.queryForObject("""
            SELECT count(*) FROM baitly_chat_turns WHERE id=? AND organization_id=? AND keycloak_user_id=?
                AND conversation_id=? AND status='RUNNING'
            """,Integer.class,ticket.id(),ticket.organizationId(),ticket.userId(),ticket.conversationId());
        if(!Integer.valueOf(1).equals(count)) throw unavailable();
    }
    private static void requireNoOuterTransaction() {
        if(TransactionSynchronizationManager.isActualTransactionActive()) throw unavailable();
    }
    private static String proofKind(ToolHandler handler) {
        // Explicit implementation review, never trust a model name or requiresConfirmation=false.
        if(handler==null || (handler.getClass()!=com.clenzy.service.agent.tools.SuggestNavigationTool.class
                && handler.getClass()!=com.clenzy.service.agent.tools.ComputeTouristTaxTool.class)) return "UNVERIFIED";
        if(handler.descriptor()==null || handler.descriptor().requiresConfirmation()) return "UNVERIFIED";
        if(handler.getClass()==com.clenzy.service.agent.tools.SuggestNavigationTool.class
                && "suggest_navigation".equals(handler.name()) && handler.name().equals(handler.descriptor().name())) return "NAVIGATION_ONLY_V1";
        if(handler.getClass()==com.clenzy.service.agent.tools.ComputeTouristTaxTool.class
                && "compute_tourist_tax".equals(handler.name()) && handler.name().equals(handler.descriptor().name())) return "TAX_READ_ONLY_V1";
        return "UNVERIFIED";
    }

    public Ticket begin(Long org, String user, Long conversation, UUID request, String pendingId) {
        return begin(org,user,conversation,request,pendingId,false);
    }
    public Ticket begin(Long org, String user, Long conversation, UUID request, String pendingId,boolean toolsPolicy) {
        return transaction.execute(tx -> {
            lockOwned(org,user,conversation);
            var latest=latest(org,user,conversation);
            var history=metadata(org,conversation);
            boolean resume=pendingId!=null;
            if (resume) {
                Integer pending=jdbc.queryForObject("""
                    SELECT count(*) FROM agent_pending_action a WHERE a.organization_id=?
                    AND a.keycloak_user_id=? AND a.conversation_id=? AND a.tool_call_id=?
                    AND a.status='PENDING' AND a.expires_at>?
                    AND NOT EXISTS (SELECT 1 FROM assistant_message m WHERE m.organization_id=a.organization_id
                        AND m.conversation_id=a.conversation_id AND m.role='tool' AND m.tool_call_id=a.tool_call_id)
                    """,Integer.class,org,user,conversation,pendingId,Timestamp.from(Instant.now()));
                if (pending==null || pending!=1 || (latest!=null && (!"PAUSED".equals(latest.status())
                        || !covers(latest,history)))) throw unavailable();
            } else if (latest==null) {
                if (!history.isEmpty() || hasPending(org,conversation)
                        || count("SELECT count(*) FROM agent_run WHERE organization_id=? AND conversation_id=?",org,conversation)>0) {
                    throw unavailable();
                }
            } else if (!safeChain(org,user,conversation,history) || (!toolsPolicy && !textOnly(history))
                    || hasPending(org,conversation)) {
                throw unavailable();
            }
            UUID id=UUID.randomUUID();
            Long baseline=lastId(history);
            jdbc.update("""
                INSERT INTO baitly_chat_turns (id,organization_id,keycloak_user_id,conversation_id,request_id,
                    turn_sequence,status,baseline_message_id,covered_message_count,started_at)
                VALUES (?,?,?,?,?,?,'RUNNING',?,0,?)
                """,id,org,user,conversation,request,latest==null?1:latest.sequence()+1,baseline,Timestamp.from(Instant.now()));
            return new Ticket(id,org,user,conversation,baseline,history.size(),resume,toolsPolicy);
        });
    }

    public void finish(Ticket ticket, BaitlyChatTurnObservation observation) {
        transaction.executeWithoutResult(tx -> {
            lockOwned(ticket.organizationId(),ticket.userId(),ticket.conversationId());
            var history=metadata(ticket.organizationId(),ticket.conversationId());
            var added=history.stream().filter(m -> ticket.baselineId()==null || m.id()>ticket.baselineId()).toList();
            boolean pureText=!ticket.resume() && observation.safeTextCandidate() && added.size()==2
                    && history.size()==ticket.baselineCount()+2
                    && "user".equals(added.get(0).role()) && "assistant".equals(added.get(1).role())
                    && added.stream().noneMatch(m -> m.toolCalls() || m.attachments())
                    && added.stream().allMatch(Message::content)
                    && Objects.equals(observation.assistantMessageId,added.get(1).id())
                    && Objects.equals(observation.finishReason,added.get(1).finishReason())
                    && Objects.equals(lastId(history),observation.assistantMessageId)
                    && !hasPending(ticket.organizationId(),ticket.conversationId());
            boolean paused=observation.paused && !observation.executed && !observation.multiAgent
                    && !observation.error && hasPending(ticket.organizationId(),ticket.conversationId());
            String status=pureText?"SAFE_TEXT":paused?"PAUSED":"UNCERTAIN";
            int changed=jdbc.update("""
                UPDATE baitly_chat_turns SET status=?,end_message_id=?,covered_message_count=?,finished_at=?
                WHERE id=? AND organization_id=? AND keycloak_user_id=? AND conversation_id=? AND status='RUNNING'
                """,status,lastId(history),history.size(),Timestamp.from(Instant.now()),ticket.id(),ticket.organizationId(),
                    ticket.userId(),ticket.conversationId());
            if (changed!=1) throw unavailable();
            new BaitlyChatWriteTurnEvidence(jdbc).record(ticket,observation);
            if(ticket.toolsPolicy() && !ticket.resume() && observation.safeToolsCandidate()
                    && history.size()==ticket.baselineCount()+added.size()
                    && Objects.equals(lastId(history),observation.assistantMessageId)
                    && Objects.equals(history.getLast().finishReason(),observation.finishReason)
                    && !hasPending(ticket.organizationId(),ticket.conversationId())) {
                var covered=toolCoverage(ticket.organizationId(),ticket.conversationId(),ticket.id(),added);
                if(!covered.isEmpty() && covered.equals(observation.executedIds)) {
                    jdbc.update("""
                        INSERT INTO baitly_chat_tool_turn_proofs
                        (turn_id,organization_id,conversation_id,policy,end_message_id,covered_message_count)
                        VALUES (?,?,?,?,?,?)
                        """,ticket.id(),ticket.organizationId(),ticket.conversationId(),TOOLS_POLICY,lastId(history),history.size());
                }
            }
        });
    }

    /** Failure never fabricates a successful end or reopens an admission. */
    public void uncertain(Ticket ticket) {
        transaction.executeWithoutResult(tx -> jdbc.update("""
            UPDATE baitly_chat_turns SET status='UNCERTAIN',finished_at=? WHERE id=? AND organization_id=?
            AND keycloak_user_id=? AND conversation_id=? AND status='RUNNING'
            """,Timestamp.from(Instant.now()),ticket.id(),ticket.organizationId(),ticket.userId(),ticket.conversationId()));
    }

    /** Caller already validated ownership; all queries remain explicitly scoped. */
    public Proof proof(Long org, String user, Long conversation, List<AssistantMessage> history) {
      try {
        var row=latest(org,user,conversation);
        if (row==null) return null;
        Long last=history.stream().map(AssistantMessage::getId).max(Long::compareTo).orElse(null);
        var metadata=metadata(org,conversation);
        boolean matches=row.covered()==history.size() && Objects.equals(row.endId(),last)
                && history.stream().map(AssistantMessage::getId).sorted().toList().equals(metadata.stream().map(Message::id).toList());
        boolean safe=matches && safeChain(org,user,conversation,metadata);
        String status=safe?(textOnly(metadata)?"SAFE_TEXT":"SAFE_TOOLS"):
            ("SAFE_TEXT".equals(row.status()) || row.certificate()!=null)?"UNCERTAIN":row.status();
        String policy=!textOnly(metadata) && safe?TOOLS_POLICY:POLICY;
        return new Proof(policy,status,safe && last!=null?"history-"+last:null,row.requestId().toString());
      } catch(org.springframework.dao.DataAccessException storageFailure) { throw unavailable(); }
    }

    /** Dropping the opt-in field cannot bypass an existing durable fence. */
    public void requireLegacyUntracked(Long org,String user,Long conversation,String pendingId) {
      try {
        Long target=pendingId==null?conversation:pendingConversation(org,user,pendingId);
        if(target!=null && latest(org,user,target)!=null) throw unavailable();
      } catch(org.springframework.dao.DataAccessException storageFailure) { throw unavailable(); }
    }

    public Long pendingConversation(Long org,String user,String pendingId) {
        var rows=jdbc.queryForList("""
            SELECT conversation_id FROM agent_pending_action WHERE organization_id=? AND keycloak_user_id=? AND tool_call_id=?
            """,Long.class,org,user,pendingId);
        if(rows.size()!=1 || rows.getFirst()==null) throw unavailable();
        return rows.getFirst();
    }

    private void lockOwned(Long org, String user, Long conversation) {
        var ids=jdbc.queryForList("""
            SELECT id FROM assistant_conversation WHERE id=? AND organization_id=? AND keycloak_id=?
                AND archived_at IS NULL FOR UPDATE
            """,Long.class,conversation,org,user);
        if (ids.size()!=1) throw new AccessDeniedException("Baitly conversation unavailable");
    }
    private Receipt latest(Long org,String user,Long conversation) {
        var rows=receipts(org,user,conversation);
        return rows.isEmpty()?null:rows.getLast();
    }
    private List<Receipt> receipts(Long org,String user,Long conversation) {
        var rows=jdbc.query("""
            SELECT t.id,t.request_id,t.turn_sequence,t.status,t.baseline_message_id,t.end_message_id,t.covered_message_count,
                p.policy,p.end_message_id AS proof_end,p.covered_message_count AS proof_count
            FROM baitly_chat_turns t LEFT JOIN baitly_chat_tool_turn_proofs p ON p.turn_id=t.id
                AND p.organization_id=t.organization_id AND p.conversation_id=t.conversation_id
            WHERE t.organization_id=? AND t.keycloak_user_id=? AND t.conversation_id=? ORDER BY t.turn_sequence
            """,(rs,n)->new Receipt(rs.getObject("id",UUID.class),rs.getObject("request_id",UUID.class),rs.getLong("turn_sequence"),rs.getString("status"),
                rs.getObject("baseline_message_id",Long.class),rs.getObject("end_message_id",Long.class),rs.getInt("covered_message_count"),
                rs.getString("policy"),rs.getObject("proof_end",Long.class),rs.getObject("proof_count",Integer.class)),org,user,conversation);
        return rows;
    }
    private boolean safeChain(Long org,String user,Long conversation,List<Message> history) {
        var receipts=receipts(org,user,conversation);
        int count=0; long sequence=0; Long end=null;
        for(var receipt:receipts) {
            if(receipt.sequence()!=++sequence || !Objects.equals(end,receipt.baselineId())
                    || receipt.covered()<=count || receipt.covered()>history.size()) return false;
            var segment=history.subList(count,receipt.covered());
            if(!Objects.equals(receipt.endId(),lastId(segment))) return false;
            if(receipt.certificate()==null) {
                if(!"SAFE_TEXT".equals(receipt.status()) || !safeTextSegment(segment)
                        || !reads(org,conversation,receipt.id()).isEmpty()) return false;
            } else if(!"UNCERTAIN".equals(receipt.status()) || !TOOLS_POLICY.equals(receipt.certificate())
                    || !Objects.equals(receipt.endId(),receipt.certificateEnd())
                    || !Objects.equals(receipt.covered(),receipt.certificateCount())
                    || toolCoverage(org,conversation,receipt.id(),segment).isEmpty()) return false;
            count=receipt.covered(); end=receipt.endId();
        }
        return !receipts.isEmpty() && count==history.size();
    }
    private static boolean safeTextSegment(List<Message> messages) {
        return messages.size()==2 && textOnly(messages) && messages.stream().allMatch(m->m.content() && m.callId()==null)
            && "user".equals(messages.getFirst().role()) && "assistant".equals(messages.getLast().role())
            && java.util.Set.of("stop","end_turn").contains(Objects.toString(messages.getLast().finishReason(),""));
    }
    private java.util.Set<String> toolCoverage(Long org,Long conversation,UUID turn,List<Message> messages) {
        return BaitlyChatTurnCoverage.prove(messages.stream().map(m->new BaitlyChatTurnCoverage.Frame(
            m.id(),m.role(),m.calls(),m.callId(),m.attachments(),m.content(),m.finishReason())).toList(),reads(org,conversation,turn));
    }
    private List<BaitlyChatTurnCoverage.Read> reads(Long org,Long conversation,UUID turn) {
        return jdbc.query("""
            SELECT tool_call_id,proof_kind,status,result_message_id FROM baitly_chat_tool_evidence
            WHERE organization_id=? AND conversation_id=? AND turn_id=?
            """,(rs,n)->new BaitlyChatTurnCoverage.Read(rs.getString("tool_call_id"),rs.getString("proof_kind"),
                rs.getString("status"),rs.getObject("result_message_id",Long.class)),org,conversation,turn);
    }
    private List<Message> metadata(Long org,Long conversation) {
        return jdbc.query("""
            SELECT id,role,CAST(tool_calls AS VARCHAR) AS calls,CAST(attachments AS VARCHAR) AS files,
                CASE WHEN content IS NULL OR length(trim(content))=0 THEN FALSE ELSE TRUE END AS has_content,finish_reason,tool_call_id
            FROM assistant_message WHERE organization_id=? AND conversation_id=? ORDER BY id
            """,(rs,n)->new Message(rs.getLong("id"),rs.getString("role"),present(rs.getString("calls")),
                present(rs.getString("files")),rs.getBoolean("has_content"),rs.getString("finish_reason"),rs.getString("calls"),rs.getString("tool_call_id")),org,conversation);
    }
    private static boolean present(String json) { return json!=null && !json.isBlank() && !"[]".equals(json) && !"null".equals(json); }
    private static Long lastId(List<Message> history) { return history.isEmpty()?null:history.getLast().id(); }
    private static boolean covers(Receipt receipt,List<Message> history) {
        return receipt.covered()==history.size() && Objects.equals(receipt.endId(),lastId(history));
    }
    private static boolean textOnly(List<Message> history) {
        return history.stream().allMatch(m -> ("user".equals(m.role()) || "assistant".equals(m.role()))
                && !m.toolCalls() && !m.attachments());
    }
    private int count(String query,Long org,Long conversation) { return jdbc.queryForObject(query,Integer.class,org,conversation); }
    private boolean hasPending(Long org,Long conversation) {
        return count("SELECT count(*) FROM agent_pending_action WHERE organization_id=? AND conversation_id=?",org,conversation)>0;
    }
    private static IllegalStateException unavailable() { return new IllegalStateException("Baitly chat completion unavailable"); }
}
