package com.clenzy.service.messaging;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
public class AutomationSchedulerService {

    private static final Logger log = LoggerFactory.getLogger(AutomationSchedulerService.class);

    private final AutomationEvaluationService evaluationService;

    public AutomationSchedulerService(AutomationEvaluationService evaluationService) {
        this.evaluationService = evaluationService;
    }

    @Scheduled(cron = "0 0 * * * *") // Every hour
    public void processScheduledAutomations() {
        log.debug("Verification des automatisations planifiees...");
        evaluationService.processScheduledExecutions();
    }
}
