package com.clenzy.service.agent.tools;

import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.service.catalog.ServiceCatalogReference;
import com.clenzy.service.agent.*;
import com.fasterxml.jackson.databind.*;
import org.springframework.stereotype.Component;
import java.util.Locale;

/** Catalogue commun aux formulaires PMS, à la marketplace et à l'assistant. */
@Component
public class ListServiceReferenceTool implements ToolHandler {
    private final ServiceCatalogReference catalog;
    private final ObjectMapper mapper;
    public ListServiceReferenceTool(ServiceCatalogReference catalog,ObjectMapper mapper) { this.catalog=catalog; this.mapper=mapper; }
    public String name() { return "list_service_reference"; }
    public ToolDescriptor descriptor() {
        var schema=mapper.createObjectNode();
        schema.put("type","object"); schema.put("additionalProperties",false);
        schema.putObject("properties").putObject("query").put("type","string").put("description","Mot ou code à rechercher dans les prestations");
        return ToolDescriptor.readOnly(name(),"Prestations actives du référentiel Baitly : codes exacts, métiers et règles de logement/créneau. À consulter avant create_intervention.",schema);
    }
    public ToolResult execute(JsonNode args,AgentContext context) {
        String query=args.path("query").asText("").trim().toLowerCase(Locale.ROOT);
        var result=catalog.items().stream().filter(item ->
            (item.code()+" "+item.labelFr()+" "+item.labelEn()).toLowerCase(Locale.ROOT).contains(query)).limit(50).toList();
        try { return ToolResult.success(mapper.writeValueAsString(result),"summary"); }
        catch (java.io.IOException error) { throw new ToolExecutionException(name(),"Catalogue indisponible",error); }
    }
}
