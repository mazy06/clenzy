package com.clenzy.scheduler;

import com.clenzy.service.BaitlyCrmEnrichmentRuns;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class BaitlyCrmEnrichmentScheduler {
    private static final Logger log=LoggerFactory.getLogger(BaitlyCrmEnrichmentScheduler.class);
    private final BaitlyCrmEnrichmentRuns runs;
    public BaitlyCrmEnrichmentScheduler(BaitlyCrmEnrichmentRuns runs){this.runs=runs;}
    @Scheduled(fixedDelayString="${baitly.crm.enrichment.delay-ms:6000}",initialDelay=5000)
    public void process(){try{runs.tick();}catch(Exception e){log.warn("Baitly CRM enrichment could not progress: {}",e.getClass().getSimpleName());}}
}
