package com.clenzy.service.agent.analytics;

import com.clenzy.model.Intervention;
import com.clenzy.model.InterventionStatus;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.tenant.TenantContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Maintenance PRÉDICTIVE (P2-10) — agent {@code ops}.
 *
 * <p>v1 déterministe : estime le risque de maintenance par logement à partir de
 * l'ancienneté du dernier entretien et de l'<b>usure</b> (nuits-voyageurs depuis).
 * But : intervenir AVANT la panne / le mauvais avis. Read-only, org-scopée.</p>
 *
 * <p>Affinage futur : signaux capteurs (température/humidité), modèle appris.</p>
 */
@Service
public class ProactiveMaintenanceService {

    private static final int LOOKBACK_MONTHS = 24;
    private static final int HIGH_NIGHTS = 180;
    private static final int MED_NIGHTS = 90;
    private static final long HIGH_DAYS = 365;
    private static final long MED_DAYS = 180;
    private static final int NEVER_HIGH_NIGHTS = 120;

    private final ReservationRepository reservationRepository;
    private final InterventionRepository interventionRepository;
    private final TenantContext tenantContext;
    private final Clock clock;

    public ProactiveMaintenanceService(ReservationRepository reservationRepository,
                                       InterventionRepository interventionRepository,
                                       TenantContext tenantContext,
                                       Clock clock) {
        this.reservationRepository = reservationRepository;
        this.interventionRepository = interventionRepository;
        this.tenantContext = tenantContext;
        this.clock = clock;
    }

    public record MaintenanceRisk(
            Long propertyId, String propertyName, String riskLevel,
            Long daysSinceLastMaintenance, int guestNightsSinceLastMaintenance,
            String lastMaintenanceDate, String reason) {}

    public record MaintenanceForecastResult(int lookbackMonths, int count, List<MaintenanceRisk> atRisk) {}

    @Transactional(readOnly = true)
    public MaintenanceForecastResult predict() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        LocalDate today = LocalDate.now(clock);
        LocalDate start = today.minusMonths(LOOKBACK_MONTHS);

        // 1) Dernier entretien (maintenance COMPLETED) par logement + noms.
        Map<Long, PropAcc> acc = new LinkedHashMap<>();
        for (Intervention i : interventionRepository.findAllByDateRange(
                start.atStartOfDay(), today.atTime(LocalTime.MAX), orgId)) {
            Property p = i.getProperty();
            if (p == null || p.getId() == null) {
                continue;
            }
            PropAcc a = accFor(acc, p);
            if (i.getStatus() == InterventionStatus.COMPLETED && isMaintenance(i.getType())
                    && i.getCompletedAt() != null) {
                LocalDate d = i.getCompletedAt().toLocalDate();
                if (a.lastMaintenance == null || d.isAfter(a.lastMaintenance)) {
                    a.lastMaintenance = d;
                }
            }
        }

        // 2) Nuits-voyageurs (total et depuis le dernier entretien) par logement.
        for (Reservation r : reservationRepository.findAllByDateRange(start, today, orgId)) {
            if ("cancelled".equalsIgnoreCase(r.getStatus()) || r.getProperty() == null
                    || r.getCheckIn() == null || r.getCheckOut() == null) {
                continue;
            }
            PropAcc a = accFor(acc, r.getProperty());
            int nights = (int) Math.max(0, ChronoUnit.DAYS.between(r.getCheckIn(), r.getCheckOut()));
            a.totalNights += nights;
            if (a.lastMaintenance == null || r.getCheckOut().isAfter(a.lastMaintenance)) {
                // Séjour à cheval sur l'entretien : ne compter que les nuits POSTÉRIEURES à l'entretien.
                LocalDate effStart = (a.lastMaintenance != null && r.getCheckIn().isBefore(a.lastMaintenance))
                        ? a.lastMaintenance : r.getCheckIn();
                a.nightsSince += (int) Math.max(0, ChronoUnit.DAYS.between(effStart, r.getCheckOut()));
            }
        }

        List<MaintenanceRisk> risks = new ArrayList<>();
        for (PropAcc a : acc.values()) {
            Long daysSince = a.lastMaintenance != null
                    ? ChronoUnit.DAYS.between(a.lastMaintenance, today) : null;
            String level = riskLevel(a, daysSince);
            if (level == null) {
                continue;
            }
            risks.add(new MaintenanceRisk(a.id, a.name, level, daysSince, a.nightsSince,
                    a.lastMaintenance != null ? a.lastMaintenance.toString() : null,
                    reason(a, daysSince, level)));
        }
        risks.sort(Comparator.comparingInt((MaintenanceRisk r) -> rank(r.riskLevel())).reversed());

        return new MaintenanceForecastResult(LOOKBACK_MONTHS, risks.size(), risks);
    }

    private static String riskLevel(PropAcc a, Long daysSince) {
        boolean neverMaintained = a.lastMaintenance == null;
        if (a.nightsSince >= HIGH_NIGHTS
                || (daysSince != null && daysSince >= HIGH_DAYS)
                || (neverMaintained && a.totalNights >= NEVER_HIGH_NIGHTS)) {
            return "HIGH";
        }
        if (a.nightsSince >= MED_NIGHTS || (daysSince != null && daysSince >= MED_DAYS)) {
            return "MEDIUM";
        }
        return null;
    }

    private static String reason(PropAcc a, Long daysSince, String level) {
        if (a.lastMaintenance == null) {
            return "Aucun entretien enregistré, " + a.totalNights + " nuits-voyageurs cumulées.";
        }
        return "Dernier entretien il y a " + daysSince + " j, " + a.nightsSince
                + " nuits-voyageurs depuis — maintenance préventive recommandée (" + level + ").";
    }

    private static PropAcc accFor(Map<Long, PropAcc> map, Property p) {
        return map.computeIfAbsent(p.getId(), k -> {
            PropAcc a = new PropAcc();
            a.id = p.getId();
            a.name = p.getName();
            return a;
        });
    }

    private static boolean isMaintenance(String type) {
        if (type == null) {
            return false;
        }
        String t = type.toUpperCase();
        return t.contains("MAINTEN") || t.contains("REPAIR") || t.contains("PLUMB")
                || t.contains("ELECTR") || t.contains("PLOMB");
    }

    private static int rank(String level) {
        return "HIGH".equals(level) ? 2 : "MEDIUM".equals(level) ? 1 : 0;
    }

    private static final class PropAcc {
        Long id;
        String name;
        LocalDate lastMaintenance;
        int totalNights;
        int nightsSince;
    }
}
