package com.clenzy.service.agent.tools;

import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.dto.OwnerPayoutDto;
import com.clenzy.model.OwnerPayout;
import com.clenzy.model.OwnerPayout.PayoutStatus;
import com.clenzy.service.AccountingQueryService;
import com.clenzy.service.AccountingService;
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
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Tool {@code get_owner_payout_summary} — resume des reversements aux proprietaires.
 *
 * <p>Retourne les reversements (payouts) de l'organisation, separes en :</p>
 * <ul>
 *   <li><b>upcoming</b> : a venir (statuts PENDING / APPROVED / PROCESSING)</li>
 *   <li><b>recent</b> : recemment verses (statut PAID)</li>
 * </ul>
 * <p>Chaque ligne : proprietaire, montant net, devise, periode, statut. Lecture seule.</p>
 *
 * <p><b>Choix du service</b> : delegue a {@link AccountingService#getPayouts(Long)} —
 * la SEULE methode de listing read-only org-scopee des payouts. Les deux services
 * suggeres ne conviennent pas : {@code PayoutScheduleService} ne gere que la config
 * singleton du calendrier (pas de donnees de payout), et {@code OwnerStatementService}
 * est en ecriture (envoi d'email) et exige un ownerId. Les noms de proprietaires sont
 * resolus via {@link AccountingQueryService#toDtosWithOwnerNames(List)}.</p>
 *
 * <p>PII : seul le nom du proprietaire (personne ou societe) est expose ; aucun
 * email/telephone/IBAN.</p>
 */
@Component
public class GetOwnerPayoutSummaryTool implements ToolHandler {

    private static final Logger log = LoggerFactory.getLogger(GetOwnerPayoutSummaryTool.class);
    private static final String NAME = "get_owner_payout_summary";
    private static final int MAX_PER_BUCKET = 25;

    private final AccountingService accountingService;
    private final AccountingQueryService accountingQueryService;
    private final ObjectMapper objectMapper;
    private final ToolDescriptor descriptor;

    public GetOwnerPayoutSummaryTool(AccountingService accountingService,
                                     AccountingQueryService accountingQueryService,
                                     ObjectMapper objectMapper) {
        this.accountingService = accountingService;
        this.accountingQueryService = accountingQueryService;
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
        final Long orgId = context.organizationId();
        try {
            // getPayouts exige orgId → scoping organisation garanti (findAllByOrgId).
            List<OwnerPayout> payouts = accountingService.getPayouts(orgId);
            List<OwnerPayoutDto> dtos = accountingQueryService.toDtosWithOwnerNames(payouts);

            // La devise vit sur l'entite (absente du DTO) : map id → currency.
            Map<Long, String> currencyById = new LinkedHashMap<>();
            for (OwnerPayout p : payouts) {
                currencyById.put(p.getId(), p.getCurrency());
            }

            List<Map<String, Object>> upcoming = new ArrayList<>();
            List<Map<String, Object>> recent = new ArrayList<>();
            BigDecimal upcomingTotal = BigDecimal.ZERO;
            BigDecimal paidTotal = BigDecimal.ZERO;

            // A venir : du plus proche (periodEnd ascendant) ; recents : du plus recent (descendant).
            List<OwnerPayoutDto> pendingSorted = new ArrayList<>(dtos.stream()
                    .filter(d -> isUpcoming(d.status()))
                    .sorted(Comparator.comparing(OwnerPayoutDto::periodEnd))
                    .toList());
            List<OwnerPayoutDto> paidSorted = new ArrayList<>(dtos.stream()
                    .filter(d -> d.status() == PayoutStatus.PAID)
                    .sorted(Comparator.comparing(OwnerPayoutDto::periodEnd).reversed())
                    .toList());

            for (OwnerPayoutDto d : pendingSorted) {
                upcomingTotal = upcomingTotal.add(safeAmount(d.netAmount()));
                if (upcoming.size() < MAX_PER_BUCKET) {
                    upcoming.add(toItem(d, currencyById.get(d.id())));
                }
            }
            for (OwnerPayoutDto d : paidSorted) {
                paidTotal = paidTotal.add(safeAmount(d.netAmount()));
                if (recent.size() < MAX_PER_BUCKET) {
                    recent.add(toItem(d, currencyById.get(d.id())));
                }
            }

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("upcoming", upcoming);
            payload.put("recent", recent);
            payload.put("upcomingCount", pendingSorted.size());
            payload.put("recentPaidCount", paidSorted.size());
            payload.put("upcomingTotalNet", round2(upcomingTotal));
            payload.put("paidTotalNet", round2(paidTotal));
            return ToolResult.success(objectMapper.writeValueAsString(payload), "list");
        } catch (JsonProcessingException e) {
            throw new ToolExecutionException(NAME, "Failed to serialize payout summary", e);
        } catch (Exception e) {
            log.warn("get_owner_payout_summary failed: {}", e.getMessage());
            throw new ToolExecutionException(NAME,
                    "Resume des reversements indisponible (" + e.getMessage() + ")", e);
        }
    }

    private static boolean isUpcoming(PayoutStatus status) {
        return status == PayoutStatus.PENDING
                || status == PayoutStatus.APPROVED
                || status == PayoutStatus.PROCESSING;
    }

    private Map<String, Object> toItem(OwnerPayoutDto d, String currency) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", d.id());
        m.put("owner", d.ownerName());
        m.put("netAmount", round2(safeAmount(d.netAmount())));
        m.put("currency", currency);
        m.put("periodStart", d.periodStart() != null ? d.periodStart().toString() : null);
        m.put("periodEnd", d.periodEnd() != null ? d.periodEnd().toString() : null);
        m.put("status", d.status() != null ? d.status().name() : null);
        return m;
    }

    private static BigDecimal safeAmount(BigDecimal v) {
        return v != null ? v : BigDecimal.ZERO;
    }

    private static double round2(BigDecimal v) {
        return v.setScale(2, RoundingMode.HALF_UP).doubleValue();
    }

    private static ToolDescriptor buildDescriptor(ObjectMapper om) {
        try {
            JsonNode schema = om.readTree("""
                    {
                      "type": "object",
                      "properties": {},
                      "additionalProperties": false
                    }
                    """);
            return ToolDescriptor.readOnly(
                    NAME,
                    "Reversements proprietaires : a venir (en attente/approuves) et recents (verses), montants nets + totaux. Pour 'payouts', 'combien doit-on verser'.",
                    schema
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build schema for " + NAME, e);
        }
    }
}
