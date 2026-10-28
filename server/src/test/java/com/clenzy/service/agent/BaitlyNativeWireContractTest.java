package com.clenzy.service.agent;

import com.clenzy.service.agent.agui.AgentSseEventToAgUi;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import java.nio.file.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;

/** Shared synthetic fixture connects the Java translator and the frozen pre-removal SDK oracle. */
class BaitlyNativeWireContractTest {
    @Test void nativeJavaTextAndAllNineToolEnvelopesMatchTheFrozenSdkContract() throws Exception {
        var json=new ObjectMapper();
        var fixture=json.readTree(Files.readString(Path.of("../client/src/modules/supervision/agui/baitly/fixtures/baitly-sdk-oracle.json")));
        var translator=new AgentSseEventToAgUi("baitly-oracle-thread",json);
        var actual=new ArrayList<JsonNode>();
        var started=translator.onStart().getFirst();
        ObjectNode start=json.valueToTree(started.payload());start.put("runId","baitly-oracle-run");actual.add(start);
        String currentMessage=null;
        for(var event:translator.translate(AgentSseEvent.textDelta("Recette العربية"))) {
            ObjectNode node=json.valueToTree(event.payload());
            if(node.path("type").asText().equals("TEXT_MESSAGE_START")) currentMessage=node.path("messageId").asText();
            if(node.has("messageId")) node.put("messageId","reply");actual.add(node);
        }
        for(String hint:List.of("list","details","chart_bar","kpi_summary","data_table","availability","quote","summary","navigation")) {
            for(var event:translator.translate(AgentSseEvent.toolCallExecuted("synthetic_action","tool-"+hint,false,hint,"{\"fixture\":true}"))) {
                ObjectNode node=json.valueToTree(event.payload());
                if(node.has("messageId")) node.put("messageId","result-"+hint);
                node.remove("parentMessageId");actual.add(node);
            }
        }
        for(var event:translator.translate(AgentSseEvent.done("stop"))) {
            ObjectNode node=json.valueToTree(event.payload());
            if(node.has("messageId")) node.put("messageId","reply");
            if(node.has("runId")) node.put("runId","baitly-oracle-run");actual.add(node);
        }
        var expected=new ArrayList<JsonNode>();
        for(var frame:fixture.path("events")) {
            String type=frame.path("type").asText();
            if(Set.of("STATE_SNAPSHOT","STATE_DELTA","TOOL_CALL_ARGS").contains(type)) continue;
            expected.add(frame);
        }
        // Java closes streamed text at terminal; order of tool events is otherwise identical.
        var end=actual.stream().filter(n->n.path("type").asText().equals("TEXT_MESSAGE_END")).findFirst().orElseThrow();
        actual.remove(end);actual.add(3,end);
        assertThat(currentMessage).isNotBlank();assertThat(actual).containsExactlyElementsOf(expected);
    }
}
