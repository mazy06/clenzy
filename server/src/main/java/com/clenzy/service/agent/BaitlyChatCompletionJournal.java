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
    private record Receipt(UUID id, UUID requestId, long sequence, String status, Long endId, int covered) {}
    private record Message(Long id, String role, boolean toolCalls, boolean attachments,
                           boolean content, String finishReason) {}

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
      } catch(org.springframework.dao.DataAccessException error) { throw unavailable(); }
    }

    /** Dropping the opt-in field cannot bypass an existing durable fence. */
    public void requireLegacyUntracked(Long org,String user,Long conversation,String pendingId) {
      try {
        Long target=pendingId==null?conversation:pendingConversation(org,user,pendingId);
        if(target!=null && latest(org,user,target)!=null) throw unavailable();
      } catch(org.springframework.dao.DataAccessException error) { throw unavailable(); }
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
