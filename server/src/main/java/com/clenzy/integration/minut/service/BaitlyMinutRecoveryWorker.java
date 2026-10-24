package com.clenzy.integration.minut.service;

import com.clenzy.config.KafkaConfig;
import com.clenzy.model.AutomationTrigger;
import com.clenzy.model.NoiseAlert.AlertSource;
import com.clenzy.service.NoiseAlertService;
import com.clenzy.service.automation.*;
import com.clenzy.service.device.DeviceRealtimePublisher;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.TimeUnit;

import static com.clenzy.integration.minut.service.BaitlyMinutEventJournal.*;
import static com.clenzy.integration.minut.service.BaitlyMinutEventParser.*;

/** Resumes only stages with no prior external attempt. STARTED/UNKNOWN require reconciliation. */
@Service
public class BaitlyMinutRecoveryWorker {
    private static final Logger log = LoggerFactory.getLogger(BaitlyMinutRecoveryWorker.class);
    private final BaitlyMinutEventJournal journal;
    private final NoiseAlertService noise;
    private final AutomationEngine automation;
    private final DeviceRealtimePublisher realtime;
    private final KafkaTemplate<String,Object> kafka;

    public BaitlyMinutRecoveryWorker(BaitlyMinutEventJournal journal, NoiseAlertService noise,
                                    AutomationEngine automation, DeviceRealtimePublisher realtime, KafkaTemplate<String,Object> kafka) {
        this.journal=journal; this.noise=noise; this.automation=automation; this.realtime=realtime; this.kafka=kafka;
    }

    @Scheduled(fixedDelayString="${baitly.minut.recovery.delay-ms:30000}",initialDelayString="${baitly.minut.recovery.initial-delay-ms:30000}")
    @SchedulerLock(name="baitly-minut-recovery",lockAtMostFor="PT5M",lockAtLeastFor="PT1S")
    public void recover() {
        try {
            for (UUID id : journal.ready()) {
                if (Thread.currentThread().isInterrupted()) return;
                process(id);
            }
        } catch (RuntimeException failure) { log.error("Lecture du journal Minut indisponible"); }
    }

    public void process(UUID id) {
        for (int remaining=2; remaining>0; remaining--) {
            if (Thread.currentThread().isInterrupted()) return;
            Ticket ticket;
            try {
                var claimed=journal.claim(id);
                if (claimed.isEmpty()) return;
                ticket=claimed.get();
            } catch (RuntimeException failure) {
                log.error("Reprise Minut non demarree ; journal indisponible ou ressource modifiee");
                return;
            }
            try {
                execute(ticket);
                journal.complete(ticket);
            } catch (Exception failure) {
                if (failure instanceof InterruptedException) Thread.currentThread().interrupt();
                try { journal.uncertain(ticket); }
                catch (RuntimeException storageFailure) { log.error("Resultat Minut incertain ; tentative conservee"); }
                log.error("Etape Minut non confirmee ; aucun rejeu automatique");
                return;
            }
        }
    }

    private void execute(Ticket ticket) throws Exception {
        Event event=ticket.event();
        switch (ticket.step()) {
            case REALTIME -> realtime.publishDeviceChangedConfirmed(event.organization(),"noise",event.device(),
                    event.kind()==Kind.OFFLINE ? "hors ligne" : "de retour en ligne");
            case AUTOMATION -> {
                Map<String,Object> data=new HashMap<>();
                data.put("deviceId",event.device());
                if (ticket.deviceName()!=null) data.put(NotifyStaffExecutor.DATA_DEVICE_NAME,ticket.deviceName());
                data.put(AutomationSubject.DATA_PROPERTY_ID,event.property());
                data.put(NotifyStaffExecutor.DATA_OFFLINE_SINCE,event.occurredAt().toString());
                data.put("minutEventId",event.id().toString());
                // Completion means delegated to the engine; individual execution outcomes remain there.
                automation.fireTrigger(AutomationTrigger.IOT_DEVICE_OFFLINE,event.organization(),
                        new AutomationSubject(AutomationSubject.TYPE_IOT_DEVICE,event.device(),data));
            }
            case EVALUATION -> noise.evaluateNoiseLevel(event.organization(),event.property(),event.device(),event.measuredDb(),AlertSource.WEBHOOK);
            case NOISE_PUBLISH -> {
                Map<String,Object> data=Map.of("deviceId",event.device(),"propertyId",event.property(),
                        "soundLevel",event.measuredDb(),"source","MINUT_WEBHOOK","timestamp",event.occurredAt().toEpochMilli(),
                        "eventId",event.id().toString());
                Objects.requireNonNull(kafka.send(KafkaConfig.TOPIC_MINUT_NOISE_EVENTS,event.id().toString(),data).get(3,TimeUnit.SECONDS));
            }
        }
    }
}
