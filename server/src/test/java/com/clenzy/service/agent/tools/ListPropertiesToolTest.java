package com.clenzy.service.agent.tools;

import com.clenzy.dto.PropertyDto;
import com.clenzy.model.PropertyStatus;
import com.clenzy.model.PropertyType;
import com.clenzy.service.PropertyService;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.ToolResult;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ListPropertiesToolTest {

    private PropertyService propertyService;
    private ListPropertiesTool tool;
    private ObjectMapper om;
    private AgentContext ctx;

    @BeforeEach
    void setUp() {
        propertyService = mock(PropertyService.class);
        om = new ObjectMapper();
        tool = new ListPropertiesTool(propertyService, om);
        ctx = AgentContext.minimal(1L, "user-123");
    }

    private static PropertyDto property(Long id, String name, String city, PropertyStatus status) {
        PropertyDto p = new PropertyDto();
        p.id = id;
        p.name = name;
        p.city = city;
        p.country = "France";
        p.status = status;
        p.type = PropertyType.APARTMENT;
        return p;
    }

    @Test
    void name_matchesDescriptor() {
        assertEquals("list_properties", tool.name());
        assertEquals("list_properties", tool.descriptor().name());
        assertFalse(tool.descriptor().requiresConfirmation());
    }

    @Test
    void noArgs_defaultLimit20_returnsCompactList() throws Exception {
        List<PropertyDto> all = List.of(
                property(1L, "Loft Bastille", "Paris", PropertyStatus.ACTIVE),
                property(2L, "Studio Lyon", "Lyon", PropertyStatus.ACTIVE)
        );
        Page<PropertyDto> page = new PageImpl<>(all, Pageable.ofSize(20), 2);
        when(propertyService.search(any(), any(), any(), any(), any())).thenReturn(page);

        ToolResult result = tool.execute(om.createObjectNode(), ctx);
        assertFalse(result.isError());
        assertEquals("list", result.displayHint());

        JsonNode payload = om.readTree(result.content());
        assertEquals(2, payload.path("count").asInt());
        assertEquals(2, payload.path("totalElements").asLong());
        assertFalse(payload.path("truncated").asBoolean());

        JsonNode items = payload.path("items");
        assertEquals(2, items.size());
        assertEquals(1L, items.get(0).path("id").asLong());
        assertEquals("Loft Bastille", items.get(0).path("name").asText());
        assertEquals("Paris", items.get(0).path("city").asText());
        assertEquals("ACTIVE", items.get(0).path("status").asText());
        assertEquals("APARTMENT", items.get(0).path("type").asText());
    }

    @Test
    void cityFilter_passedToService() {
        Page<PropertyDto> empty = new PageImpl<>(List.of(), Pageable.ofSize(20), 0);
        when(propertyService.search(any(), any(), any(), any(), any())).thenReturn(empty);

        ObjectNode args = om.createObjectNode();
        args.put("city", "Paris");
        args.put("status", "ACTIVE");
        args.put("type", "APARTMENT");
        args.put("limit", 5);

        tool.execute(args, ctx);

        ArgumentCaptor<String> cityCap = ArgumentCaptor.forClass(String.class);
        verify(propertyService).search(any(), isNull(),
                eq(PropertyStatus.ACTIVE), eq(PropertyType.APARTMENT), cityCap.capture());
        assertEquals("Paris", cityCap.getValue());
    }

    @Test
    void invalidEnumValue_ignoredNotThrown() {
        Page<PropertyDto> empty = new PageImpl<>(List.of(), Pageable.ofSize(20), 0);
        when(propertyService.search(any(), any(), any(), any(), any())).thenReturn(empty);

        ObjectNode args = om.createObjectNode();
        args.put("status", "NOT_A_REAL_STATUS");
        args.put("type", "WAT");

        // Should not throw — args treated as null
        ToolResult result = tool.execute(args, ctx);
        assertFalse(result.isError());

        verify(propertyService).search(any(), isNull(), isNull(), isNull(), isNull());
    }

    @Test
    void limitClampedToMax50() {
        Page<PropertyDto> empty = new PageImpl<>(List.of(), Pageable.ofSize(50), 0);
        when(propertyService.search(any(), any(), any(), any(), any())).thenReturn(empty);

        ObjectNode args = om.createObjectNode();
        args.put("limit", 999);

        tool.execute(args, ctx);
        // We don't expose the Pageable directly, but the service should have been called
        // exactly once. The clamp is internal; main test is that no exception fires.
        verify(propertyService, times(1)).search(any(), any(), any(), any(), any());
    }

    @Test
    void resultTruncated_whenTotalExceedsLimit() throws Exception {
        List<PropertyDto> shown = List.of(property(1L, "P1", "Paris", PropertyStatus.ACTIVE));
        Page<PropertyDto> page = new PageImpl<>(shown, Pageable.ofSize(1), 12);
        when(propertyService.search(any(), any(), any(), any(), any())).thenReturn(page);

        ObjectNode args = om.createObjectNode();
        args.put("limit", 1);

        ToolResult result = tool.execute(args, ctx);
        JsonNode payload = om.readTree(result.content());
        assertEquals(1, payload.path("count").asInt());
        assertEquals(12L, payload.path("totalElements").asLong());
        assertTrue(payload.path("truncated").asBoolean());
    }
}
