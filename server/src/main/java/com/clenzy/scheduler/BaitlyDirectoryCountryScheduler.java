package com.clenzy.scheduler;

import com.clenzy.marketplace.service.BaitlyDirectoryCountrySync;
import jakarta.annotation.PreDestroy;
import org.slf4j.*;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;

/** Dedicated workers follow the existing French scheduler without starving its stock job. */
@Component
public class BaitlyDirectoryCountryScheduler {
    private static final Logger log=LoggerFactory.getLogger(BaitlyDirectoryCountryScheduler.class);
    private final BaitlyDirectoryCountrySync sync;
    private final ExecutorService worker=Executors.newFixedThreadPool(2,Thread.ofPlatform().daemon().name("baitly-country-stock-",0).factory());
    private final ConcurrentHashMap<String,AtomicBoolean> running=new ConcurrentHashMap<>();
    public BaitlyDirectoryCountryScheduler(BaitlyDirectoryCountrySync sync){this.sync=sync;}
    @Scheduled(fixedDelayString="${baitly.directory.countries.check-ms:60000}",initialDelayString="${baitly.directory.countries.initial-delay-ms:60000}")
    public void tick(){for(String country:java.util.List.of("MA","SA")){
        var active=running.computeIfAbsent(country,k->new AtomicBoolean());if(!active.compareAndSet(false,true))continue;
        worker.submit(()->{try{sync.synchronize(country);}catch(Exception unavailable){log.warn("Baitly {} directory synchronization paused ({}); published records retained, retry scheduled",country,BaitlyDirectoryCountrySync.sourceFailureCode(unavailable));}finally{active.set(false);}});
    }}
    @PreDestroy public void close(){worker.shutdownNow();}
}
