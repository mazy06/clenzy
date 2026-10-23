package com.clenzy.integration.minut.service;

import ch.qos.logback.classic.*;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.slf4j.LoggerFactory;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class BaitlyMinutConsumerPrivacyTest {
    static final String PRIVATE="synthetic-private-device guest@example.invalid";
    final ObjectMapper mapper=new ObjectMapper();
    final BaitlyMinutEventJournal journal=mock(BaitlyMinutEventJournal.class);
    final BaitlyMinutRecoveryWorker worker=mock(BaitlyMinutRecoveryWorker.class);
    final MinutWebhookConsumer consumer=new MinutWebhookConsumer(new BaitlyMinutEventParser(mapper),journal,worker);
    final Logger logger=(Logger)LoggerFactory.getLogger(MinutWebhookConsumer.class);
    final ListAppender<ILoggingEvent> logs=new ListAppender<>();
    Level previous;

    @BeforeEach void start() { previous=logger.getLevel();logger.setLevel(Level.DEBUG);logs.start();logger.addAppender(logs); }
    @AfterEach void close() {
        try {
            assertThat(logs.list).allSatisfy(event -> {
                assertThat(event.getFormattedMessage()).doesNotContain("synthetic-private","example.invalid","83.5");
                assertThat(event.getThrowableProxy()).isNull();
                if(event.getArgumentArray()!=null) assertThat(Arrays.toString(event.getArgumentArray())).doesNotContain(PRIVATE);
            });
        } finally {logger.detachAppender(logs);logger.setLevel(previous);logs.stop();}
    }
    String payload(String type,Object level) throws Exception {
        return mapper.writeValueAsString(Map.of("id",PRIVATE,"event_type",type,"device_id",PRIVATE,"sound_level",level,"created_at","2026-10-23T10:00:00Z"));
    }
    RuntimeException failure() {
        var value=new IllegalStateException(PRIVATE,new RuntimeException(PRIVATE));
        value.addSuppressed(new RuntimeException(PRIVATE));return value;
    }
    @ParameterizedTest @ValueSource(strings={"NaN","Infinity","-Infinity","1e309","0","-1"})
    void invalidLevelCannotTriggerAnyEffect(String level) throws Exception {
        consumer.handleMinutWebhook(payload("disturbance",level));verifyNoInteractions(journal,worker);
    }
    @ParameterizedTest @ValueSource(strings={"disturbance","device_offline","device_online"})
    void acceptedEventIsOnlyDelegatedAfterDurableAdmission(String type) throws Exception {
        UUID id=UUID.randomUUID();when(journal.admit(any())).thenReturn(id);
        consumer.handleMinutWebhook(payload(type,83.5));
        var order=inOrder(journal,worker);order.verify(journal).admit(any());order.verify(worker).process(id);
    }
    @Test void malformedPayloadDropsParserContextButIsNotSilentlyAcknowledged() {
        assertThatThrownBy(() -> consumer.handleMinutWebhook("{\"event_type\":\""+PRIVATE)).hasNoCause()
                .satisfies(error -> assertThat(error.getSuppressed()).isEmpty());
        assertThat(logs.list).isNotEmpty();verifyNoInteractions(journal,worker);
    }
    @Test void unknownTypeIsNeverCopiedIntoDebugLogs() throws Exception {
        consumer.handleMinutWebhook(payload(PRIVATE,83.5));verifyNoInteractions(journal,worker);
    }
    @Test void unknownDeviceFailureStaysPrivate() throws Exception {
        when(journal.admit(any())).thenThrow(failure());
        String payload=payload("disturbance",83.5);
        assertThatThrownBy(() -> consumer.handleMinutWebhook(payload)).hasNoCause().hasMessageContaining("non confirme");
        verifyNoInteractions(worker);
    }
    @Test void workerFailureNeverLeaksItsCauseToKafka() throws Exception {
        UUID id=UUID.randomUUID();when(journal.admit(any())).thenReturn(id);doThrow(failure()).when(worker).process(id);
        String payload=payload("disturbance",83.5);
        assertThatThrownBy(() -> consumer.handleMinutWebhook(payload)).hasNoCause()
                .satisfies(error -> assertThat(error.getSuppressed()).isEmpty());
        verify(journal,times(1)).admit(any());
    }
}
