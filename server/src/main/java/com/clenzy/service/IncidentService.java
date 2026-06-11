package com.clenzy.service;

import com.clenzy.model.Incident;
import com.clenzy.model.Incident.IncidentSeverity;
import com.clenzy.model.Incident.IncidentStatus;
import com.clenzy.model.Incident.IncidentType;
import com.clenzy.model.NotificationKey;
import com.clenzy.repository.IncidentRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * Gestion du cycle de vie des incidents P1.
 *
 * Responsabilites :
 * - Ouverture d'incidents (deduplication par type + serviceName)
 * - Resolution automatique avec calcul du temps de resolution
 * - Statistiques de temps moyen de resolution P1
 * - Notification des SUPER_ADMIN/SUPER_MANAGER (cf. INCIDENT_OPENED/RESOLVED)
 *
 * Cross-org : pas de TenantContext, pas de filtre organisation.
 */
@Service
@Transactional
public class IncidentService {

    private static final Logger log = LoggerFactory.getLogger(IncidentService.class);

    private final IncidentRepository incidentRepository;
    /**
     * NotificationService injecte via ObjectProvider pour eviter un cycle
     * de dependances : NotificationService -> ... -> IncidentService au
     * boot. ObjectProvider resout lazy au 1er appel.
     */
    private final ObjectProvider<NotificationService> notificationServiceProvider;

    public IncidentService(IncidentRepository incidentRepository,
                           ObjectProvider<NotificationService> notificationServiceProvider) {
        this.incidentRepository = incidentRepository;
        this.notificationServiceProvider = notificationServiceProvider;
    }

    /**
     * Ouvre un incident si aucun incident OPEN n'existe deja pour le meme type + serviceName.
     */
    public Incident openIncident(IncidentType type, String serviceName,
                                  String title, String description) {
        Optional<Incident> existing = incidentRepository
                .findByTypeAndServiceNameAndStatus(type, serviceName, IncidentStatus.OPEN);

        if (existing.isPresent()) {
            log.debug("[Incident] Incident deja ouvert pour type={}, service={}", type, serviceName);
            return existing.get();
        }

        Incident incident = new Incident();
        incident.setType(type);
        incident.setServiceName(serviceName);
        incident.setTitle(title);
        incident.setDescription(description);
        incident.setAutoDetected(true);

        incident = incidentRepository.save(incident);
        log.warn("[Incident] Ouvert: type={}, service={}, title='{}'", type, serviceName, title);

        // Notifier les SUPER_ADMIN/SUPER_MANAGER de la plateforme.
        // Best-effort : si NotificationService throw, on log mais on garde
        // l'incident persiste (la creation prime sur la notification).
        try {
            String message = description != null && !description.isBlank()
                    ? description
                    : "Service " + serviceName + " indisponible.";
            notificationServiceProvider.ifAvailable(svc ->
                svc.notifyAllPlatformStaff(
                    NotificationKey.INCIDENT_OPENED,
                    title,
                    message,
                    "/admin/monitoring"
                )
            );
        } catch (Exception e) {
            log.error("[Incident] Erreur dispatch notification INCIDENT_OPENED : {}", e.getMessage());
        }

        return incident;
    }

    /**
     * Resout l'incident OPEN correspondant au type + serviceName.
     * Calcule le temps de resolution en minutes.
     */
    public void resolveIncident(IncidentType type, String serviceName) {
        Optional<Incident> opt = incidentRepository
                .findByTypeAndServiceNameAndStatus(type, serviceName, IncidentStatus.OPEN);

        if (opt.isEmpty()) {
            return;
        }

        Incident incident = opt.get();
        LocalDateTime now = LocalDateTime.now();
        incident.setStatus(IncidentStatus.RESOLVED);
        incident.setResolvedAt(now);
        incident.setAutoResolved(true);
        incident.setUpdatedAt(now);

        long durationMinutes = Duration.between(incident.getOpenedAt(), now).toMinutes();
        double fractionalMinutes = Duration.between(incident.getOpenedAt(), now).toMillis() / 60_000.0;
        incident.setResolutionMinutes(
                BigDecimal.valueOf(fractionalMinutes).setScale(2, RoundingMode.HALF_UP));

        incidentRepository.save(incident);
        log.warn("[Incident] Resolu: type={}, service={}, duration={}min",
                type, serviceName, durationMinutes);

        // Notifier les SUPER_ADMIN/SUPER_MANAGER de la resolution
        try {
            String title = "Incident resolu : " + (incident.getTitle() != null
                    ? incident.getTitle()
                    : serviceName);
            String message = String.format("Service %s a nouveau OK (duree : %d min)",
                    serviceName, durationMinutes);
            notificationServiceProvider.ifAvailable(svc ->
                svc.notifyAllPlatformStaff(
                    NotificationKey.INCIDENT_RESOLVED,
                    title,
                    message,
                    "/admin/monitoring"
                )
            );
        } catch (Exception e) {
            log.error("[Incident] Erreur dispatch notification INCIDENT_RESOLVED : {}", e.getMessage());
        }
    }

    /**
     * Retourne le temps moyen de resolution P1 sur les N derniers jours.
     * Retourne 0 si aucun incident P1 resolu dans la periode.
     */
    @Transactional(readOnly = true)
    public double getAverageP1ResolutionMinutes(int days) {
        LocalDateTime since = LocalDateTime.now().minusDays(days);
        return incidentRepository.avgP1ResolutionMinutesSince(since).orElse(0.0);
    }

