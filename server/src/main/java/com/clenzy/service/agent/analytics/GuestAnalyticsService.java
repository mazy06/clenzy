package com.clenzy.service.agent.analytics;

import com.clenzy.dto.GuestListDto;
import com.clenzy.service.GuestService;
import com.clenzy.tenant.TenantContext;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Segmentation des voyageurs (P1-6) — agent {@code com}.
 *
 * <p>Classe les guests en segments actionnables à partir de leur historique
 * (nb de séjours, dépense totale) : <b>NEW</b> (1 séjour), <b>REPEAT</b> (≥2),
 * <b>VIP</b> (dépense ≥ 2× la moyenne). Un guest peut porter plusieurs segments
 * (ex. REPEAT + VIP). Read-only, org-scopée. Premier apport d'ANALYSE pour
 * l'agent Communication (jusque-là purement transactionnel).</p>
 *
 * <p>Affinage futur : segment <b>AT_RISK</b> (churn) — nécessite la date du
 * dernier séjour, non exposée par {@link GuestListDto}.</p>
 */
@Service
public class GuestAnalyticsService {

    private static final double VIP_MULTIPLIER = 2.0;
    private static final int MAX_SAMPLES = 5;

    private final GuestService guestService;
    private final TenantContext tenantContext;

    public GuestAnalyticsService(GuestService guestService, TenantContext tenantContext) {
        this.guestService = guestService;
        this.tenantContext = tenantContext;
    }

    public record GuestSample(Long id, String name, int stays, BigDecimal totalSpent) {}

    public record Segment(String segment, int count, BigDecimal totalSpent,
                          BigDecimal avgSpent, List<GuestSample> samples) {}

    public record SegmentationResult(int totalGuests, BigDecimal vipThreshold,
                                     List<Segment> segments, String recommendation) {}

    public SegmentationResult segment() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        List<GuestListDto> guests = guestService.listGuests(orgId, null, null);

        if (guests.isEmpty()) {
            return new SegmentationResult(0, BigDecimal.ZERO, List.of(), "Aucun voyageur enregistré.");
        }

        // Seuil VIP = 2× la dépense moyenne (sur les guests ayant une dépense).
        BigDecimal spendSum = BigDecimal.ZERO;
        int spenders = 0;
        for (GuestListDto g : guests) {
            BigDecimal s = spent(g);
            if (s.signum() > 0) {
                spendSum = spendSum.add(s);
                spenders++;
            }
        }
        BigDecimal avgSpend = spenders > 0
                ? spendSum.divide(BigDecimal.valueOf(spenders), 2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;
        BigDecimal vipThreshold = avgSpend.multiply(BigDecimal.valueOf(VIP_MULTIPLIER))
                .setScale(2, RoundingMode.HALF_UP);

        Map<String, Acc> acc = new java.util.LinkedHashMap<>();
        acc.put("NEW", new Acc());
        acc.put("REPEAT", new Acc());
        acc.put("VIP", new Acc());

        for (GuestListDto g : guests) {
            int stays = g.totalStays() != null ? g.totalStays() : 0;
            BigDecimal s = spent(g);
            add(acc.get(stays >= 2 ? "REPEAT" : "NEW"), g, s);
            if (vipThreshold.signum() > 0 && s.compareTo(vipThreshold) >= 0) {
                add(acc.get("VIP"), g, s);
            }
        }

        List<Segment> segments = new ArrayList<>();
        for (Map.Entry<String, Acc> e : acc.entrySet()) {
            Acc a = e.getValue();
            if (a.count == 0) {
                continue;
            }
            BigDecimal avg = a.totalSpent.divide(BigDecimal.valueOf(a.count), 2, RoundingMode.HALF_UP);
            segments.add(new Segment(e.getKey(), a.count,
                    a.totalSpent.setScale(2, RoundingMode.HALF_UP), avg, a.samples));
        }

        return new SegmentationResult(guests.size(), vipThreshold, segments,
                recommend(acc));
    }

    private static String recommend(Map<String, Acc> acc) {
        int vip = acc.get("VIP").count;
        int repeat = acc.get("REPEAT").count;
        if (vip > 0) {
            return vip + " voyageur(s) VIP (dépense ≥ 2× la moyenne) : leur adresser un message "
                    + "premium ou un upsell ciblé.";
        }
        if (repeat > 0) {
            return repeat + " voyageur(s) fidèle(s) : envisager un programme de fidélité / une offre retour.";
        }
        return "Portefeuille majoritairement de nouveaux voyageurs — soigner la 1re expérience.";
    }

    private static void add(Acc a, GuestListDto g, BigDecimal s) {
        a.count++;
        a.totalSpent = a.totalSpent.add(s);
        if (a.samples.size() < MAX_SAMPLES) {
            a.samples.add(new GuestSample(g.id(), g.fullName(),
                    g.totalStays() != null ? g.totalStays() : 0, s));
        }
    }

    private static BigDecimal spent(GuestListDto g) {
        return g.totalSpent() != null ? g.totalSpent() : BigDecimal.ZERO;
    }

    private static final class Acc {
        int count;
        BigDecimal totalSpent = BigDecimal.ZERO;
        final List<GuestSample> samples = new ArrayList<>();
    }
}
