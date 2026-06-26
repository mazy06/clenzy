package com.clenzy.service.agent.tools;

import com.clenzy.dto.PropertyDto;
import com.clenzy.service.PriceEngine;
import com.clenzy.service.PropertyService;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.ToolExecutionException;
import com.clenzy.service.agent.ToolResult;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class GetPriceQuoteToolTest {

    private PriceEngine priceEngine;
    private PropertyService propertyService;
    private GetPriceQuoteTool tool;
    private ObjectMapper om;
    private AgentContext ctx;

    @BeforeEach
    void setUp() {
        priceEngine = mock(PriceEngine.class);
        propertyService = mock(PropertyService.class);
        om = new ObjectMapper();
        tool = new GetPriceQuoteTool(priceEngine, propertyService, om);
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
        assertEquals("get_price_quote", tool.name());
        assertEquals("get_price_quote", tool.descriptor().name());
        assertFalse(tool.descriptor().requiresConfirmation());
    }

    @Test
    void quote_sumsNightlyPrices() throws Exception {
        when(propertyService.getById(5L)).thenReturn(property(5L, "Villa Sud"));
        // 2 nuits facturees : 07-01 et 07-02 (depart 07-03 non facture).
        Map<LocalDate, BigDecimal> prices = Map.of(
                LocalDate.parse("2026-07-01"), new BigDecimal("100"),
                LocalDate.parse("2026-07-02"), new BigDecimal("120"));
        when(priceEngine.resolvePriceRange(eq(5L), any(), any(), eq(1L))).thenReturn(prices);

        ObjectNode args = om.createObjectNode();
        args.put("propertyId", 5);
        args.put("from", "2026-07-01");
        args.put("to", "2026-07-03");

        ToolResult result = tool.execute(args, ctx);
        assertFalse(result.isError());
        assertEquals("quote", result.displayHint());

        JsonNode payload = om.readTree(result.content());
        assertEquals("Villa Sud", payload.path("propertyName").asText());
        assertEquals(2, payload.path("nights").asInt());
        assertEquals(0, new BigDecimal("220").compareTo(payload.path("total").decimalValue()));
        assertEquals("EUR", payload.path("currency").asText());
    }

    @Test
    void departureNotAfterArrival_throws() {
        ObjectNode args = om.createObjectNode();
        args.put("propertyId", 5);
        args.put("from", "2026-07-03");
        args.put("to", "2026-07-03");
        assertThrows(ToolExecutionException.class, () -> tool.execute(args, ctx));
    }
}
