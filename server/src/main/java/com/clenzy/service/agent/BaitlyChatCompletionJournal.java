package com.clenzy.service.agent;

import com.clenzy.model.AssistantMessage;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/** Short, committed transactions only. Provider work never runs in this service. */
@Service
public class BaitlyChatCompletionJournal {
    public static final String POLICY = "durable-text-v1";
    private final JdbcTemplate jdbc;
    private final TransactionTemplate transaction;
    public BaitlyChatCompletionJournal(JdbcTemplate jdbc, PlatformTransactionManager manager) {
        this.jdbc=jdbc;
        transaction=new TransactionTemplate(manager);
        transaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }
    public record Ticket(UUID id, Long organizationId, String userId, Long conversationId,
                         Long baselineId, int baselineCount, boolean resume) {}
    public record Proof(String policy, String status, String lastMessageId, String requestId) {}
    /** Evidence of a bounded read, never an execution or replay permit. */
    public record ToolEvidence(String toolCallId, String proofKind, String status, String resultMessageId) {}
    private record Receipt(UUID id, UUID requestId, long sequence, String status, Long endId, int covered) {}
    private record Message(Long id, String role, boolean toolCalls, boolean attachments,
                           boolean content, String finishReason) {}

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
        if(org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive()) throw unavailable();
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
            } else if (!"SAFE_TEXT".equals(latest.status()) || !covers(latest,history)
                    || !textOnly(history) || hasPending(org,conversation)) {
                throw unavailable();
            }
            UUID id=UUID.randomUUID();
            Long baseline=lastId(history);
            jdbc.update("""
                INSERT INTO baitly_chat_turns (id,organization_id,keycloak_user_id,conversation_id,request_id,
                    turn_sequence,status,baseline_message_id,covered_message_count,started_at)
                VALUES (?,?,?,?,?,?,'RUNNING',?,0,?)
                """,id,org,user,conversation,request,latest==null?1:latest.sequence()+1,baseline,Timestamp.from(Instant.now()));
            return new Ticket(id,org,user,conversation,baseline,history.size(),resume);
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
        boolean matches=row.covered()==history.size() && Objects.equals(row.endId(),last);
        boolean textOnly=history.stream().allMatch(m -> ("user".equals(m.getRole()) || "assistant".equals(m.getRole()))
                && !present(m.getToolCalls()) && !present(m.getAttachments()));
        String status="SAFE_TEXT".equals(row.status()) && (!matches || !textOnly)?"UNCERTAIN":row.status();
        return new Proof(POLICY,status,"SAFE_TEXT".equals(status) && last!=null?"history-"+last:null,row.requestId().toString());
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
        var rows=jdbc.query("""
            SELECT id,request_id,turn_sequence,status,end_message_id,covered_message_count FROM baitly_chat_turns
            WHERE organization_id=? AND keycloak_user_id=? AND conversation_id=? ORDER BY turn_sequence DESC LIMIT 1
            """,(rs,n)->new Receipt(rs.getObject("id",UUID.class),rs.getObject("request_id",UUID.class),rs.getLong("turn_sequence"),rs.getString("status"),
                rs.getObject("end_message_id",Long.class),rs.getInt("covered_message_count")),org,user,conversation);
        return rows.isEmpty()?null:rows.getFirst();
    }
    private List<Message> metadata(Long org,Long conversation) {
        return jdbc.query("""
            SELECT id,role,CAST(tool_calls AS VARCHAR) AS calls,CAST(attachments AS VARCHAR) AS files,
                CASE WHEN content IS NULL OR length(trim(content))=0 THEN FALSE ELSE TRUE END AS has_content,finish_reason
            FROM assistant_message WHERE organization_id=? AND conversation_id=? ORDER BY id
            """,(rs,n)->new Message(rs.getLong("id"),rs.getString("role"),present(rs.getString("calls")),
                present(rs.getString("files")),rs.getBoolean("has_content"),rs.getString("finish_reason")),org,conversation);
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
