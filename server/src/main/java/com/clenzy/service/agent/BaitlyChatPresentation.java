package com.clenzy.service.agent;

import com.clenzy.model.AssistantMessage;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import java.util.*;

/** Authorized presentation only; never an outgoing model message or an execution proof. */
final class BaitlyChatPresentation {
    private static final ObjectMapper JSON=new ObjectMapper();
    private static final Map<String,String> HINTS=Map.ofEntries(
        Map.entry("suggest_navigation","navigation"),Map.entry("get_price_quote","quote"),Map.entry("get_availability","availability"),
        Map.entry("get_dashboard_summary","summary"),Map.entry("get_financial_summary","chart_bar"),Map.entry("get_properties_performance","chart_bar"),
        Map.entry("get_reservation_details","details"),Map.entry("get_property_details","details"),Map.entry("get_billing_overview","details"));
    private BaitlyChatPresentation() {}
    static Map<String,String> names(List<AssistantMessage> history) {
        var result=new HashMap<String,String>();
        for(var m:history) if("assistant".equals(m.getRole()) && m.getToolCalls()!=null) try {
            var calls=JSON.readTree(m.getToolCalls());
            if(calls.isArray()) for(var call:calls) if(call.path("id").isTextual() && call.path("name").isTextual())
                result.merge(call.path("id").asText(),call.path("name").asText(),(a,b)->"unknown");
        } catch(Exception invalid) { /* Unknown historical content is not executable or rendered raw. */ }
        return result;
    }
    static String render(String name,String content) {
        if(name==null || content==null || content.length()>262_144) return null;
        try {
            var parsed=JSON.readTree(content);
            if(parsed==null || !(parsed.isObject() || parsed.isArray())) return null;
            if(parsed.has("error") || parsed.path("isError").asBoolean(false))
                return JSON.writeValueAsString(Map.of("displayHint","summary","isError",true,"data","Résultat historique indisponible"));
            String hint=HINTS.getOrDefault(name,name.startsWith("list_")?"list":"summary");
            var data=safe(parsed,0);
            return JSON.writeValueAsString(Map.of("displayHint",hint,"isError",false,"data",data));
        } catch(Exception invalid) { return null; }
    }
    private static JsonNode safe(JsonNode value,int depth) {
        if(depth>16) return NullNode.instance;
        if(value.isObject()) {
            var out=JSON.createObjectNode();
            value.fields().forEachRemaining(e->{
                String key=e.getKey().toLowerCase(Locale.ROOT).replaceAll("[^a-z]","");
                if(!key.matches(".*(token|password|secret|authorization|cookie|credential|accesscode|pincode|apikey|storagekey|exception|stacktrace|cause|diagnostic).*"))
                    out.set(e.getKey(),safe(e.getValue(),depth+1));
            }); return out;
        }
        if(value.isArray()) { var out=JSON.createArrayNode(); for(int i=0;i<Math.min(100,value.size());i++) out.add(safe(value.get(i),depth+1)); return out; }
        return value;
    }
}
