package com.clenzy.service;

import com.clenzy.config.KafkaConfig;
import com.clenzy.model.OutboxEvent;
import com.clenzy.repository.OutboxEventRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OutboxPublisherTest {

    @Mock
    private OutboxEventRepository outboxEventRepository;

    @InjectMocks
    private OutboxPublisher outboxPublisher;

    private Long propertyId;
    private Long reservationId;
    private Long orgId;
    private String payload;

    @BeforeEach
    void setUp() {
        propertyId = 1L;
        reservationId = 100L;
        orgId = 1L;
        payload = "{\"action\":\"BOOKED\"}";
    }

    @Test
    void publishCalendarEvent_createsEvent() {
        ArgumentCaptor<OutboxEvent> captor = ArgumentCaptor.forClass(OutboxEvent.class);
        when(outboxEventRepository.save(captor.capture())).thenAnswer(invocation -> invocation.getArgument(0));

        outboxPublisher.publishCalendarEvent("CALENDAR_BOOKED", propertyId, orgId, payload);

        verify(outboxEventRepository).save(any(OutboxEvent.class));

        OutboxEvent event = captor.getValue();
        assertNotNull(event);
        assertEquals("CALENDAR", event.getAggregateType());
        assertEquals(String.valueOf(propertyId), event.getAggregateId());
        assertEquals("CALENDAR_BOOKED", event.getEventType());
        assertEquals(KafkaConfig.TOPIC_CALENDAR_UPDATES, event.getTopic());
        assertEquals(payload, event.getPayload());
        assertEquals(orgId, event.getOrganizationId());
    }

    @Test
    void publishReservationEvent_createsEvent() {
        ArgumentCaptor<OutboxEvent> captor = ArgumentCaptor.forClass(OutboxEvent.class);
        when(outboxEventRepository.save(captor.capture())).thenAnswer(invocation -> invocation.getArgument(0));

        outboxPublisher.publishReservationEvent("RESERVATION_CREATED", reservationId, propertyId, orgId, payload);

        verify(outboxEventRepository).save(any(OutboxEvent.class));

        OutboxEvent event = captor.getValue();
        assertNotNull(event);
        assertEquals("RESERVATION", event.getAggregateType());
        assertEquals(String.valueOf(reservationId), event.getAggregateId());
        assertEquals("RESERVATION_CREATED", event.getEventType());
        assertEquals(payload, event.getPayload());
        assertEquals(orgId, event.getOrganizationId());
    }

    @Test
    void publish_generic() {
        String aggregateType = "CUSTOM_AGGREGATE";
        String aggregateId = "123";
        String eventType = "CUSTOM_EVENT";
        String topic = "custom.topic";
        String partitionKey = "custom-key";

        ArgumentCaptor<OutboxEvent> captor = ArgumentCaptor.forClass(OutboxEvent.class);
        when(outboxEventRepository.save(captor.capture())).thenAnswer(invocation -> invocation.getArgument(0));

        outboxPublisher.publish(aggregateType, aggregateId, eventType, topic, partitionKey, payload, orgId);

        verify(outboxEventRepository).save(any(OutboxEvent.class));

        OutboxEvent event = captor.getValue();
        assertNotNull(event);
        assertEquals(aggregateType, event.getAggregateType());
        assertEquals(aggregateId, event.getAggregateId());
        assertEquals(eventType, event.getEventType());
        assertEquals(topic, event.getTopic());
        assertEquals(partitionKey, event.getPartitionKey());
        assertEquals(payload, event.getPayload());
        assertEquals(orgId, event.getOrganizationId());
    }
}
