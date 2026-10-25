package com.clenzy.integration.minut.service;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.clenzy.config.KafkaConfig;
import com.clenzy.model.AutomationTrigger;
import com.clenzy.service.NoiseAlertService;
import com.clenzy.service.automation.*;
import com.clenzy.service.device.DeviceRealtimePublisher;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static com.clenzy.integration.minut.service.BaitlyMinutEventJournal.*;
import static com.clenzy.integration.minut.service.BaitlyMinutEventParser.*;

class BaitlyMinutRecoveryWorkerTest {
    final BaitlyMinutEventJournal journal=mock(BaitlyMinutEventJournal.class);
    final NoiseAlertService noise=mock(NoiseAlertService.class);
    final AutomationEngine automation=mock(AutomationEngine.class);
    final DeviceRealtimePublisher realtime=mock(DeviceRealtimePublisher.class);
    @SuppressWarnings("unchecked") final KafkaTemplate<String,Object> kafka=mock(KafkaTemplate.class);
    final BaitlyMinutRecoveryWorker worker=new BaitlyMinutRecoveryWorker(journal,noise,automation,realtime,kafka);
    final UUID id=UUID.randomUUID();
    Ticket ticket(Kind kind,int next,Step step) {
        var event=new Event(id,7L,31L,91L,kind,kind==Kind.DISTURBANCE?82.5:null,true,next,"READY",Instant.parse("2026-10-23T10:01:00Z"),Instant.parse("2026-10-23T10:00:00Z"));
        return new Ticket(event,step,UUID.randomUUID(),"synthetic-private-device");
    }
    RuntimeException failure() {
        var value=new IllegalStateException("synthetic-private@example.invalid",new RuntimeException("synthetic-private"));
        value.addSuppressed(new RuntimeException("synthetic-private"));return value;
    }
    @Test void offlineStagesAreFencedThenConfirmedInOrder() {
        var first=ticket(Kind.OFFLINE,0,Step.REALTIME);var second=ticket(Kind.OFFLINE,1,Step.AUTOMATION);
        when(journal.claim(id)).thenReturn(Optional.of(first),Optional.of(second));
        worker.process(id);
        var order=inOrder(journal,realtime,automation);
        order.verify(journal).claim(id);
        order.verify(realtime).publishDeviceChangedConfirmed(7L,"noise",31L,"hors ligne");
        order.verify(journal).complete(first);order.verify(journal).claim(id);
        order.verify(automation).fireTrigger(eq(AutomationTrigger.IOT_DEVICE_OFFLINE),eq(7L),argThat(subject ->
                subject.subjectId().equals(31L) && subject.data().get("minutEventId").equals(id.toString())
                && subject.data().get(NotifyStaffExecutor.DATA_OFFLINE_SINCE).equals("2026-10-23T10:00:00Z")));
        order.verify(journal).complete(second);verify(journal,never()).uncertain(any());
    }
    @Test void resumedSecondStageNeverPublishesRealtimeAgain() {
        var next=ticket(Kind.OFFLINE,1,Step.AUTOMATION);
        when(journal.claim(id)).thenReturn(Optional.of(next),Optional.empty());worker.process(id);
        verifyNoInteractions(realtime,kafka,noise);verify(automation).fireTrigger(any(),eq(7L),any());verify(journal).complete(next);
    }
    @ParameterizedTest @ValueSource(strings={"realtime","automation","evaluation","confirmation","uncertainty-storage"})
    void partialOrUnknownEffectsNeverAdvanceOrExposePrivateDiagnostics(String failureAt) {
        boolean evaluation=failureAt.equals("evaluation");boolean automationFailure=failureAt.equals("automation");
        var value=ticket(evaluation?Kind.DISTURBANCE:Kind.OFFLINE,automationFailure?1:0,
                evaluation?Step.EVALUATION:automationFailure?Step.AUTOMATION:Step.REALTIME);
        when(journal.claim(id)).thenReturn(Optional.of(value));
        switch(failureAt) {
            case "automation" -> doThrow(failure()).when(automation).fireTrigger(any(),anyLong(),any());
            case "evaluation" -> when(noise.evaluateNoiseLevel(anyLong(),anyLong(),anyLong(),anyDouble(),any())).thenThrow(failure());
            case "confirmation" -> doThrow(failure()).when(journal).complete(value);
            default -> doThrow(failure()).when(realtime).publishDeviceChangedConfirmed(anyLong(),anyString(),anyLong(),anyString());
        }
        if(failureAt.equals("uncertainty-storage")) doThrow(failure()).when(journal).uncertain(value);
        var logger=(Logger)LoggerFactory.getLogger(BaitlyMinutRecoveryWorker.class);
        var logs=new ListAppender<ILoggingEvent>();logs.start();logger.addAppender(logs);
        try {
            worker.process(id);verify(journal).uncertain(value);verify(journal,times(1)).claim(id);
            if(!failureAt.equals("confirmation")) verify(journal,never()).complete(any());
            assertThat(logs.list).isNotEmpty().allSatisfy(event -> {
                assertThat(event.getFormattedMessage()).doesNotContain("synthetic-private","example.invalid");
                assertThat(event.getThrowableProxy()).isNull();
            });
        } finally {logger.detachAppender(logs);logs.stop();}
    }
    @Test void startedUnknownOrFinishedStagesAreNeverAttemptedAgain() {
        when(journal.claim(id)).thenReturn(Optional.empty());worker.process(id);
        verifyNoInteractions(realtime,automation,noise,kafka);verify(journal,never()).complete(any());
    }
    @Test void failedClaimCannotStartAnyExternalEffect() {
        when(journal.claim(id)).thenThrow(failure());worker.process(id);verifyNoInteractions(realtime,automation,noise,kafka);
    }
    @Test @SuppressWarnings("unchecked") void noisePublicationUsesStableKeyAndWaitsForAcknowledgement() throws Exception {
        var value=ticket(Kind.DISTURBANCE,1,Step.NOISE_PUBLISH);
        when(journal.claim(id)).thenReturn(Optional.of(value),Optional.empty());
        CompletableFuture<SendResult<String,Object>> future=mock(CompletableFuture.class);
        when(kafka.send(eq(KafkaConfig.TOPIC_MINUT_NOISE_EVENTS),eq(id.toString()),any())).thenReturn(future);
        when(future.get(3,TimeUnit.SECONDS)).thenReturn(mock(SendResult.class));worker.process(id);
        var order=inOrder(kafka,future,journal);
        order.verify(journal).claim(id);
        order.verify(kafka).send(eq(KafkaConfig.TOPIC_MINUT_NOISE_EVENTS),eq(id.toString()),argThat((Object raw) ->
                ((Map<?,?>)raw).get("eventId").equals(id.toString()) && ((Map<?,?>)raw).get("timestamp").equals(1792749600000L)));
        order.verify(future).get(3,TimeUnit.SECONDS);order.verify(journal).complete(value);
    }
    @ParameterizedTest @ValueSource(booleans={false,true}) @SuppressWarnings("unchecked")
    void uncertainNoisePublicationIsNotCancelledOrRepeated(boolean interrupted) throws Exception {
        var value=ticket(Kind.DISTURBANCE,1,Step.NOISE_PUBLISH);when(journal.claim(id)).thenReturn(Optional.of(value));
        CompletableFuture<SendResult<String,Object>> future=mock(CompletableFuture.class);
        when(kafka.send(anyString(),anyString(),any())).thenReturn(future);
        if(interrupted) when(future.get(3,TimeUnit.SECONDS)).thenThrow(new InterruptedException("synthetic-private"));
        else when(future.get(3,TimeUnit.SECONDS)).thenThrow(new TimeoutException("synthetic-private"));
        try {
            worker.process(id);verify(journal).uncertain(value);verify(journal,never()).complete(any());
            verify(kafka,times(1)).send(anyString(),anyString(),any());verify(future,never()).cancel(anyBoolean());
            assertThat(Thread.currentThread().isInterrupted()).isEqualTo(interrupted);
        } finally {Thread.interrupted();}
    }
    @Test void recoveryContinuesToNextReadyEventIfOneHasNoClaim() {
        UUID other=UUID.randomUUID();when(journal.ready()).thenReturn(List.of(id,other));
        when(journal.claim(any())).thenReturn(Optional.empty());worker.recover();verify(journal).claim(id);verify(journal).claim(other);
    }
}
