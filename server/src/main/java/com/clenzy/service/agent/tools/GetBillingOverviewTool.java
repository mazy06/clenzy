package com.clenzy.service.agent.tools;

import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.dto.BillingOverviewDto;
import com.clenzy.dto.ChannelRevenueDto;
import com.clenzy.service.BillingOverviewService;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.ToolExecutionException;
import com.clenzy.service.agent.ToolHandler;
import com.clenzy.service.agent.ToolResult;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Tool {@code get_billing_overview} — vue d'ensemble de la facturation de l'org :
 * revenu reserve regroupe par canal (Airbnb, Booking.com, Direct, Autre) sur la
 * portee choisie (mois ou annee en cours), avec comparaison periode precedente.
 *
 * <p>Delegue a {@link BillingOverviewService#getBillingOverview(Long, String,
 * java.time.LocalDate, String)}. L'orgId vient du contexte assistant (jamais en
 * argument), donc strictement org-scope. La devise est resolue par le service
 * (repli EUR). Lecture seule, aucun appel HTTP externe.</p>
 */
@Component
public class GetBillingOverviewTool implements ToolHandler {

    private static final Logger log = LoggerFactory.getLogger(GetBillingOverviewTool.class);
    private static final String NAME = "get_billing_overview";
    private static final String DEFAULT_SCOPE = "month";

    private final BillingOverviewService billingOverviewService;
    private final ObjectMapper objectMapper;
    private final ToolDescriptor descriptor;

    public GetBillingOverviewTool(BillingOverviewService billingOverviewService, ObjectMapper objectMapper) {
        this.billingOverviewService = billingOverviewService;
        this.objectMapper = objectMapper;
        this.descriptor = buildDescriptor(objectMapper);
    }

    @Override
    public String name() {
        return NAME;
    }

    @Override
    public ToolDescriptor descriptor() {
        return descriptor;
    }

    @Override
    public ToolResult execute(JsonNode args, AgentContext context) {
        final String scope = "year".equalsIgnoreCase(args.path("scope").asText(DEFAULT_SCOPE))
                ? "year" : DEFAULT_SCOPE;

        try {
            // currency = null → le service replie sur EUR ; orgId vient du contexte
            // assistant, jamais d'un argument du LLM (org-scope strict).
            BillingOverviewDto overview = billingOverviewService.getBillingOverview(
                    context.organizationId(), null, LocalDate.now(), scope);

            List<Map<String, Object>> channels = new ArrayList<>();
            BigDecimal totalRevenue = BigDecimal.ZERO;
            List<ChannelRevenueDto> source = overview.channels() != null
                    ? overview.channels() : List.of();
            for (ChannelRevenueDto c : source) {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("source", c.source());
                m.put("label", c.label());
                m.put("amount", c.amount());
                m.put("pct", c.pct());
                m.put("comparePct", c.comparePct());
                channels.add(m);
                if (c.amount() != null) {
                    totalRevenue = totalRevenue.add(c.amount());
                }
            }

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("scope", scope);
            payload.put("currency", overview.currency());
            payload.put("totalRevenue", totalRevenue);
            payload.put("channels", channels);
            payload.put("channelCount", channels.size());
            return ToolResult.success(objectMapper.writeValueAsString(payload), "details");
        } catch (JsonProcessingException e) {
            throw new ToolExecutionException(NAME, "Failed to serialize billing overview", e);
        } catch (Exception e) {
            log.warn("get_billing_overview failed: {}", e.getMessage());
            throw new ToolExecutionException(NAME,
                    "Vue facturation indisponible (" + e.getMessage() + ")", e);
        }
    }

    private static ToolDescriptor buildDescriptor(ObjectMapper om) {
        try {
            JsonNode schema = om.readTree("""
                    {
                      "type": "object",
                      "properties": {
                        "scope": {"type":"string","enum":["month","year"],"description":"Portee : mois (defaut) ou annee en cours."}
                      },
                      "additionalProperties": false
                    }
                    """);
            return ToolDescriptor.readOnly(
                    NAME,
                    "Vue d'ensemble facturation de l'organisation : revenu reserve par canal (Airbnb, Booking.com, Direct, Autre) sur le mois (defaut) ou l'annee en cours, avec part en % et comparaison periode precedente, plus le total. Utiliser pour 'revenus par canal', 'd'ou viennent mes reservations', 'CA Airbnb vs direct', 'repartition du chiffre d'affaires'.",
                    schema
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build schema for " + NAME, e);
        }
    }
}
