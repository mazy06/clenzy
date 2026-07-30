package com.clenzy.service.dashboard;

import com.clenzy.dto.DashboardOperationsDto.ActionItemDto;
import com.clenzy.dto.DashboardOperationsDto.ActionItemKind;
import com.clenzy.model.NoiseAlert;
import com.clenzy.repository.NoiseAlertRepository;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

/**
 * Alertes de bruit que personne n'a acquittées.
 *
 * <p>Le comptage existait déjà — un chiffre sur une pastille — mais aucune
 * liste : on savait qu'il y avait sept alertes sans jamais savoir lesquelles.
 * Une alerte de bruit non traitée, c'est un voisin qui appelle la mairie, et
 * dans certaines villes une amende.</p>
 */
@Component
public class NoiseAlertActionSource implements ActionItemSource {

    /** Une alerte de la nuit dernière n'est pas encore un oubli. */
    private static final int STALE_HOURS = 12;

    private final NoiseAlertRepository noiseAlertRepository;

    public NoiseAlertActionSource(NoiseAlertRepository noiseAlertRepository) {
        this.noiseAlertRepository = noiseAlertRepository;
    }

    @Override
    public Set<ActionItemKind> kinds() {
        return Set.of(ActionItemKind.NOISE_ALERT_UNACKNOWLEDGED);
    }

    @Override
    public Scope scope() {
        return Scope.BUSINESS;
    }

    @Override
    public List<ActionItemDto> collect(ActionItemContext ctx) {
        final LocalDateTime staleBefore = ctx.nowDateTime().minusHours(STALE_HOURS);

        return noiseAlertRepository
                .findByOrganizationIdAndAcknowledgedFalseAndCreatedAtBeforeOrderByCreatedAtAsc(
                        ctx.organizationId(), staleBefore)
                .stream()
                .filter(alert -> ctx.covers(alert.getProperty()))
                .map(alert -> new ActionItemDto(
                        "noise:" + alert.getId(),
                        ActionItemKind.NOISE_ALERT_UNACKNOWLEDGED,
                        alert.getSeverity() == NoiseAlert.AlertSeverity.CRITICAL ? "critical" : "warning",
                        "Alerte de bruit non acquittée",
                        alert.getTimeWindowLabel(),
                        null,
                        alert.getId(),
                        alert.getPropertyId(),
                        ActionItems.propertyName(alert.getProperty()),
                        null,
                        // Le niveau mesuré tient lieu de mention de fin de ligne :
                        // c'est lui qui dit si l'alerte est sérieuse.
                        Math.round(alert.getMeasuredDb()) + " dB",
                        null,
                        null))
                .toList();
    }
}
