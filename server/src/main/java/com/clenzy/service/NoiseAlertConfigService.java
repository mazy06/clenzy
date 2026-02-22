package com.clenzy.service;

import com.clenzy.dto.noise.NoiseAlertConfigDto;
import com.clenzy.dto.noise.SaveNoiseAlertConfigDto;
import com.clenzy.model.NoiseAlertConfig;
import com.clenzy.model.NoiseAlertTimeWindow;
import com.clenzy.repository.NoiseAlertConfigRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

@Service
@Transactional
public class NoiseAlertConfigService {

    private static final Logger log = LoggerFactory.getLogger(NoiseAlertConfigService.class);

    private final NoiseAlertConfigRepository configRepository;

    public NoiseAlertConfigService(NoiseAlertConfigRepository configRepository) {
        this.configRepository = configRepository;
    }

    @Transactional(readOnly = true)
    public List<NoiseAlertConfigDto> getAllForOrg(Long orgId) {
        return configRepository.findByOrganizationId(orgId).stream()
            .map(NoiseAlertConfigDto::from)
            .toList();
    }

    @Transactional(readOnly = true)
    public NoiseAlertConfigDto getByProperty(Long orgId, Long propertyId) {
        return configRepository.findByOrgAndPropertyWithTimeWindows(orgId, propertyId)
            .map(NoiseAlertConfigDto::from)
            .orElse(null);
    }

    /**
     * Cree ou met a jour la configuration d'alertes pour une propriete.
     * Les time windows sont remplacees integralement (orphanRemoval).
     */
    public NoiseAlertConfigDto save(Long orgId, Long propertyId, SaveNoiseAlertConfigDto dto) {
        validateTimeWindows(dto.timeWindows());

        NoiseAlertConfig config = configRepository
            .findByOrganizationIdAndPropertyId(orgId, propertyId)
            .orElseGet(() -> {
                NoiseAlertConfig c = new NoiseAlertConfig();
                c.setOrganizationId(orgId);
                c.setPropertyId(propertyId);
                return c;
            });

        config.setEnabled(dto.enabled());
        config.setNotifyInApp(dto.notifyInApp());
        config.setNotifyEmail(dto.notifyEmail());
        config.setNotifyGuestMessage(dto.notifyGuestMessage());
        config.setNotifyWhatsapp(dto.notifyWhatsapp());
        config.setNotifySms(dto.notifySms());
        config.setCooldownMinutes(dto.cooldownMinutes());
        config.setEmailRecipients(dto.emailRecipients());

        // Remplacer les time windows
        config.getTimeWindows().clear();
        List<NoiseAlertTimeWindow> windows = new ArrayList<>();
        for (SaveNoiseAlertConfigDto.TimeWindowInput twInput : dto.timeWindows()) {
            NoiseAlertTimeWindow tw = new NoiseAlertTimeWindow();
            tw.setConfig(config);
            tw.setLabel(twInput.label());
            tw.setStartTime(LocalTime.parse(twInput.startTime()));
            tw.setEndTime(LocalTime.parse(twInput.endTime()));
            tw.setWarningThresholdDb(twInput.warningThresholdDb());
            tw.setCriticalThresholdDb(twInput.criticalThresholdDb());
            windows.add(tw);
        }
        config.getTimeWindows().addAll(windows);

        config = configRepository.save(config);
        log.info("Config alertes bruit sauvegardee pour property {} (orgId={})", propertyId, orgId);

        return NoiseAlertConfigDto.from(config);
    }

    public void delete(Long orgId, Long propertyId) {
        configRepository.findByOrganizationIdAndPropertyId(orgId, propertyId)
            .ifPresent(config -> {
                configRepository.delete(config);
                log.info("Config alertes bruit supprimee pour property {} (orgId={})", propertyId, orgId);
            });
    }

    private void validateTimeWindows(List<SaveNoiseAlertConfigDto.TimeWindowInput> windows) {
        for (SaveNoiseAlertConfigDto.TimeWindowInput tw : windows) {
            if (tw.criticalThresholdDb() <= tw.warningThresholdDb()) {
                throw new IllegalArgumentException(
                    "Le seuil critique (" + tw.criticalThresholdDb() +
                    " dB) doit etre superieur au seuil warning (" +
                    tw.warningThresholdDb() + " dB) pour le creneau '" + tw.label() + "'");
            }
        }
    }
}
