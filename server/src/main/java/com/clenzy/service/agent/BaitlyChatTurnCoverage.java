package com.clenzy.service.agent;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;

/** Pure structural check. Raw persisted arguments/results never enter a certificate. */
final class BaitlyChatTurnCoverage {
    record Frame(Long id,String role,String calls,String callId,boolean attachments,boolean content,String reason) {}
    record Read(String callId,String kind,String status,Long resultId) {}
    private static final ObjectMapper JSON=new ObjectMapper();
    private BaitlyChatTurnCoverage() {}

    static Set<String> prove(List<Frame> frames,List<Read> reads) {
        return prove(frames,reads,false);
    }
    static Set<String> proveWrites(List<Frame> frames,List<Read> reads) {
        return prove(frames,reads,true);
    }
    private static Set<String> prove(List<Frame> frames,List<Read> reads,boolean writes) {
        if(frames.size()<4 || reads.isEmpty() || frames.stream().anyMatch(Frame::attachments)) return Set.of();
        var first=frames.getFirst(); var last=frames.getLast();
        if(!"user".equals(first.role()) || !first.content() || present(first.calls()) || first.callId()!=null
                || !"assistant".equals(last.role()) || !last.content() || present(last.calls()) || last.callId()!=null
                || !Set.of("stop","end_turn").contains(Objects.toString(last.reason(),""))) return Set.of();
        var byId=new HashMap<String,Read>();
        for(var read:reads) {
            if(read.callId()==null || byId.put(read.callId(),read)!=null
                    || !"READ_ONLY_COMPLETED".equals(read.status()) || read.resultId()==null) return Set.of();
        }
        var covered=new HashSet<String>();
        try {
            int index=1;
            while(index<frames.size()-1) {
                var assistant=frames.get(index++);
                if(!"assistant".equals(assistant.role()) || assistant.callId()!=null
                        || !Set.of("tool_use","tool_calls").contains(Objects.toString(assistant.reason(),""))) return Set.of();
                var calls=JSON.readTree(assistant.calls()==null?"null":assistant.calls());
                if(!calls.isArray() || calls.isEmpty() || calls.size()>64) return Set.of();
                for(var call:calls) {
                    if(!call.path("id").isTextual() || !call.path("name").isTextual()) return Set.of();
                    String id=call.path("id").textValue(); String kind=switch(call.path("name").textValue()) {
                        case "suggest_navigation" -> "NAVIGATION_ONLY_V1";
                        case "compute_tourist_tax" -> "TAX_READ_ONLY_V1";
                        case "update_property_status" -> writes?"PROPERTY_STATUS_V1":"UNVERIFIED";
                        case "forget_fact" -> writes?"MEMORY_DELETE_V1":"UNVERIFIED";
                        default -> "UNVERIFIED";
                    };
                    var read=byId.get(id);
                    if(!covered.add(id) || "UNVERIFIED".equals(kind) || read==null || !kind.equals(read.kind())
                            || index>=frames.size()-1) return Set.of();
                    var result=frames.get(index++);
                    if(!"tool".equals(result.role()) || !id.equals(result.callId()) || !read.resultId().equals(result.id())
                            || !result.content() || present(result.calls())) return Set.of();
                }
            }
            return index==frames.size()-1 && covered.equals(byId.keySet())?Set.copyOf(covered):Set.of();
        } catch(Exception malformed) { return Set.of(); }
    }
    private static boolean present(String value) {
        return value!=null && !value.isBlank() && !"[]".equals(value) && !"null".equals(value);
    }
}
