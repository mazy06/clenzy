package com.clenzy.service.agent;

import org.springframework.jdbc.core.JdbcTemplate;
import com.fasterxml.jackson.databind.*;
import java.util.*;
import java.time.Instant;

/** V3 admission proofs. Only durable facts, never execution, retries or inferred provider success. */
final class BaitlyChatContinuations {
    private static final ObjectMapper JSON=new ObjectMapper();
    private final JdbcTemplate jdbc;
    private record Frame(Long id,String role,String calls,String call,boolean content,boolean files,String reason) {}
    private record Decision(String call,String name,String args,String status,Instant resolved,Instant expires,boolean multi,String user) {}
    private record Invocation(String call,String kind,String status,Long result,String write,Instant started,String read) {}
    private record Receipt(UUID id,String status,Long baseline,Long end,int count,long sequence,String certificate,Long certEnd,Integer certCount) {}
    BaitlyChatContinuations(JdbcTemplate jdbc) { this.jdbc=jdbc; }
    boolean awaiting(Long org,String user,Long conversation,String id) {
        return decisions(org,conversation).stream().anyMatch(d->id.equals(d.call()) && user.equals(d.user())
            && "PENDING".equals(d.status()) && !d.multi() && d.expires()!=null && d.expires().isAfter(Instant.now()));
    }
    void decline(BaitlyChatCompletionJournal.Ticket ticket,String call,Long result) {
        var decisions=decisions(ticket.organizationId(),ticket.conversationId()).stream()
            .filter(d->call.equals(d.call()) && ticket.userId().equals(d.user()) && "REFUSED".equals(d.status()) && d.resolved()!=null && !d.multi()).toList();
        int effects=jdbc.queryForObject("SELECT count(*) FROM baitly_chat_tool_evidence WHERE organization_id=? AND conversation_id=? AND tool_call_id=?",
            Integer.class,ticket.organizationId(),ticket.conversationId(),call);
        int results=jdbc.queryForObject("""
            SELECT count(*) FROM assistant_message WHERE organization_id=? AND conversation_id=? AND role='tool'
                AND tool_call_id=? AND id=? AND content IS NOT NULL AND length(trim(content))>0
            """,Integer.class,ticket.organizationId(),ticket.conversationId(),call,result);
        if(decisions.size()!=1 || effects!=0 || results!=1) throw unavailable();
        jdbc.update("""
            INSERT INTO baitly_chat_declined_results (id,turn_id,organization_id,conversation_id,tool_call_id,result_message_id)
            VALUES (?,?,?,?,?,?)
            """,UUID.randomUUID(),ticket.id(),ticket.organizationId(),ticket.conversationId(),call,result);
    }
    void record(BaitlyChatCompletionJournal.Ticket ticket,BaitlyChatTurnObservation observation) {
        boolean pause=observation.paused;
        if(!observation.continuationCandidate(pause)) return;
        String state=pause?"PAUSED":"COMPLETE";
        if(!validate(ticket.organizationId(),ticket.userId(),ticket.conversationId(),ticket.id(),state)) return;
        var frames=frames(ticket.organizationId(),ticket.conversationId());
        if(!pause && (!Objects.equals(observation.assistantMessageId,frames.getLast().id())
            || !Objects.equals(observation.finishReason,frames.getLast().reason()))) return;
        // Every effect in this receipt must have been observed once, including explicit refusals.
        var ids=jdbc.queryForList("""
            SELECT tool_call_id FROM baitly_chat_tool_evidence WHERE turn_id=? AND organization_id=? AND conversation_id=?
            UNION ALL SELECT tool_call_id FROM baitly_chat_declined_results WHERE turn_id=? AND organization_id=? AND conversation_id=?
            """,String.class,ticket.id(),ticket.organizationId(),ticket.conversationId(),ticket.id(),ticket.organizationId(),ticket.conversationId());
        if(ids.size()!=observation.executedIds.size() || !new HashSet<>(ids).equals(observation.executedIds)) return;
        jdbc.update("""
            INSERT INTO baitly_chat_continuations (turn_id,organization_id,conversation_id,state,end_message_id,covered_message_count)
            VALUES (?,?,?,?,?,?)
            """,ticket.id(),ticket.organizationId(),ticket.conversationId(),state,frames.getLast().id(),frames.size());
    }
    String state(Long org,String user,Long conversation) {
        int certificates=jdbc.queryForObject("""
            SELECT count(*) FROM baitly_chat_continuations p JOIN assistant_conversation c ON c.id=p.conversation_id
                AND c.organization_id=p.organization_id WHERE p.organization_id=? AND p.conversation_id=?
                AND c.keycloak_id=? AND c.archived_at IS NULL
            """,Integer.class,org,conversation,user);
        if(certificates==0) return null;
        return validate(org,user,conversation,null,null)?latestState(org,conversation):"UNCERTAIN";
    }
    private String latestState(Long org,Long conversation) {
        var states=jdbc.queryForList("""
            SELECT p.state FROM baitly_chat_turns t LEFT JOIN baitly_chat_continuations p ON p.turn_id=t.id
                AND p.organization_id=t.organization_id AND p.conversation_id=t.conversation_id
            WHERE t.organization_id=? AND t.conversation_id=? ORDER BY t.turn_sequence DESC
            """,String.class,org,conversation);
        return states.isEmpty()?null:states.getFirst();
    }
    private boolean validate(Long org,String user,Long conversation,UUID proposed,String proposedState) {
        try {
            var frames=frames(org,conversation);
            var receipts=jdbc.query("""
                SELECT t.id,t.status,t.baseline_message_id,t.end_message_id,t.covered_message_count,t.turn_sequence,
                    p.state,p.end_message_id AS cert_end,p.covered_message_count AS cert_count
                FROM baitly_chat_turns t JOIN assistant_conversation c ON c.id=t.conversation_id AND c.organization_id=t.organization_id
                LEFT JOIN baitly_chat_continuations p ON p.turn_id=t.id AND p.organization_id=t.organization_id AND p.conversation_id=t.conversation_id
                WHERE t.organization_id=? AND t.conversation_id=? AND t.keycloak_user_id=? AND c.keycloak_id=?
                    AND c.archived_at IS NULL ORDER BY t.turn_sequence
                """,(rs,n)->new Receipt(rs.getObject("id",UUID.class),rs.getString("status"),rs.getObject("baseline_message_id",Long.class),
                    rs.getObject("end_message_id",Long.class),rs.getInt("covered_message_count"),rs.getLong("turn_sequence"),rs.getString("state"),
                    rs.getObject("cert_end",Long.class),rs.getObject("cert_count",Integer.class)),org,conversation,user,user);
            if(receipts.isEmpty() || frames.isEmpty()) return false;
            int count=0; Long end=null; long sequence=0; String state=null;
            for(var row:receipts) {
                boolean current=row.id().equals(proposed) && row==receipts.getLast();
                state=current?proposedState:row.certificate();
                if(state==null || row.sequence()!=++sequence || !Objects.equals(row.baseline(),end) || row.count()<=count
                    || row.count()>frames.size() || !Objects.equals(row.end(),frames.get(row.count()-1).id())
                    || !Set.of("SAFE_TEXT","UNCERTAIN","PAUSED").contains(row.status())
                    || (!current && (!Objects.equals(row.end(),row.certEnd()) || !Objects.equals(row.count(),row.certCount())))) return false;
                count=row.count(); end=row.end();
            }
            if(count!=frames.size()) return false;
            Map<String,Decision> decisions=new HashMap<>();
            for(var d:decisions(org,conversation)) if(!user.equals(d.user()) || d.multi() || decisions.put(d.call(),d)!=null) return false;
            Map<String,Invocation> invocations=new HashMap<>();
            for(var e:jdbc.query("""
                SELECT e.tool_call_id,e.proof_kind,e.status,e.result_message_id,e.started_at,p.proof_kind AS write_kind,r.tool_name AS read_name
                FROM baitly_chat_tool_evidence e JOIN baitly_chat_turns t ON t.id=e.turn_id AND t.organization_id=e.organization_id
                    AND t.conversation_id=e.conversation_id LEFT JOIN baitly_chat_write_business_proofs p ON p.tool_evidence_id=e.id
                    AND p.organization_id=e.organization_id AND p.conversation_id=e.conversation_id
                LEFT JOIN baitly_chat_read_bindings r ON r.tool_evidence_id=e.id AND r.organization_id=e.organization_id AND r.conversation_id=e.conversation_id
                WHERE e.organization_id=? AND e.conversation_id=? AND t.keycloak_user_id=?
                """,(rs,n)->new Invocation(rs.getString("tool_call_id"),rs.getString("proof_kind"),rs.getString("status"),
                    rs.getObject("result_message_id",Long.class),rs.getString("write_kind"),rs.getTimestamp("started_at").toInstant(),rs.getString("read_name")),org,conversation,user))
                if(invocations.put(e.call(),e)!=null) return false;
            Map<String,Long> declined=new HashMap<>();
            jdbc.query("""
                SELECT d.tool_call_id,d.result_message_id FROM baitly_chat_declined_results d JOIN baitly_chat_turns t
                    ON t.id=d.turn_id AND t.organization_id=d.organization_id AND t.conversation_id=d.conversation_id
                WHERE d.organization_id=? AND d.conversation_id=? AND t.keycloak_user_id=?
                """,rs->{declined.put(rs.getString("tool_call_id"),rs.getLong("result_message_id"));},org,conversation,user);
            if(invocations.size()!=jdbc.queryForObject("SELECT count(*) FROM baitly_chat_tool_evidence WHERE organization_id=? AND conversation_id=?",Integer.class,org,conversation)
                || declined.size()!=jdbc.queryForObject("SELECT count(*) FROM baitly_chat_declined_results WHERE organization_id=? AND conversation_id=?",Integer.class,org,conversation)
                || invocations.values().stream().filter(e->e.write()!=null).count()!=jdbc.queryForObject("SELECT count(*) FROM baitly_chat_write_business_proofs WHERE organization_id=? AND conversation_id=?",Integer.class,org,conversation)) return false;
            var covered=new HashSet<String>(); var callsSeen=new HashSet<String>(); var decisionsSeen=new HashSet<String>();
            int i=0; boolean paused=false;
            while(i<frames.size()) {
                var first=frames.get(i++);
                if(!"user".equals(first.role()) || !first.content() || first.files() || present(first.calls()) || first.call()!=null) return false;
                boolean finalAnswer=false;
                while(i<frames.size()) {
                    var assistant=frames.get(i++);
                    if(!"assistant".equals(assistant.role()) || assistant.files() || assistant.call()!=null) return false;
                    if(!present(assistant.calls())) {
                        if(!assistant.content() || !Set.of("stop","end_turn").contains(Objects.toString(assistant.reason(),""))) return false;
                        finalAnswer=true; break;
                    }
                    if(!Set.of("tool_use","tool_calls").contains(Objects.toString(assistant.reason(),""))) return false;
                    var requests=JSON.readTree(assistant.calls());
                    if(!requests.isArray() || requests.isEmpty() || requests.size()>64) return false;
                    var batch=new LinkedHashMap<String,JsonNode>();
                    for(var request:requests) {
                        String call=request.path("id").asText("");
                        if(!call.matches("[A-Za-z0-9_-]{1,96}") || !request.path("name").isTextual() || !callsSeen.add(call)) return false;
                        batch.put(call,request);
                    }
                    while(i<frames.size() && "tool".equals(frames.get(i).role())) {
                        var result=frames.get(i++); var request=batch.remove(result.call());
                        if(request==null || !result.content() || result.files() || present(result.calls()) || !covered.add(result.call())) return false;
                        var d=decisions.get(result.call()); var e=invocations.get(result.call());
                        if(d!=null) {
                            decisionsSeen.add(d.call());
                            if(d.resolved()==null || !sameRequest(request,d)) return false;
                            if("REFUSED".equals(d.status())) {
                                if(e!=null || !Objects.equals(declined.get(d.call()),result.id())) return false;
                                continue;
                            }
                            if(!"CONFIRMED".equals(d.status()) || e==null || d.resolved().isAfter(e.started())) return false;
                        }
                        if(e==null || !result.id().equals(e.result())) return false;
                        String kind=switch(request.path("name").asText()) {
                            case "suggest_navigation" -> "NAVIGATION_ONLY_V1";
                            case "compute_tourist_tax" -> "TAX_READ_ONLY_V1";
                            case "update_property_status" -> "PROPERTY_STATUS_V1";
                            case "forget_fact" -> "MEMORY_DELETE_V1";
                            default -> "UNVERIFIED";
                        };
                        if("UNVERIFIED".equals(kind)) {
                            if(!request.path("name").asText().equals(e.read()) || e.write()!=null || !"UNCERTAIN".equals(e.status())) return false;
                            continue;
                        }
                        if(kind.endsWith("STATUS_V1") || "MEMORY_DELETE_V1".equals(kind)) {
                            if(d==null || !kind.equals(e.write()) || !"UNVERIFIED".equals(e.kind()) || !"UNCERTAIN".equals(e.status())) return false;
                        } else if(!kind.equals(e.kind()) || !"READ_ONLY_COMPLETED".equals(e.status())) return false;
                    }
                    if(!batch.isEmpty()) {
                        if(i!=frames.size() || !"PAUSED".equals(state)) return false;
                        for(var request:batch.entrySet()) {
                            var d=decisions.get(request.getKey());
                            if(d==null || !"PENDING".equals(d.status()) || !sameRequest(request.getValue(),d)
                                || d.expires()==null || !d.expires().isAfter(Instant.now()) || invocations.containsKey(d.call()) || declined.containsKey(d.call())) return false;
                            decisionsSeen.add(d.call());
                        }
                        paused=true; break;
                    }
                }
                if(!finalAnswer && !paused) return false;
            }
            var effects=new HashSet<>(invocations.keySet()); effects.addAll(declined.keySet());
            return covered.equals(effects) && decisionsSeen.equals(decisions.keySet()) && paused=="PAUSED".equals(state);
        } catch(com.fasterxml.jackson.core.JsonProcessingException malformed) { return false; }
    }
    private List<Decision> decisions(Long org,Long conversation) {
        return jdbc.query("""
            SELECT tool_call_id,tool_name,args_json,status,resolved_at,expires_at,multi_agent,keycloak_user_id
            FROM agent_pending_action WHERE organization_id=? AND conversation_id=?
            """,(rs,n)->new Decision(rs.getString("tool_call_id"),rs.getString("tool_name"),rs.getString("args_json"),rs.getString("status"),
                rs.getTimestamp("resolved_at")==null?null:rs.getTimestamp("resolved_at").toInstant(),
                rs.getTimestamp("expires_at")==null?null:rs.getTimestamp("expires_at").toInstant(),rs.getBoolean("multi_agent"),rs.getString("keycloak_user_id")),org,conversation);
    }
    private List<Frame> frames(Long org,Long conversation) {
        return jdbc.query("""
            SELECT id,role,CAST(tool_calls AS VARCHAR) AS calls,tool_call_id,CAST(attachments AS VARCHAR) AS files,
                CASE WHEN content IS NULL OR length(trim(content))=0 THEN FALSE ELSE TRUE END AS has_content,finish_reason
            FROM assistant_message WHERE organization_id=? AND conversation_id=? ORDER BY id
            """,(rs,n)->new Frame(rs.getLong("id"),rs.getString("role"),rs.getString("calls"),rs.getString("tool_call_id"),
                rs.getBoolean("has_content"),present(rs.getString("files")),rs.getString("finish_reason")),org,conversation);
    }
    private static boolean sameRequest(JsonNode request,Decision d) throws com.fasterxml.jackson.core.JsonProcessingException {
        if(!Objects.equals(d.name(),request.path("name").asText()) || d.args()==null || !request.path("arguments").isTextual()) return false;
        var args=JSON.readTree(d.args()); return args!=null && args.isObject() && args.equals(JSON.readTree(request.path("arguments").textValue()));
    }
    private static boolean present(String value) { return value!=null && !value.isBlank() && !"[]".equals(value) && !"null".equals(value); }
    private static IllegalStateException unavailable() { return new IllegalStateException("Baitly chat completion unavailable"); }
}
