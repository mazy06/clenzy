package com.clenzy.service.agent;

import org.springframework.jdbc.core.JdbcTemplate;
import java.util.*;

/** Complete, revalidated evidence only. Does not change admission or execute anything. */
final class BaitlyChatWriteTurnEvidence {
    private static final com.fasterxml.jackson.databind.ObjectMapper JSON=new com.fasterxml.jackson.databind.ObjectMapper();
    static final String POLICY="write-turn-evidence-v1";
    record Evidence(String policy,String requestId,String status,String lastMessageId,boolean resumed) {}
    private record Turn(UUID id,long sequence,String status,Long baseline,Long end,int count) {}
    private record Coverage(UUID root,Long end,int count,Set<String> calls,boolean resumed,String reason) {}
    private record Certificate(UUID turn,UUID root,Long end,int count,String policy,UUID request) {}
    private final JdbcTemplate jdbc;
    BaitlyChatWriteTurnEvidence(JdbcTemplate jdbc) { this.jdbc=jdbc; }

    void record(BaitlyChatCompletionJournal.Ticket ticket,BaitlyChatTurnObservation observation) {
        if(!ticket.toolsPolicy() || !observation.safeToolsCandidate()) return;
        var proof=coverage(ticket.organizationId(),ticket.userId(),ticket.conversationId(),ticket.id(),ticket.resume());
        if(proof==null || !proof.calls().equals(observation.executedIds)
                || !Objects.equals(proof.end(),observation.assistantMessageId)
                || !Objects.equals(proof.reason(),observation.finishReason)) return;
        jdbc.update("""
            INSERT INTO baitly_chat_complete_write_turns
            (turn_id,organization_id,conversation_id,root_turn_id,end_message_id,covered_message_count,policy)
            VALUES (?,?,?,?,?,?,?)
            """,ticket.id(),ticket.organizationId(),ticket.conversationId(),proof.root(),proof.end(),proof.count(),POLICY);
    }

    List<Evidence> read(Long org,String user,Long conversation) {
        var rows=jdbc.query("""
            SELECT p.turn_id,p.root_turn_id,p.end_message_id,p.covered_message_count,p.policy,t.request_id
            FROM baitly_chat_complete_write_turns p JOIN baitly_chat_turns t
                ON t.id=p.turn_id AND t.organization_id=p.organization_id AND t.conversation_id=p.conversation_id
            JOIN assistant_conversation c ON c.id=t.conversation_id AND c.organization_id=t.organization_id
            WHERE t.organization_id=? AND t.keycloak_user_id=? AND t.conversation_id=?
                AND c.keycloak_id=? AND c.archived_at IS NULL ORDER BY t.turn_sequence
            """,(rs,n)->new Certificate(rs.getObject("turn_id",UUID.class),rs.getObject("root_turn_id",UUID.class),
                rs.getLong("end_message_id"),rs.getInt("covered_message_count"),rs.getString("policy"),rs.getObject("request_id",UUID.class)),
            org,user,conversation,user);
        var result=new ArrayList<Evidence>();
        for(var row:rows) {
            boolean resumed=!row.turn().equals(row.root());
            var proof=coverage(org,user,conversation,row.turn(),resumed);
            boolean valid=proof!=null && POLICY.equals(row.policy()) && proof.root().equals(row.root())
                && proof.end().equals(row.end()) && proof.count()==row.count();
            result.add(new Evidence(POLICY,row.request().toString(),valid?"TURN_PROVEN":"UNCERTAIN",
                valid?"history-"+proof.end():null,resumed));
        }
        return List.copyOf(result);
    }

