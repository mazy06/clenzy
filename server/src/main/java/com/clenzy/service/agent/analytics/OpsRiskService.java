package com.clenzy.service.agent.analytics;

import com.clenzy.dto.ChannelSyncHealthDto;
import com.clenzy.dto.PropertyDto;
import com.clenzy.model.Intervention;
import com.clenzy.model.InterventionStatus;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.service.ChannelSyncHealthService;
import com.clenzy.service.PropertyService;
import com.clenzy.tenant.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * Détection PROACTIVE d'anomalies opérationnelles à fenêtre courte (P0-3).
 *
 * <p>Couche analytique partagée (réutilisable hors LLM) : croise réservations,
 * interventions et santé de synchronisation pour remonter les risques qui
 * mènent à un mauvais avis / no-show / double-booking. Read-only, org-scopée.</p>
 *
 * <p>Détecte : (1) arrivée sans ménage prévu, (2) intervention en retard,
 * (3) synchronisation canal en retard.</p>
 */
@Service
public class OpsRiskService {

    private static final Logger log = LoggerFactory.getLogger(OpsRiskService.class);
    private static final int MAX_PROPERTIES = 50;
    private static final int LOOKBACK_DAYS = 30;

    /** Statuts d'intervention encore « ouverts » (non terminaux). */
    private static final Set<InterventionStatus> ACTIVE = EnumSet.of(
            InterventionStatus.PENDING,
            InterventionStatus.AWAITING_VALIDATION,
            InterventionStatus.IN_PROGRESS);

    private final InterventionRepository interventionRepository;
    private final ReservationRepository reservationRepository;
    private final ChannelSyncHealthService channelSyncHealthService;
    private final PropertyService propertyService;
    private final TenantContext tenantContext;
    private final Clock clock;

    public OpsRiskService(InterventionRepository interventionRepository,
                          ReservationRepository reservationRepository,
                          ChannelSyncHealthService channelSyncHealthService,
                          PropertyService propertyService,
                          TenantContext tenantContext,
                          Clock clock) {
        this.interventionRepository = interventionRepository;
        this.reservationRepository = reservationRepository;
        this.channelSyncHealthService = channelSyncHealthService;
        this.propertyService = propertyService;
        this.tenantContext = tenantContext;
        this.clock = clock;
    }

    /**
     * Un risque opérationnel détecté.
     *
     * @param type            MISSING_CLEANING | OVERDUE_INTERVENTION | STALE_CHANNEL_SYNC
     * @param severity        HIGH | MEDIUM | LOW
     * @param propertyId      logement concerné (nullable)
     * @param propertyName    nom du logement (nullable)
     * @param reservationId   réservation concernée (nullable)
     * @param message         libellé métier du risque
     * @param suggestedAction action recommandée (ce que l'agent propose)
     */
    public record OperationalRisk(
            String type,
            String severity,
            Long propertyId,
            String propertyName,
            Long reservationId,
            String message,
            String suggestedAction) {}

    /** Détecte les risques sur les {@code windowDays} prochains jours (borné 1..30). */
    @Transactional(readOnly = true)
    public List<OperationalRisk> detectRisks(int windowDays) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        LocalDateTime now = LocalDateTime.now(clock);
        LocalDate today = now.toLocalDate();
        int window = Math.max(1, Math.min(windowDays, 30));
        LocalDate windowEnd = today.plusDays(window);

        List<OperationalRisk> risks = new ArrayList<>();

        // Interventions du passé récent jusqu'à la fin de fenêtre (sert A et B).
        List<Intervention> interventions = interventionRepository.findAllByDateRange(
                now.minusDays(LOOKBACK_DAYS), windowEnd.atTime(LocalTime.MAX), orgId);

        // A) Interventions en retard (prévues avant maintenant, encore ouvertes).
        for (Intervention i : interventions) {
            if (i.getScheduledDate() != null && i.getScheduledDate().isBefore(now)
                    && ACTIVE.contains(i.getStatus())) {
                Property p = i.getProperty();
                risks.add(new OperationalRisk(
                        "OVERDUE_INTERVENTION", "MEDIUM",
                        p != null ? p.getId() : null,
                        p != null ? p.getName() : null,
                        null,
                        "Intervention « " + safe(i.getType()) + " » en retard (prévue le "
                                + i.getScheduledDate().toLocalDate() + ", statut " + i.getStatus() + ")",
                        "Réassigner ou clôturer l'intervention #" + i.getId()));
            }
        }

        // B) Arrivée sans ménage prévu avant le check-in.
        List<Reservation> upcoming = reservationRepository.findConfirmedByCheckInRange(today, windowEnd, orgId);
        for (Reservation r : upcoming) {
            Property p = r.getProperty();
            if (p == null || p.getId() == null || r.getCheckIn() == null) {
                continue;
            }
            Long pid = p.getId();
            LocalDate checkIn = r.getCheckIn();
            boolean hasCleaning = interventions.stream().anyMatch(i ->
                    i.getProperty() != null && pid.equals(i.getProperty().getId())
                            && isCleaning(i.getType())
                            && i.getStatus() != InterventionStatus.CANCELLED
                            && i.getScheduledDate() != null
                            && !i.getScheduledDate().toLocalDate().isBefore(checkIn.minusDays(1))
                            && !i.getScheduledDate().toLocalDate().isAfter(checkIn));
            if (!hasCleaning) {
                risks.add(new OperationalRisk(
                        "MISSING_CLEANING", "HIGH",
                        pid, p.getName(), r.getId(),
                        "Arrivée le " + checkIn + " (" + safe(r.getGuestName()) + ") sans ménage prévu",
                        "Planifier et assigner un ménage avant le " + checkIn));
            }
        }

        // C) Synchronisation canal en retard (best-effort, ne fait pas échouer le reste).
        try {
            Page<PropertyDto> page = propertyService.search(
                    PageRequest.of(0, MAX_PROPERTIES, Sort.by("name").ascending()),
                    null, null, null, null);
            List<Long> ids = page.getContent().stream().map(pp -> pp.id).filter(Objects::nonNull).toList();
            Map<Long, ChannelSyncHealthDto> health = channelSyncHealthService.getHealthByPropertyIds(ids);
            for (PropertyDto pp : page.getContent()) {
                ChannelSyncHealthDto h = health.get(pp.id);
                if (h != null && h.total() > 0 && h.synced() < h.total()) {
                    risks.add(new OperationalRisk(
                            "STALE_CHANNEL_SYNC", "MEDIUM",
                            pp.id, pp.name, null,
                            "Synchronisation canal en retard (" + h.synced() + "/" + h.total()
                                    + " canaux à jour)",
                            "Vérifier la connexion des canaux du logement"));
                }
            }
        } catch (Exception e) {
            log.debug("OpsRiskService: santé sync canal indisponible : {}", e.getMessage());
        }

        risks.sort(Comparator.comparingInt((OperationalRisk r) -> severityRank(r.severity())).reversed());
        return risks;
    }

    private static boolean isCleaning(String type) {
        if (type == null) {
            return false;
        }
        String t = type.toUpperCase();
        return t.contains("CLEAN") || t.contains("HOUSEKEEP") || t.contains("MENAGE") || t.contains("MÉNAGE");
    }

    private static int severityRank(String severity) {
        return switch (severity == null ? "" : severity) {
            case "HIGH" -> 3;
            case "MEDIUM" -> 2;
            case "LOW" -> 1;
            default -> 0;
        };
    }

    private static String safe(String s) {
        return s == null || s.isBlank() ? "—" : s;
    }
}
