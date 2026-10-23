package com.clenzy.integration.minut.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class MinutWebhookConsumerTest {
    final BaitlyMinutEventJournal journal=mock(BaitlyMinutEventJournal.class);
    final BaitlyMinutRecoveryWorker worker=mock(BaitlyMinutRecoveryWorker.class);
    final MinutWebhookConsumer consumer=new MinutWebhookConsumer(new BaitlyMinutEventParser(new ObjectMapper()),journal,worker);

    @Test void whenDisturbanceEvent_thenEvaluatesAfterDurableAdmission() {
        UUID id=UUID.randomUUID(); when(journal.admit(any())).thenReturn(id);
        consumer.handleMinutWebhook("{\"id\":\"test-1\",\"event_type\":\"disturbance\",\"device_id\":\"d1\",\"sound_level\":82.5,\"created_at\":\"2026-10-23T10:00:00Z\"}");
        var order=inOrder(journal,worker);
        order.verify(journal).admit(argThat(input -> input.kind()==BaitlyMinutEventParser.Kind.DISTURBANCE && input.measuredDb()==82.5));
        order.verify(worker).process(id);
    }
    @Test void whenOfflineEvent_thenJournalOwnsTheTransition() {
        when(journal.admit(any())).thenReturn(UUID.randomUUID());
        consumer.handleMinutWebhook("{\"id\":\"test-2\",\"event_type\":\"device_offline\",\"device_id\":\"d1\",\"created_at\":\"2026-10-23T10:00:00Z\"}");
        verify(journal).admit(argThat(input -> input.kind()==BaitlyMinutEventParser.Kind.OFFLINE));
        verify(worker).process(any());
    }
    @Test void whenUnknownDevice_thenNoAcknowledgementWithoutAdmission() {
        when(journal.admit(any())).thenThrow(new IllegalStateException("synthetic-private"));
        assertThatThrownBy(() -> consumer.handleMinutWebhook("{\"id\":\"test-3\",\"event_type\":\"disturbance\",\"device_id\":\"unknown\",\"sound_level\":80,\"created_at\":\"2026-10-23T10:00:00Z\"}"))
                .hasNoCause().hasMessageContaining("non confirme");
        verifyNoInteractions(worker);
    }
    @Test void whenInvalidPayload_thenKafkaMayRetryOrQuarantine() {
        assertThatThrownBy(() -> consumer.handleMinutWebhook("not-valid-json")).hasNoCause();
        verifyNoInteractions(journal,worker);
    }
    @Test void whenDisturbanceInNestedData_thenExtractsCorrectly() {
        when(journal.admit(any())).thenReturn(UUID.randomUUID());
        consumer.handleMinutWebhook("{\"event_id\":\"test-4\",\"event_type\":\"disturbance\",\"created_at\":\"2026-10-23T10:00:00Z\",\"data\":{\"device_id\":\"d1\",\"sound_level\":78}}");
        verify(journal).admit(argThat(input -> input.externalDevice().equals("d1") && input.measuredDb()==78));
    }
}