    private Coverage coverage(Long org,String user,Long conversation,UUID id,boolean resumed) {
        var turns=jdbc.query("""
            SELECT id,turn_sequence,status,baseline_message_id,end_message_id,covered_message_count
            FROM baitly_chat_turns WHERE organization_id=? AND keycloak_user_id=? AND conversation_id=? ORDER BY turn_sequence
            """,(rs,n)->new Turn(rs.getObject("id",UUID.class),rs.getLong("turn_sequence"),rs.getString("status"),
                rs.getObject("baseline_message_id",Long.class),rs.getObject("end_message_id",Long.class),rs.getInt("covered_message_count")),org,user,conversation);
        int position=-1;
        for(int i=0;i<turns.size();i++) if(turns.get(i).id().equals(id)) position=i;
        if(position<0) return null;
        var end=turns.get(position); var root=end;
        if(!"UNCERTAIN".equals(end.status()) || end.end()==null) return null;
        if(resumed) {
            if(position==0) return null;
            root=turns.get(position-1);
            if(!"PAUSED".equals(root.status()) || root.sequence()+1!=end.sequence()
                    || !Objects.equals(root.end(),end.baseline()) || root.count()>=end.count()
                    || count("SELECT count(*) FROM baitly_chat_tool_evidence WHERE organization_id=? AND conversation_id=? AND turn_id=?",org,conversation,root.id())!=0) return null;
        }
        var frames=jdbc.query("""
            SELECT id,role,CAST(tool_calls AS VARCHAR) AS calls,tool_call_id,CAST(attachments AS VARCHAR) AS files,
                CASE WHEN content IS NULL OR length(trim(content))=0 THEN FALSE ELSE TRUE END AS has_content,finish_reason
            FROM assistant_message WHERE organization_id=? AND conversation_id=? ORDER BY id
            """,(rs,n)->new BaitlyChatTurnCoverage.Frame(rs.getLong("id"),rs.getString("role"),rs.getString("calls"),
                rs.getString("tool_call_id"),present(rs.getString("files")),rs.getBoolean("has_content"),rs.getString("finish_reason")),org,conversation);
        if(end.count()>frames.size() || end.count()<4 || !end.end().equals(frames.get(end.count()-1).id())) return null;
        int start=0;
        if(root.baseline()!=null) {
            while(start<frames.size() && !root.baseline().equals(frames.get(start).id())) start++;
            if(start==frames.size()) return null;
            start++;
        }
        if(start>=end.count() || (resumed && (root.count()!=start+2 || !root.end().equals(frames.get(root.count()-1).id())))) return null;
        var evidence=jdbc.query("""
            SELECT e.tool_call_id,e.proof_kind,e.status,e.result_message_id,p.proof_kind AS write_kind,
                (SELECT count(*) FROM assistant_message m WHERE m.organization_id=e.organization_id
                    AND m.conversation_id=e.conversation_id AND m.role='tool' AND m.tool_call_id=e.tool_call_id) AS results
            FROM baitly_chat_tool_evidence e LEFT JOIN baitly_chat_write_business_proofs p
                ON p.tool_evidence_id=e.id AND p.organization_id=e.organization_id AND p.conversation_id=e.conversation_id
            WHERE e.organization_id=? AND e.conversation_id=? AND e.turn_id=? AND e.finished_at IS NOT NULL
            """,(rs,n)->{
                String kind=rs.getString("proof_kind"),status=rs.getString("status"),write=rs.getString("write_kind");
                if(write!=null && "UNVERIFIED".equals(kind) && "UNCERTAIN".equals(status)) {
                    kind=write; status="READ_ONLY_COMPLETED"; // Local normalization for structural validation only.
                }
                if(rs.getInt("results")!=1) status="UNCERTAIN";
                return new BaitlyChatTurnCoverage.Read(rs.getString("tool_call_id"),kind,status,rs.getObject("result_message_id",Long.class));
            },org,conversation,id);
        // No STARTED/orphan evidence may disappear from coverage through the finished filter.
        if(evidence.size()!=count("SELECT count(*) FROM baitly_chat_tool_evidence WHERE organization_id=? AND conversation_id=? AND turn_id=?",org,conversation,id)) return null;
        var calls=BaitlyChatTurnCoverage.proveWrites(frames.subList(start,end.count()),evidence);
        var writes=evidence.stream().filter(e->Set.of("PROPERTY_STATUS_V1","MEMORY_DELETE_V1").contains(e.kind())).toList();
        if(calls.isEmpty() || writes.isEmpty()) return null;
        // Require durable confirmation before dispatch; preserve every decision row for audit.
        for(var write:writes) {
            String name="PROPERTY_STATUS_V1".equals(write.kind())?"update_property_status":"forget_fact";
            if(count("""
                SELECT count(*) FROM agent_pending_action a JOIN baitly_chat_tool_evidence e
                    ON e.organization_id=a.organization_id AND e.conversation_id=a.conversation_id AND e.tool_call_id=a.tool_call_id
                WHERE a.organization_id=? AND a.conversation_id=? AND a.keycloak_user_id=? AND a.tool_call_id=?
                    AND a.tool_name=? AND a.status='CONFIRMED' AND a.multi_agent=FALSE
                    AND a.resolved_at IS NOT NULL AND a.resolved_at<=e.started_at AND e.turn_id=?
                """,org,conversation,user,write.callId(),name,id)!=1) return null;
            var arguments=jdbc.queryForList("""
                SELECT args_json FROM agent_pending_action WHERE organization_id=? AND conversation_id=?
                    AND keycloak_user_id=? AND tool_call_id=?
                """,String.class,org,conversation,user,write.callId());
            if(arguments.size()!=1 || !sameArguments(frames.subList(start,end.count()),write.callId(),arguments.getFirst())) return null;
        }
        // Any unresolved/foreign/unsupported decision in this conversation still blocks certification.
        var decisions=jdbc.queryForList("SELECT tool_call_id FROM agent_pending_action WHERE organization_id=? AND conversation_id=?",String.class,org,conversation);
        if(decisions.size()!=writes.size() || !new HashSet<>(decisions).equals(writes.stream().map(BaitlyChatTurnCoverage.Read::callId).collect(java.util.stream.Collectors.toSet()))) return null;
        return new Coverage(root.id(),end.end(),end.count(),calls,resumed,frames.get(end.count()-1).reason());
    }
    private int count(String sql,Object... args) { return jdbc.queryForObject(sql,Integer.class,args); }
    /** Compare existing payloads transiently; never copy arguments or hashes into public evidence. */
    private static boolean sameArguments(List<BaitlyChatTurnCoverage.Frame> frames,String id,String expected) {
        try {
            if(expected==null) return false;
            var parsed=JSON.readTree(expected);
            if(parsed==null || !parsed.isObject()) return false;
            for(var frame:frames) if("assistant".equals(frame.role()) && present(frame.calls())) {
                for(var call:JSON.readTree(frame.calls())) if(id.equals(call.path("id").asText()))
                    return call.path("arguments").isTextual() && parsed.equals(JSON.readTree(call.path("arguments").textValue()));
            }
            return false;
        } catch(Exception malformed) { return false; }
    }
    private static boolean present(String value) { return value!=null && !value.isBlank() && !"[]".equals(value) && !"null".equals(value); }
}
