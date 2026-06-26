package com.clenzy.service.agent.tools;

import com.clenzy.dto.PropertyDto;
import com.clenzy.service.PropertyService;
import com.clenzy.service.agent.AgentContext;
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
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class GetPropertyAmenitiesToolTest {

    private PropertyService propertyService;
    private GetPropertyAmenitiesTool tool;
    private ObjectMapper om;
    private AgentContext ctx;

    @BeforeEach
    void setUp() {
        propertyService = mock(PropertyService.class);
        om = new ObjectMapper();
        tool = new GetPropertyAmenitiesTool(propertyService, om);
        ctx = AgentContext.minimal(1L, "user-123");
    }

    private static PropertyDto property(Long id, String name, List<String> amenities) {
        PropertyDto p = new PropertyDto();
        p.id = id;
        p.name = name;
        p.amenities = amenities;
        return p;
    }

    @Test
    void name_matchesDescriptor() {
        assertEquals("get_property_amenities", tool.name());
        assertEquals("get_property_amenities", tool.descriptor().name());
        assertFalse(tool.descriptor().requiresConfirmation());
    }

    @Test
    void noPropertyId_listsAllPropertiesWithAmenities_viaSearch() throws Exception {
        List<PropertyDto> all = List.of(
                property(1L, "Loft Bastille", List.of("wifi", "pool")),
                property(2L, "Studio Lyon", List.of("wifi"))
        );
        Page<PropertyDto> page = new PageImpl<>(all, Pageable.ofSize(20), 2);
        when(propertyService.search(any(), any(), any(), any(), any())).thenReturn(page);

        ToolResult result = tool.execute(om.createObjectNode(), ctx);

        assertFalse(result.isError());
        assertEquals("list", result.displayHint());
        verify(propertyService, never()).getById(anyLong());

        JsonNode payload = om.readTree(result.content());
        assertEquals(2, payload.path("count").asInt());
        JsonNode items = payload.path("items");
        assertEquals(2, items.size());
        assertEquals("Loft Bastille", items.get(0).path("name").asText());
        assertEquals(2, items.get(0).path("amenityCount").asInt());
        assertEquals("wifi", items.get(0).path("amenities").get(0).asText());
        assertEquals("pool", items.get(0).path("amenities").get(1).asText());
    }

    @Test
    void withPropertyId_returnsSingleProperty_viaGetById() throws Exception {
        when(propertyService.getById(5L))
                .thenReturn(property(5L, "Villa Sud", List.of("piscine", "clim")));

        ObjectNode args = om.createObjectNode();
        args.put("propertyId", 5);

        ToolResult result = tool.execute(args, ctx);

        assertFalse(result.isError());
        verify(propertyService).getById(5L);
        verify(propertyService, never()).search(any(), any(), any(), any(), any());

        JsonNode payload = om.readTree(result.content());
        assertEquals(1, payload.path("count").asInt());
        JsonNode item = payload.path("items").get(0);
        assertEquals(5L, item.path("id").asLong());
        assertEquals("Villa Sud", item.path("name").asText());
        assertEquals(2, item.path("amenityCount").asInt());
    }

    @Test
    void nullAmenities_returnsEmptyArray() throws Exception {
        when(propertyService.getById(7L))
                .thenReturn(property(7L, "Sans equipements", null));

        ObjectNode args = om.createObjectNode();
        args.put("propertyId", 7);

        JsonNode item = om.readTree(tool.execute(args, ctx).content()).path("items").get(0);
        assertEquals(0, item.path("amenityCount").asInt());
        assertTrue(item.path("amenities").isArray());
        assertEquals(0, item.path("amenities").size());
    }
}
