package com.clenzy.service;

import com.clenzy.model.NoiseAlert;
import com.clenzy.repository.NoiseAlertConfigRepository;
import com.clenzy.repository.NoiseAlertRepository;
import com.clenzy.repository.PropertyRepository;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.function.Supplier;

/** Baitly: resumes work that was never attempted, never an uncertain external effect. */
@Component
public class BaitlyNoiseDeliveryWorker {
    private static final Logger log=LoggerFactory.getLogger(BaitlyNoiseDeliveryWorker.class);
    private final BaitlyNoiseDeliveryOutbox outbox;
    private final NoiseAlertNotificationService notifications;
    private final NoiseAlertRepository alerts;
    private final NoiseAlertConfigRepository configs;
    private final PropertyRepository properties;
    private final TransactionTemplate read;
    private final TransactionTemplate outside;

    public BaitlyNoiseDeliveryWorker(BaitlyNoiseDeliveryOutbox outbox,NoiseAlertNotificationService notifications,
            NoiseAlertRepository alerts,NoiseAlertConfigRepository configs,PropertyRepository properties,
            PlatformTransactionManager manager) {
        this.outbox=outbox;this.notifications=notifications;this.alerts=alerts;this.configs=configs;this.properties=properties;
        read=new TransactionTemplate(manager);read.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        read.setReadOnly(true);read.setTimeout(10);
        outside=new TransactionTemplate(manager);outside.setPropagationBehavior(TransactionDefinition.PROPAGATION_NOT_SUPPORTED);
    }
    record Prepared(BaitlyNoiseDeliveryOutbox.Snapshot scope,NoiseAlert alert,Runnable email,Supplier<Boolean> inApp) {}

    @Scheduled(fixedDelayString="${baitly.noise.delivery-ms:5000}",initialDelayString="${baitly.noise.delivery-initial-ms:30000}")
    @SchedulerLock(name="baitly-noise-delivery",lockAtMostFor="PT15M",lockAtLeastFor="PT1S")
    public void run() {
        try {
            outside.executeWithoutResult(ignored -> {
                try {outbox.repair();} catch(RuntimeException failure) {log.warn("Baitly bruit : reparation de delegation indisponible");}
                for(var work:outbox.pending()) process(work);
            });
        } catch(RuntimeException failure) {log.warn("Baitly bruit : file de delegation indisponible");}
    }
    void process(BaitlyNoiseDeliveryOutbox.Work work) {
        try {
            Prepared prepared=read.execute(status -> prepare(work));
            if(prepared==null) {outbox.skip(work);return;}
            switch(work.channel()) {
                case "GUEST" -> {
                    notifications.sendQueuedGuestWarning(prepared.alert(),prepared.scope());
                    outbox.finishGuest(work);
                    outbox.defer(work); // Only still-PENDING work; no attempt/proof is ever cleared.
                }
                case "OWNER_IN_APP" -> {
                    if(prepared.inApp()==null) outbox.skip(work);
                    else outbox.persistInApp(work,prepared.inApp());
                }
                case "OWNER_EMAIL" -> {
                    if(prepared.email()==null) {outbox.skip(work);return;}
                    var attempt=outbox.startEmail(work);
                    if(attempt.isEmpty()) return;
                    try {
                        prepared.email().run(); // Outside every SQL/JPA transaction and lock.
                        outbox.finishEmail(work,attempt.orElseThrow(),true);
                    } catch(RuntimeException uncertain) {
                        // If ACCEPTED committed but its acknowledgement was lost, this cannot downgrade it.
                        outbox.finishEmail(work,attempt.orElseThrow(),false);
                    }
                }
                default -> throw new IllegalStateException("Canal de delegation inconnu");
            }
            outbox.repair();
        } catch(RuntimeException failure) {
            log.warn("Baitly bruit : delegation non confirmee");
            try {outbox.defer(work);} catch(RuntimeException storageFailure) {log.warn("Baitly bruit : report de delegation indisponible");}
        }
    }
    private Prepared prepare(BaitlyNoiseDeliveryOutbox.Work work) {
        var scope=outbox.snapshot(work);
        if(scope.isEmpty()) return null;
        NoiseAlert alert=alerts.findById(work.alert()).orElse(null);
        if(alert==null || !work.organization().equals(alert.getOrganizationId())) return null;
        if(work.channel().equals("GUEST")) return new Prepared(scope.orElseThrow(),alert,null,null);
        var config=configs.findById(scope.orElseThrow().config()).orElse(null);
        var property=properties.findById(alert.getPropertyId()).orElse(null);
        if(config==null || property==null || !work.organization().equals(config.getOrganizationId())
                || !work.organization().equals(property.getOrganizationId()) || !property.getId().equals(config.getPropertyId())) return null;
        return new Prepared(scope.orElseThrow(),alert,
            work.channel().equals("OWNER_EMAIL") ? notifications.prepareOwnerEmail(alert,config,property,work.ordinal()) : null,
            work.channel().equals("OWNER_IN_APP") ? notifications.prepareOwnerInApp(alert,property) : null);
    }
}
