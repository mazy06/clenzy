package com.clenzy.scheduler;

import com.clenzy.marketplace.service.BaitlyNationalDirectorySync;
import com.clenzy.marketplace.service.BaitlyNationalOsmEnrichment;
import com.clenzy.marketplace.service.BaitlyDirectoryOsmStock;
import com.clenzy.marketplace.service.BaitlyAdemeRgeEnrichment;
import org.springframework.beans.factory.annotation.Value;
import java.nio.file.*;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;

/** Stock downloads must not occupy the shared Spring scheduler for several hours. */
@Component
public class BaitlyNationalDirectoryScheduler {
    private static final Logger log=LoggerFactory.getLogger(BaitlyNationalDirectoryScheduler.class);
    private final ExecutorService worker=Executors.newSingleThreadExecutor(Thread.ofPlatform().daemon().name("baitly-directory-stock").factory());
    private final AtomicBoolean running=new AtomicBoolean();
    private final BaitlyNationalDirectorySync sync;
    private final BaitlyNationalOsmEnrichment osm;
    private final Path snapshot;
    private final BaitlyDirectoryOsmStock stock;
    private final BaitlyAdemeRgeEnrichment rge;
    public BaitlyNationalDirectoryScheduler(BaitlyNationalDirectorySync sync,BaitlyNationalOsmEnrichment osm,BaitlyDirectoryOsmStock stock,BaitlyAdemeRgeEnrichment rge,
        @Value("${baitly.directory.national.osm-snapshot:/app/tmp/baitly-directory/osm.jsonl}") String snapshot){this.sync=sync;this.osm=osm;this.snapshot=Path.of(snapshot);this.stock=stock;this.rge=rge;}
    @Scheduled(fixedDelayString="${baitly.directory.national.check-ms:900000}",initialDelayString="${baitly.directory.national.initial-delay-ms:60000}")
    public void tick() {
        if(!running.compareAndSet(false,true))return;
        worker.submit(()->{try{
            sync.synchronize();
            if("COMPLETED".equals(sync.status().get("phase"))){
                try{log.info("Baitly ADEME RGE enrichment: {}",rge.enrich());}catch(Exception e){log.warn("Baitly ADEME RGE source unavailable; retaining previous contacts",e);}
                Path current=snapshot;
                try{current=stock.refresh(snapshot);}catch(Exception e){log.warn("Baitly shared OSM source unavailable; retaining local source",e);}
                if(Files.isRegularFile(current))log.info("Baitly national OSM enrichment: {}",osm.enrich(current));
            }
        }catch(Exception e){log.warn("Baitly national directory synchronization paused",e);}finally{running.set(false);}});
    }
    @PreDestroy public void close(){worker.shutdownNow();}
}
