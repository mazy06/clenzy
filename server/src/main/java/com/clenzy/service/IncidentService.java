package com.clenzy.service;

import com.clenzy.model.Incident;
import com.clenzy.model.Incident.IncidentStatus;
import com.clenzy.model.Incident.IncidentType;
import com.clenzy.repository.IncidentRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Gestion du cycle de vie des incidents P1.
 *
 * Responsabilites :
 * - Ouverture d'incidents (deduplication par type + serviceName)
 * - Resolution automatique avec calcul du temps de resolution
 * - Statistiques de temps moyen de resolution P1
 *
 * Cross-org : pas de TenantContext, pas de filtre organisation.
 */
@Service
@Transactional
public class IncidentService {

    private static final Logger log = LoggerFactory.getLogger(IncidentService.class);

    private final IncidentRepository incidentRepository;

    public IncidentService(IncidentRepository incidentRepository) {
        this.incidentRepository = incidentRepository;
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
     * Retourne tous les incidents actuellement ouverts.
     */
    @Transactional(readOnly = true)
    public List<Incident> getOpenIncidents() {
        return incidentRepository.findByStatus(IncidentStatus.OPEN);
    }
}
