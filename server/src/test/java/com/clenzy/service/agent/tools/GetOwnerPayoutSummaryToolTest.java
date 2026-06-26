package com.clenzy.service.agent.tools;

import com.clenzy.dto.OwnerPayoutDto;
import com.clenzy.model.OwnerPayout;
import com.clenzy.model.OwnerPayout.PayoutStatus;
import com.clenzy.service.AccountingQueryService;
import com.clenzy.service.AccountingService;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.ToolResult;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class GetOwnerPayoutSummaryToolTest {

    private AccountingService accountingService;
    private AccountingQueryService accountingQueryService;
    private GetOwnerPayoutSummaryTool tool;
    private ObjectMapper om;
    private AgentContext ctx;

    @BeforeEach
    void setUp() {
        accountingService = mock(AccountingService.class);
        accountingQueryService = mock(AccountingQueryService.class);
        om = new ObjectMapper();
        tool = new GetOwnerPayoutSummaryTool(accountingService, accountingQueryService, om);
        ctx = AgentContext.minimal(3L, "user-xyz");
    }

    private static OwnerPayout payout(Long id, Long ownerId, PayoutStatus status,
                                      BigDecimal net, String currency,
                                      LocalDate from, LocalDate to) {
        OwnerPayout p = new OwnerPayout();
        p.setId(id);
        p.setOwnerId(ownerId);
        p.setStatus(status);
        p.setNetAmount(net);
        p.setCurrency(currency);
        p.setPeriodStart(from);
        p.setPeriodEnd(to);
        return p;
    }

    @Test
    void name_matchesDescriptor() {
        assertEquals("get_owner_payout_summary", tool.name());
        assertEquals("get_owner_payout_summary", tool.descriptor().name());
        assertFalse(tool.descriptor().requiresConfirmation());
    }

    @Test
    void splitsPayoutsIntoUpcomingAndRecent_withTotals() throws Exception {
        OwnerPayout pending = payout(1L, 100L, PayoutStatus.PENDING,
                new BigDecimal("500.00"), "EUR", LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 30));
        OwnerPayout approved = payout(2L, 101L, PayoutStatus.APPROVED,
                new BigDecimal("250.50"), "EUR", LocalDate.of(2026, 5, 1), LocalDate.of(2026, 5, 31));
        OwnerPayout paid = payout(3L, 102L, PayoutStatus.PAID,
                new BigDecimal("800.00"), "EUR", LocalDate.of(2026, 4, 1), LocalDate.of(2026, 4, 30));

        List<OwnerPayout> payouts = List.of(pending, approved, paid);
        when(accountingService.getPayouts(3L)).thenReturn(payouts);

        List<OwnerPayoutDto> dtos = new ArrayList<>();
        dtos.add(OwnerPayoutDto.from(pending, "Proprio A"));
        dtos.add(OwnerPayoutDto.from(approved, "Proprio B"));
        dtos.add(OwnerPayoutDto.from(paid, "Proprio C"));
        when(accountingQueryService.toDtosWithOwnerNames(anyList())).thenReturn(dtos);

        ToolResult result = tool.execute(om.createObjectNode(), ctx);

        assertFalse(result.isError());
        assertEquals("list", result.displayHint());
        verify(accountingService).getPayouts(3L);

        JsonNode payload = om.readTree(result.content());
        assertEquals(2, payload.path("upcomingCount").asInt());
        assertEquals(1, payload.path("recentPaidCount").asInt());
        assertEquals(750.50, payload.path("upcomingTotalNet").asDouble(), 0.001);
        assertEquals(800.00, payload.path("paidTotalNet").asDouble(), 0.001);

        // Upcoming trie par periodEnd ascendant : approved (mai) avant pending (juin).
        JsonNode upcoming = payload.path("upcoming");
        assertEquals(2, upcoming.size());
        assertEquals("Proprio B", upcoming.get(0).path("owner").asText());
        assertEquals(250.50, upcoming.get(0).path("netAmount").asDouble(), 0.001);
        assertEquals("EUR", upcoming.get(0).path("currency").asText());
        assertEquals("APPROVED", upcoming.get(0).path("status").asText());

        JsonNode recent = payload.path("recent");
        assertEquals(1, recent.size());
        assertEquals("Proprio C", recent.get(0).path("owner").asText());
        assertEquals("PAID", recent.get(0).path("status").asText());
        assertEquals("2026-04-30", recent.get(0).path("periodEnd").asText());
    }

    @Test
    void noPayouts_returnsEmptyBuckets() throws Exception {
        when(accountingService.getPayouts(3L)).thenReturn(List.of());
        when(accountingQueryService.toDtosWithOwnerNames(anyList())).thenReturn(List.of());

        JsonNode payload = om.readTree(tool.execute(om.createObjectNode(), ctx).content());
        assertEquals(0, payload.path("upcomingCount").asInt());
        assertEquals(0, payload.path("recentPaidCount").asInt());
        assertEquals(0, payload.path("upcoming").size());
        assertEquals(0, payload.path("recent").size());
        assertEquals(0.0, payload.path("upcomingTotalNet").asDouble(), 0.001);
    }
}
