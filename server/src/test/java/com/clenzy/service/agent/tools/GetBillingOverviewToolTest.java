package com.clenzy.service.agent.tools;

import com.clenzy.dto.BillingOverviewDto;
import com.clenzy.dto.ChannelRevenueDto;
import com.clenzy.service.BillingOverviewService;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.ToolResult;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class GetBillingOverviewToolTest {

    private BillingOverviewService billingOverviewService;
    private GetBillingOverviewTool tool;
    private ObjectMapper om;
    private AgentContext ctx;

    @BeforeEach
    void setUp() {
        billingOverviewService = mock(BillingOverviewService.class);
        om = new ObjectMapper();
        tool = new GetBillingOverviewTool(billingOverviewService, om);
        ctx = AgentContext.minimal(7L, "user-123");
    }

    @Test
    void name_matchesDescriptor() {
        assertEquals("get_billing_overview", tool.name());
        assertEquals("get_billing_overview", tool.descriptor().name());
        assertFalse(tool.descriptor().requiresConfirmation());
    }

    @Test
    void returnsChannelsWithTotal_defaultScopeMonth() throws Exception {
        BillingOverviewDto dto = new BillingOverviewDto("EUR", List.of(
                new ChannelRevenueDto("airbnb", "Airbnb", BigDecimal.valueOf(800), 80.0, 75.0),
                new ChannelRevenueDto("direct", "Direct", BigDecimal.valueOf(200), 20.0, null)
        ));
        when(billingOverviewService.getBillingOverview(eq(7L), isNull(), any(LocalDate.class), eq("month")))
                .thenReturn(dto);

        ToolResult result = tool.execute(om.createObjectNode(), ctx);

        assertFalse(result.isError());
        assertEquals("details", result.displayHint());

        JsonNode payload = om.readTree(result.content());
        assertEquals("month", payload.path("scope").asText());
        assertEquals("EUR", payload.path("currency").asText());
        assertEquals(2, payload.path("channelCount").asInt());
        assertEquals(1000, payload.path("totalRevenue").asInt());

        JsonNode channels = payload.path("channels");
        assertEquals("Airbnb", channels.get(0).path("label").asText());
        assertEquals(80.0, channels.get(0).path("pct").asDouble());
        assertTrue(channels.get(1).path("comparePct").isNull());
    }

    @Test
    void scopeYear_isForwardedToService() throws Exception {
        when(billingOverviewService.getBillingOverview(eq(7L), isNull(), any(LocalDate.class), eq("year")))
                .thenReturn(new BillingOverviewDto("EUR", List.of()));

        ObjectNode args = om.createObjectNode();
        args.put("scope", "year");

        JsonNode payload = om.readTree(tool.execute(args, ctx).content());
        assertEquals("year", payload.path("scope").asText());
        assertEquals(0, payload.path("channelCount").asInt());
        verify(billingOverviewService).getBillingOverview(eq(7L), isNull(), any(LocalDate.class), eq("year"));
    }
}
