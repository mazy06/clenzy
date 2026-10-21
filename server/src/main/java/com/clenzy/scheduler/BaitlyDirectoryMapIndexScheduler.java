package com.clenzy.scheduler;
import com.clenzy.marketplace.service.BaitlyDirectoryMapIndex;
import jakarta.annotation.PreDestroy;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.slf4j.LoggerFactory;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;

/** A long source download must never delay the independent map read-model publisher. */
@Component
public class BaitlyDirectoryMapIndexScheduler {
    private final BaitlyDirectoryMapIndex index;
    private final AtomicBoolean running=new AtomicBoolean();
    private final ExecutorService worker=Executors.newSingleThreadExecutor(Thread.ofPlatform().daemon().name("baitly-map-index").factory());
    public BaitlyDirectoryMapIndexScheduler(BaitlyDirectoryMapIndex index){this.index=index;}
    @Scheduled(fixedDelayString="${baitly.directory.map.index-check-ms:60000}",initialDelayString="${baitly.directory.map.index-delay-ms:15000}")
    public void tick(){if(!running.compareAndSet(false,true))return;worker.submit(()->{
        try{index.rebuild();}catch(Exception e){LoggerFactory.getLogger(getClass()).warn("Baitly map index refresh deferred; keeping the live query fallback",e);}
        finally{running.set(false);}
    });}
    @PreDestroy public void close(){worker.shutdownNow();}
}
