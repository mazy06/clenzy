package com.clenzy.service.agent.tools;

import com.clenzy.dto.ChannelSyncHealthDto;
import com.clenzy.dto.PropertyDto;
import com.clenzy.service.ChannelSyncHealthService;
import com.clenzy.service.PropertyService;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.ToolResult;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class GetChannelSyncStatusToolTest {

    private ChannelSyncHealthService channelSyncHealthService;
    private PropertyService propertyService;
    private GetChannelSyncStatusTool tool;
    private ObjectMapper om;
    private AgentContext ctx;

    @BeforeEach
    void setUp() {
        channelSyncHealthService = mock(ChannelSyncHealthService.class);
        propertyService = mock(PropertyService.class);
        om = new ObjectMapper();
        tool = new GetChannelSyncStatusTool(channelSyncHealthService, propertyService, om);
        ctx = AgentContext.minimal(1L, "user-123");
    }

    private static PropertyDto property(Long id, String name) {
        PropertyDto p = new PropertyDto();
        p.id = id;
        p.name = name;
        return p;
    }

    @Test
    void name_matchesDescriptor() {
        assertEquals("get_channel_sync_status", tool.name());
        assertEquals("get_channel_sync_status", tool.descriptor().name());
        assertFalse(tool.descriptor().requiresConfirmation());
    }

    @Test
    void listsChannelSyncStatusPerProperty_withDerivedStatus() throws Exception {
        List<PropertyDto> properties = List.of(
                property(10L, "Loft Bastille"),  // 2/2 synced -> OK
                property(20L, "Studio Lyon"),    // 1/2 synced -> STALE
                property(30L, "Cabane Sud")      // no channels -> NO_CHANNELS
        );
        Page<PropertyDto> page = new PageImpl<>(properties, Pageable.ofSize(25), 3);
        when(propertyService.search(any(), any(), any(), any(), any())).thenReturn(page);

        when(channelSyncHealthService.getHealthByPropertyIds(List.of(10L, 20L, 30L)))
                .thenReturn(Map.of(
                        10L, new ChannelSyncHealthDto(10L, 2, 2),
                        20L, new ChannelSyncHealthDto(20L, 1, 2),
                        30L, new ChannelSyncHealthDto(30L, 0, 0)
                ));

        ToolResult result = tool.execute(om.createObjectNode(), ctx);

        assertFalse(result.isError());
        assertEquals("list", result.displayHint());

        JsonNode payload = om.readTree(result.content());
        assertEquals(3, payload.path("count").asInt());
        assertEquals(2, payload.path("propertiesWithChannels").asInt());
        assertEquals(1, payload.path("fullySynced").asInt());
        assertEquals(1, payload.path("stale").asInt());

        JsonNode items = payload.path("items");
        assertEquals("Loft Bastille", items.get(0).path("propertyName").asText());
        assertEquals("OK", items.get(0).path("status").asText());
        assertEquals(2, items.get(0).path("syncedChannels").asInt());
        assertEquals(2, items.get(0).path("totalChannels").asInt());

        assertEquals("STALE", items.get(1).path("status").asText());
        assertEquals(1, items.get(1).path("syncedChannels").asInt());

        assertEquals("NO_CHANNELS", items.get(2).path("status").asText());
        assertEquals(0, items.get(2).path("totalChannels").asInt());
    }

    @Test
    void missingHealthEntry_treatedAsNoChannels() throws Exception {
        List<PropertyDto> properties = List.of(property(42L, "Sans capteur"));
        Page<PropertyDto> page = new PageImpl<>(properties, Pageable.ofSize(25), 1);
        when(propertyService.search(any(), any(), any(), any(), any())).thenReturn(page);
        when(channelSyncHealthService.getHealthByPropertyIds(anyList())).thenReturn(Map.of());

        JsonNode payload = om.readTree(tool.execute(om.createObjectNode(), ctx).content());
        JsonNode item = payload.path("items").get(0);
        assertEquals("NO_CHANNELS", item.path("status").asText());
        assertEquals(0, item.path("totalChannels").asInt());
    }
}