    /**
     * Resout un incident specifique par son ID.
     * Utilisee lors du retest manuel d'un incident.
     */
    public void resolveIncidentById(Long incidentId) {
        Optional<Incident> opt = incidentRepository.findById(incidentId);
        if (opt.isEmpty()) {
            return;
        }

        Incident incident = opt.get();
        if (incident.getStatus() != IncidentStatus.OPEN) {
            return;
        }

        LocalDateTime now = LocalDateTime.now();
        incident.setStatus(IncidentStatus.RESOLVED);
        incident.setResolvedAt(now);
        incident.setAutoResolved(false);
        incident.setUpdatedAt(now);

        double fractionalMinutes = Duration.between(incident.getOpenedAt(), now).toMillis() / 60_000.0;
        incident.setResolutionMinutes(
                BigDecimal.valueOf(fractionalMinutes).setScale(2, RoundingMode.HALF_UP));

        incidentRepository.save(incident);
        log.info("[Incident] Resolu manuellement (retest): id={}, service={}",
                incidentId, incident.getServiceName());
    }

    /**
     * Retourne tous les incidents actuellement ouverts.
     */
    @Transactional(readOnly = true)
    public List<Incident> getOpenIncidents() {
        return incidentRepository.findByStatus(IncidentStatus.OPEN);
    }

    /**
     * Recherche d'incidents pour le listing admin.
     *
     * <p>Regles metier :</p>
     * <ul>
     *   <li>{@code status == OPEN} : tous les OPEN, peu importe leur age — sinon
     *       les incidents stuck (config retiree, scheduler en panne) disparaissent
     *       du tableau de bord alors qu'ils continuent a polluer les KPI.</li>
     *   <li>{@code status != null} : incidents de ce statut ouverts apres
     *       {@code since}.</li>
     *   <li>{@code status == null} : mix — tous les OPEN (sans limite d'age) +
     *       les incidents actifs dans la fenetre ('actif' = ouvert OU resolu
     *       dans la periode, necessaire pour visualiser les RESOLVED qui
     *       contribuent encore a la moyenne KPI P1).</li>
     *   <li>Le filtre {@code severity} inclut les incidents a severity null
     *       (legacy, avant introduction du champ) — sinon un vieil incident
     *       polluant le KPI P1 reste invisible.</li>
     * </ul>
     */
    @Transactional(readOnly = true)
    public List<Incident> searchIncidents(IncidentStatus status, IncidentSeverity severity,
                                          LocalDateTime since) {
        List<Incident> incidents;
        if (status == IncidentStatus.OPEN) {
            incidents = incidentRepository.findByStatusOrderByOpenedAtDesc(IncidentStatus.OPEN);
        } else if (status != null) {
            incidents = incidentRepository
                    .findByStatusAndOpenedAtAfterOrderByOpenedAtDesc(status, since);
        } else {
            List<Incident> openAll = incidentRepository
                    .findByStatusOrderByOpenedAtDesc(IncidentStatus.OPEN);
            List<Incident> activeNonOpen = incidentRepository
                    .findActiveSince(since)
                    .stream()
                    .filter(i -> i.getStatus() != IncidentStatus.OPEN)
                    .toList();
            List<Incident> merged = new ArrayList<>(openAll.size() + activeNonOpen.size());
            merged.addAll(openAll);
            merged.addAll(activeNonOpen);
            incidents = merged;
        }

        if (severity != null) {
            incidents = incidents.stream()
                    .filter(i -> i.getSeverity() == null || i.getSeverity() == severity)
                    .toList();
        }
        return incidents;
    }

    /**
     * Nombre d'incidents OPEN, optionnellement filtre par severite
     * ({@code null} = toutes severites).
     */
    @Transactional(readOnly = true)
    public long countOpenIncidents(IncidentSeverity severity) {
        return severity != null
                ? incidentRepository.countByStatusAndSeverity(IncidentStatus.OPEN, severity)
                : incidentRepository.countByStatus(IncidentStatus.OPEN);
    }

    /**
     * Incident par id. Entite plateforme cross-org (pas d'organization_id) :
     * la restriction d'acces est portee par le {@code @PreAuthorize} admin
     * du controller.
     */
    @Transactional(readOnly = true)
    public Optional<Incident> findIncident(Long incidentId) {
        return incidentRepository.findById(incidentId);
    }

    /**
     * Hard-delete an incident from the DB.
     *
     * <p>Use case: an incident that's been stuck OPEN for hours/days due to a config
     * change (service removed locally), or an old RESOLVED incident with a long duration
     * polluting the {@code P1 Incident Resolution} KPI average. Once deleted, it no longer
     * counts in the count badge or in the 30-day average.</p>
     *
     * <p>Safer alternative to manual SQL — keeps the operation behind the same
     * SUPER_ADMIN authorization as the rest of the incident controller.</p>
     *
     * @return {@code true} if an incident was deleted, {@code false} if not found.
     */
    public boolean deleteIncident(Long incidentId) {
        Optional<Incident> opt = incidentRepository.findById(incidentId);
        if (opt.isEmpty()) return false;
        Incident incident = opt.get();
        incidentRepository.deleteById(incidentId);
        log.warn("[Incident] Supprime: id={}, type={}, service={}, status={}",
                incidentId, incident.getType(), incident.getServiceName(), incident.getStatus());
        return true;
    }
}
