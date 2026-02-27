package com.clenzy.service.messaging;

import com.clenzy.model.*;
import com.clenzy.repository.AutomationExecutionRepository;
import com.clenzy.repository.AutomationRuleRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class AutomationEvaluationService {

    private static final Logger log = LoggerFactory.getLogger(AutomationEvaluationService.class);

    private final AutomationRuleRepository ruleRepository;
    private final AutomationExecutionRepository executionRepository;
    private final GuestMessagingService messagingService;

    public AutomationEvaluationService(AutomationRuleRepository ruleRepository,
                                        AutomationExecutionRepository executionRepository,
                                        GuestMessagingService messagingService) {
        this.ruleRepository = ruleRepository;
        this.executionRepository = executionRepository;
        this.messagingService = messagingService;
    }

    @Transactional
    public void evaluateRulesForReservation(Reservation reservation, AutomationTrigger trigger, Long orgId) {
        List<AutomationRule> rules = ruleRepository
            .findByOrganizationIdAndTriggerTypeAndEnabledTrue(orgId, trigger);

        for (AutomationRule rule : rules) {
            if (executionRepository.existsByAutomationRuleIdAndReservationId(rule.getId(), reservation.getId())) {
                log.debug("Rule {} deja executee pour reservation {}", rule.getId(), reservation.getId());
                continue;
            }

            LocalDateTime scheduledAt = calculateScheduledTime(reservation, rule);

            AutomationExecution execution = new AutomationExecution();
            execution.setOrganizationId(orgId);
            execution.setAutomationRule(rule);
            execution.setReservation(reservation);
            execution.setScheduledAt(scheduledAt);

            if (scheduledAt.isBefore(LocalDateTime.now())) {
                executeAction(execution, rule, reservation, orgId);
            } else {
                execution.setStatus(AutomationExecutionStatus.PENDING);
                executionRepository.save(execution);
                log.info("Automation {} planifiee pour {} (reservation {})",
                    rule.getName(), scheduledAt, reservation.getId());
            }
        }
    }

    @Transactional
    public void processScheduledExecutions() {
        List<AutomationExecution> pending = executionRepository
            .findByStatusAndScheduledAtBefore(AutomationExecutionStatus.PENDING, LocalDateTime.now());

        for (AutomationExecution execution : pending) {
            AutomationRule rule = execution.getAutomationRule();
            Reservation reservation = execution.getReservation();
            executeAction(execution, rule, reservation, execution.getOrganizationId());
        }

        if (!pending.isEmpty()) {
            log.info("Traitement de {} executions d'automatisation planifiees", pending.size());
        }
    }

    private void executeAction(AutomationExecution execution, AutomationRule rule,
                                Reservation reservation, Long orgId) {
        try {
            if (rule.getTemplate() != null && rule.getActionType() == AutomationAction.SEND_MESSAGE) {
                messagingService.sendForReservation(reservation, rule.getTemplate(), orgId);
            }
            execution.setStatus(AutomationExecutionStatus.EXECUTED);
            execution.setExecutedAt(LocalDateTime.now());
            log.info("Automation {} executee pour reservation {}", rule.getName(), reservation.getId());
        } catch (Exception e) {
            execution.setStatus(AutomationExecutionStatus.FAILED);
            execution.setErrorMessage(e.getMessage());
            log.error("Erreur automation {} pour reservation {}: {}",
                rule.getName(), reservation.getId(), e.getMessage());
        }
        executionRepository.save(execution);
    }

    private LocalDateTime calculateScheduledTime(Reservation reservation, AutomationRule rule) {
        LocalDateTime baseDate;
        switch (rule.getTriggerType()) {
            case RESERVATION_CONFIRMED -> baseDate = LocalDateTime.now();
            case CHECK_IN_APPROACHING, CHECK_IN_DAY ->
                baseDate = reservation.getCheckIn() != null
                    ? reservation.getCheckIn().atStartOfDay() : LocalDateTime.now();
            case CHECK_OUT_DAY, CHECK_OUT_PASSED ->
                baseDate = reservation.getCheckOut() != null
                    ? reservation.getCheckOut().atStartOfDay() : LocalDateTime.now();
            case REVIEW_REMINDER ->
                baseDate = reservation.getCheckOut() != null
                    ? reservation.getCheckOut().atStartOfDay() : LocalDateTime.now();
            default -> baseDate = LocalDateTime.now();
        };

        LocalDateTime scheduled = baseDate.plusDays(rule.getTriggerOffsetDays());

        if (rule.getTriggerTime() != null) {
            String[] parts = rule.getTriggerTime().split(":");
            int hour = Integer.parseInt(parts[0]);
            int minute = parts.length > 1 ? Integer.parseInt(parts[1]) : 0;
            scheduled = scheduled.withHour(hour).withMinute(minute).withSecond(0);
        }

        return scheduled;
    }
}
