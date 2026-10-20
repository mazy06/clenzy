package com.clenzy.scheduler;

import com.clenzy.service.BaitlyCrmLocationBatches;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class BaitlyCrmLocationBatchScheduler {
    private static final Logger log=LoggerFactory.getLogger(BaitlyCrmLocationBatchScheduler.class);
    private final BaitlyCrmLocationBatches batches;
    public BaitlyCrmLocationBatchScheduler(BaitlyCrmLocationBatches batches){this.batches=batches;}
    @Scheduled(fixedDelayString="${baitly.crm.osm.batch-delay-ms:3000}",initialDelay=30000)
    public void process(){try{batches.tick();}catch(Exception e){log.warn("Baitly CRM location batch could not progress: {}",e.getClass().getSimpleName());}}
}
