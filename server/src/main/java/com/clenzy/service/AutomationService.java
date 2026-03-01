package com.clenzy.service;

import com.clenzy.dto.AutomationTriggerDto;
import com.clenzy.model.ExternalAutomation;
import com.clenzy.model.ExternalAutomation.AutomationEvent;
import com.clenzy.model.ExternalAutomation.AutomationPlatform;
import com.clenzy.repository.ExternalAutomationRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;

@Service
@Transactional(readOnly = true)
public class AutomationService {

    private static final Logger log = LoggerFactory.getLogger(AutomationService.class);

    private final ExternalAutomationRepository triggerRepository;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public AutomationService(ExternalAutomationRepository triggerRepository,
                              ObjectMapper objectMapper) {
        this.triggerRepository = triggerRepository;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();
    }

    public List<AutomationTriggerDto> getAllTriggers(Long orgId) {
        return triggerRepository.findAllByOrgId(orgId).stream()
            .map(AutomationTriggerDto::from)
            .toList();
    }

    public AutomationTriggerDto getById(Long id, Long orgId) {
        return triggerRepository.findByIdAndOrgId(id, orgId)
            .map(AutomationTriggerDto::from)
            .orElseThrow(() -> new IllegalArgumentException("Trigger not found: " + id));
    }

    @Transactional
    public AutomationTriggerDto createTrigger(String name, AutomationPlatform platform,
                                               AutomationEvent event, String callbackUrl, Long orgId) {
        ExternalAutomation trigger = new ExternalAutomation();
        trigger.setOrganizationId(orgId);
        trigger.setTriggerName(name);
        trigger.setPlatform(platform);
        trigger.setTriggerEvent(event);
        trigger.setCallbackUrl(callbackUrl);
        trigger.setIsActive(true);

        ExternalAutomation saved = triggerRepository.save(trigger);
        log.info("Created {} trigger '{}' for event {} org {}",
            platform, name, event, orgId);
        return AutomationTriggerDto.from(saved);
    }

    @Transactional
    public void deleteTrigger(Long id, Long orgId) {
        ExternalAutomation trigger = triggerRepository.findByIdAndOrgId(id, orgId)
            .orElseThrow(() -> new IllegalArgumentException("Trigger not found: " + id));
        triggerRepository.delete(trigger);
        log.info("Deleted trigger {} for org {}", id, orgId);
    }

    @Transactional
    public AutomationTriggerDto toggleTrigger(Long id, Long orgId) {
        ExternalAutomation trigger = triggerRepository.findByIdAndOrgId(id, orgId)
            .orElseThrow(() -> new IllegalArgumentException("Trigger not found: " + id));
        trigger.setIsActive(!Boolean.TRUE.equals(trigger.getIsActive()));
        ExternalAutomation saved = triggerRepository.save(trigger);
        return AutomationTriggerDto.from(saved);
    }

    @Transactional
    public int fireEvent(AutomationEvent event, Object payload, Long orgId) {
        List<ExternalAutomation> triggers = triggerRepository.findActiveByEvent(event, orgId);
        int fired = 0;

        for (ExternalAutomation trigger : triggers) {
            try {
                String body = objectMapper.writeValueAsString(Map.of(
                    "trigger", event.name(),
                    "platform", trigger.getPlatform().name(),
                    "timestamp", Instant.now().toString(),
                    "data", payload
                ));

                HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(trigger.getCallbackUrl()))
                    .header("Content-Type", "application/json")
                    .timeout(Duration.ofSeconds(15))
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();

                HttpResponse<String> response = httpClient.send(request,
                    HttpResponse.BodyHandlers.ofString());

                if (response.statusCode() >= 200 && response.statusCode() < 300) {
                    trigger.setLastTriggeredAt(Instant.now());
                    trigger.setTriggerCount(trigger.getTriggerCount() + 1);
                    triggerRepository.save(trigger);
                    fired++;
                } else {
                    log.warn("Trigger {} failed with HTTP {}", trigger.getId(), response.statusCode());
                }
            } catch (Exception e) {
                log.warn("Failed to fire trigger {}: {}", trigger.getId(), e.getMessage());
            }
        }

        return fired;
    }
}
