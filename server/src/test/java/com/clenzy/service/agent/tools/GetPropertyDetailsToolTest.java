package com.clenzy.service.agent.tools;

import com.clenzy.dto.PropertyDto;
import com.clenzy.model.PropertyStatus;
import com.clenzy.model.PropertyType;
import com.clenzy.service.PropertyService;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.ToolExecutionException;
import com.clenzy.service.agent.ToolResult;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

class GetPropertyDetailsToolTest {

    private PropertyService propertyService;
    private GetPropertyDetailsTool tool;
    private ObjectMapper om;
    private AgentContext ctx;

    @BeforeEach
    void setUp() {
        propertyService = mock(PropertyService.class);
        om = new ObjectMapper();
        tool = new GetPropertyDetailsTool(propertyService, om);
        ctx = AgentContext.minimal(1L, "user-123");
    }

    private static PropertyDto property(Long id, String name) {
        PropertyDto p = new PropertyDto();
        p.id = id;
        p.name = name;
        p.type = PropertyType.APARTMENT;
        p.status = PropertyStatus.ACTIVE;
        p.city = "Paris";
        p.bedroomCount = 2;
        p.bathroomCount = 1;
        p.maxGuests = 4;
        return p;
    }

    @Test
    void name_matchesDescriptor() {
        assertEquals("get_property_details", tool.name());
        assertEquals("get_property_details", tool.descriptor().name());
        assertFalse(tool.descriptor().requiresConfirmation());
    }

    @Test
    void withId_returnsDetails() throws Exception {
        when(propertyService.getById(5L)).thenReturn(property(5L, "Villa Sud"));

        ObjectNode args = om.createObjectNode();
        args.put("propertyId", 5);

        ToolResult result = tool.execute(args, ctx);
        assertFalse(result.isError());
        assertEquals("details", result.displayHint());

        JsonNode payload = om.readTree(result.content());
        assertEquals("Villa Sud", payload.path("name").asText());
        assertEquals(2, payload.path("bedroomCount").asInt());
        assertEquals(4, payload.path("maxGuests").asInt());
        assertEquals("APARTMENT", payload.path("type").asText());
    }

    @Test
    void noId_singleProperty_autoResolves() throws Exception {
        // "details du seul logement" : sans ID, si l'org n'a qu'un logement on le resout.
        Page<PropertyDto> page = new PageImpl<>(List.of(property(7L, "Unique")), Pageable.ofSize(2), 1);
        when(propertyService.search(any(), any(), any(), any(), any())).thenReturn(page);
        when(propertyService.getById(7L)).thenReturn(property(7L, "Unique"));

        ToolResult result = tool.execute(om.createObjectNode(), ctx);
        assertFalse(result.isError());
        assertEquals("Unique", om.readTree(result.content()).path("name").asText());
        verify(propertyService).getById(7L);
    }

    @Test
    void noId_multipleProperties_guides() {
        // Plusieurs logements + pas d'ID : on guide (pas d'execution arbitraire).
        Page<PropertyDto> page = new PageImpl<>(List.of(property(1L, "A"), property(2L, "B")), Pageable.ofSize(2), 2);
        when(propertyService.search(any(), any(), any(), any(), any())).thenReturn(page);

        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(om.createObjectNode(), ctx));
        assertTrue(ex.getMessage().toLowerCase().contains("plusieurs"));
        verify(propertyService, never()).getById(anyLong());
    }
}
