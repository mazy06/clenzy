package com.clenzy.integration.expedia.service;

import com.clenzy.integration.channel.ChannelName;
import com.clenzy.integration.channel.model.ChannelMapping;
import com.clenzy.integration.channel.repository.ChannelMappingRepository;
import com.clenzy.model.Intervention;
import com.clenzy.model.InterventionStatus;
import com.clenzy.model.Property;
import com.clenzy.model.User;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.service.AuditLogService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Tests for {@link ExpediaReservationService}.
 *
 * Covers Kafka event dispatch + reservation lifecycle (created / updated / cancelled),
 * including the cleaning intervention auto-generation and CHANNEL mapping resolution.
 */
@ExtendWith(MockitoExtension.class)
class ExpediaReservationServiceTest {

    @Mock private ChannelMappingRepository channelMappingRepository;
    @Mock private InterventionRepository interventionRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private ExpediaWebhookService webhookService;
    @Mock private AuditLogService auditLogService;

    private ExpediaReservationService service;

    private static final String EVENT_ID = "evt-1";
    private static final String EXPEDIA_PROPERTY_ID = "exp-prop-123";
    private static final String RESERVATION_ID = "res-xyz";
    private static final Long ORG_ID = 10L;
    private static final Long PROPERTY_ID = 42L;

    @BeforeEach
    void setUp() {
        service = new ExpediaReservationService(
                channelMappingRepository, interventionRepository, propertyRepository,
                webhookService, auditLogService);
    }

    private ChannelMapping buildMapping() {
        ChannelMapping mapping = new ChannelMapping();
        mapping.setInternalId(PROPERTY_ID);
        mapping.setExternalId(EXPEDIA_PROPERTY_ID);
        mapping.setOrganizationId(ORG_ID);
        return mapping;
    }

    private Property buildProperty() {
        Property p = new Property();
        p.setId(PROPERTY_ID);
        p.setName("Loft Marseille");
        p.setOrganizationId(ORG_ID);
        p.setBedroomCount(2);
        User owner = new User();
        owner.setId(7L);
        p.setOwner(owner);
        return p;
    }

    private Map<String, Object> buildEvent(String type, Map<String, Object> data) {
        Map<String, Object> event = new HashMap<>();
        event.put("event_type", type);
        event.put("event_id", EVENT_ID);
        if (data != null) {
            event.put("data", data);
        }
        return event;
    }

    private Map<String, Object> buildReservationData() {
        Map<String, Object> data = new HashMap<>();
        data.put("reservation_id", RESERVATION_ID);
        data.put("property_id", EXPEDIA_PROPERTY_ID);
        data.put("organization_id", ORG_ID);
        data.put("check_in", "2026-06-01");
        data.put("check_out", "2026-06-05");
        data.put("guest_first_name", "Alice");
        data.put("guest_last_name", "Doe");
        data.put("total_guests", 3);
        data.put("source", "VRBO");
        return data;
    }

    private void stubMappingFound() {
        when(channelMappingRepository.findByExternalIdAndChannel(EXPEDIA_PROPERTY_ID, ChannelName.VRBO, ORG_ID))
                .thenReturn(Optional.of(buildMapping()));
    }

    // ─── handleReservationEvent (Kafka entry point) ───────────────────────

    @Nested
    @DisplayName("handleReservationEvent")
    class HandleReservationEvent {

        @Test
        @DisplayName("created event dispatches to handleReservationCreated and marks processed")
        void createdDispatchesProperly() {
            stubMappingFound();
            when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(buildProperty()));

            Map<String, Object> event = buildEvent("reservation.created", buildReservationData());
            service.handleReservationEvent(event);

            verify(interventionRepository).save(any(Intervention.class));
            verify(webhookService).markAsProcessed(EVENT_ID);
        }

        @Test
        @DisplayName("missing data field marks the event as failed")
        void missingDataMarksFailed() {
            Map<String, Object> event = buildEvent("reservation.created", null);

            service.handleReservationEvent(event);

            verify(webhookService).markAsFailed(eq(EVENT_ID), contains("Missing data"));
            verifyNoInteractions(interventionRepository);
        }

        @Test
        @DisplayName("unknown event type still marks processed")
        void unknownEventStillProcessed() {
            Map<String, Object> event = buildEvent("reservation.foo", buildReservationData());

            service.handleReservationEvent(event);

            verify(webhookService).markAsProcessed(EVENT_ID);
            verifyNoInteractions(interventionRepository);
        }

        @Test
        @DisplayName("exception in dispatch marks event as failed")
        void exceptionMarksFailed() {
            when(channelMappingRepository.findByExternalIdAndChannel(EXPEDIA_PROPERTY_ID, ChannelName.VRBO, ORG_ID))
                    .thenThrow(new RuntimeException("DB unavailable"));

            Map<String, Object> event = buildEvent("reservation.created", buildReservationData());
            service.handleReservationEvent(event);

            verify(webhookService).markAsFailed(eq(EVENT_ID), contains("DB unavailable"));
        }

        @Test
        @DisplayName("updated event dispatches to handler")
        void updatedDispatches() {
            stubMappingFound();
            when(interventionRepository.findByPropertyId(PROPERTY_ID, ORG_ID)).thenReturn(List.of());

            Map<String, Object> event = buildEvent("reservation.updated", buildReservationData());
            service.handleReservationEvent(event);

            verify(webhookService).markAsProcessed(EVENT_ID);
            verify(auditLogService).logSync(eq("ExpediaReservation"), eq(RESERVATION_ID), anyString());
        }

        @Test
        @DisplayName("cancelled event dispatches to handler")
        void cancelledDispatches() {
            stubMappingFound();
            when(interventionRepository.findByPropertyId(PROPERTY_ID, ORG_ID)).thenReturn(List.of());

            Map<String, Object> event = buildEvent("reservation.cancelled", buildReservationData());
            service.handleReservationEvent(event);

            verify(webhookService).markAsProcessed(EVENT_ID);
            verify(auditLogService).logSync(eq("ExpediaReservation"), eq(RESERVATION_ID), anyString());
        }
    }

    // ─── handleReservationCreated ────────────────────────────────────────

    @Nested
    @DisplayName("handleReservationCreated")
    class HandleReservationCreated {

        @Test
        @DisplayName("when no mapping, no intervention created")
        void noMappingNoOp() {
            when(channelMappingRepository.findByExternalIdAndChannel(EXPEDIA_PROPERTY_ID, ChannelName.VRBO, ORG_ID))
                    .thenReturn(Optional.empty());

            service.handleReservationCreated(buildReservationData());

            verify(interventionRepository, never()).save(any());
        }

        @Test
        @DisplayName("when property not found, no intervention created")
        void noPropertyNoOp() {
            stubMappingFound();
            when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.empty());

            service.handleReservationCreated(buildReservationData());

            verify(interventionRepository, never()).save(any());
        }

        @Test
        @DisplayName("creates cleaning intervention with expected metadata")
        void createsInterventionWithMetadata() {
            stubMappingFound();
            Property property = buildProperty();
            when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(property));

            service.handleReservationCreated(buildReservationData());

            ArgumentCaptor<Intervention> captor = ArgumentCaptor.forClass(Intervention.class);
            verify(interventionRepository).save(captor.capture());
            Intervention saved = captor.getValue();

            assertThat(saved.getOrganizationId()).isEqualTo(ORG_ID);
            assertThat(saved.getTitle()).contains("VRBO");
            assertThat(saved.getTitle()).contains(property.getName());
            assertThat(saved.getDescription()).contains("Alice Doe");
            assertThat(saved.getDescription()).contains(RESERVATION_ID);
            assertThat(saved.getStatus()).isEqualTo(InterventionStatus.PENDING);
            assertThat(saved.getProperty()).isEqualTo(property);
            assertThat(saved.getRequestor()).isEqualTo(property.getOwner());
            assertThat(saved.getSpecialInstructions()).contains("VRBO:" + RESERVATION_ID);
            verify(auditLogService).logSync(eq("ExpediaReservation"), eq(RESERVATION_ID), anyString());
        }

        @Test
        @DisplayName("handles missing guest names gracefully")
        void missingGuestNames() {
            stubMappingFound();
            when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(buildProperty()));

            Map<String, Object> data = buildReservationData();
            data.remove("guest_first_name");
            data.remove("guest_last_name");

            service.handleReservationCreated(data);

            verify(interventionRepository).save(any(Intervention.class));
        }

        @Test
        @DisplayName("handles missing dates by falling back to today")
        void missingDates() {
            stubMappingFound();
            when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(buildProperty()));

            Map<String, Object> data = buildReservationData();
            data.remove("check_in");
            data.remove("check_out");

            service.handleReservationCreated(data);

            verify(interventionRepository).save(any(Intervention.class));
        }

        @Test
        @DisplayName("uses EXPEDIA source when source missing")
        void defaultSourceWhenMissing() {
            stubMappingFound();
            when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(buildProperty()));

            Map<String, Object> data = buildReservationData();
            data.remove("source");

            service.handleReservationCreated(data);

            ArgumentCaptor<Intervention> captor = ArgumentCaptor.forClass(Intervention.class);
            verify(interventionRepository).save(captor.capture());
            assertThat(captor.getValue().getTitle()).contains("VRBO");
        }

        @Test
        @DisplayName("does not set requestor when property has no owner")
        void noOwnerNoRequestor() {
            stubMappingFound();
            Property property = buildProperty();
            property.setOwner(null);
            when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(property));

            service.handleReservationCreated(buildReservationData());

            ArgumentCaptor<Intervention> captor = ArgumentCaptor.forClass(Intervention.class);
            verify(interventionRepository).save(captor.capture());
            assertThat(captor.getValue().getRequestor()).isNull();
        }

        @Test
        @DisplayName("handles invalid organization_id string gracefully")
        void invalidOrgIdString() {
            Map<String, Object> data = buildReservationData();
            data.put("organization_id", "not-a-number");

            // parseOrgId returns null, findExpediaMapping returns empty
            service.handleReservationCreated(data);

            verify(interventionRepository, never()).save(any());
        }

        @Test
        @DisplayName("handles null property_id (mapping not found)")
        void nullExpediaPropertyId() {
            Map<String, Object> data = buildReservationData();
            data.remove("property_id");

            service.handleReservationCreated(data);

            verify(interventionRepository, never()).save(any());
        }
    }

    // ─── handleReservationUpdated ────────────────────────────────────────

    @Nested
    @DisplayName("handleReservationUpdated")
    class HandleReservationUpdated {

        @Test
        @DisplayName("when no mapping, exits silently")
        void noMappingExits() {
            when(channelMappingRepository.findByExternalIdAndChannel(EXPEDIA_PROPERTY_ID, ChannelName.VRBO, ORG_ID))
                    .thenReturn(Optional.empty());

            service.handleReservationUpdated(buildReservationData());

            verify(interventionRepository, never()).findByPropertyId(any(), any());
        }

        @Test
        @DisplayName("updates intervention dates when reservation id matches")
        void updatesMatchingIntervention() {
            stubMappingFound();
            Intervention intervention = new Intervention();
            intervention.setId(99L);
            intervention.setSpecialInstructions("[VRBO:" + RESERVATION_ID + "] 2 guests");
            when(interventionRepository.findByPropertyId(PROPERTY_ID, ORG_ID))
                    .thenReturn(List.of(intervention));
            when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(buildProperty()));

            service.handleReservationUpdated(buildReservationData());

            verify(interventionRepository).save(intervention);
            assertThat(intervention.getScheduledDate()).isNotNull();
            assertThat(intervention.getEstimatedDurationHours()).isNotNull();
        }

        @Test
        @DisplayName("skips interventions that do not reference reservation id")
        void skipsUnrelatedInterventions() {
            stubMappingFound();
            Intervention unrelated = new Intervention();
            unrelated.setSpecialInstructions("[VRBO:other-res] something");
            when(interventionRepository.findByPropertyId(PROPERTY_ID, ORG_ID))
                    .thenReturn(List.of(unrelated));

            service.handleReservationUpdated(buildReservationData());

            verify(interventionRepository, never()).save(any());
        }

        @Test
        @DisplayName("skips interventions with null specialInstructions")
        void nullSpecialInstructionsSkipped() {
            stubMappingFound();
            Intervention intervention = new Intervention();
            intervention.setSpecialInstructions(null);
            when(interventionRepository.findByPropertyId(PROPERTY_ID, ORG_ID))
                    .thenReturn(List.of(intervention));

            service.handleReservationUpdated(buildReservationData());

            verify(interventionRepository, never()).save(any());
        }

        @Test
        @DisplayName("does nothing when both check_in and check_out are missing")
        void missingDates() {
            stubMappingFound();
            Intervention intervention = new Intervention();
            intervention.setSpecialInstructions("[VRBO:" + RESERVATION_ID + "] 2 guests");
            when(interventionRepository.findByPropertyId(PROPERTY_ID, ORG_ID))
                    .thenReturn(List.of(intervention));

            Map<String, Object> data = buildReservationData();
            data.remove("check_in");
            data.remove("check_out");
            data.remove("total_guests");

            service.handleReservationUpdated(data);

            // intervention still saved (sees the matching id), just without new dates
            verify(interventionRepository).save(intervention);
        }
    }

    // ─── handleReservationCancelled ───────────────────────────────────────

    @Nested
    @DisplayName("handleReservationCancelled")
    class HandleReservationCancelled {

        @Test
        @DisplayName("when no mapping, exits silently")
        void noMappingExits() {
            when(channelMappingRepository.findByExternalIdAndChannel(EXPEDIA_PROPERTY_ID, ChannelName.VRBO, ORG_ID))
                    .thenReturn(Optional.empty());

            service.handleReservationCancelled(buildReservationData());

            verify(interventionRepository, never()).findByPropertyId(any(), any());
        }

        @Test
        @DisplayName("cancels intervention when reservation id matches")
        void cancelsMatchingIntervention() {
            stubMappingFound();
            Intervention intervention = new Intervention();
            intervention.setId(100L);
            intervention.setStatus(InterventionStatus.PENDING);
            intervention.setSpecialInstructions("[VRBO:" + RESERVATION_ID + "] 2 guests");
            when(interventionRepository.findByPropertyId(PROPERTY_ID, ORG_ID))
                    .thenReturn(List.of(intervention));

            service.handleReservationCancelled(buildReservationData());

            verify(interventionRepository).save(intervention);
            assertThat(intervention.getStatus()).isEqualTo(InterventionStatus.CANCELLED);
        }

        @Test
        @DisplayName("skips interventions already cancelled")
        void skipsAlreadyCancelled() {
            stubMappingFound();
            Intervention intervention = new Intervention();
            intervention.setStatus(InterventionStatus.CANCELLED);
            intervention.setSpecialInstructions("[VRBO:" + RESERVATION_ID + "] 2 guests");
            when(interventionRepository.findByPropertyId(PROPERTY_ID, ORG_ID))
                    .thenReturn(List.of(intervention));

            service.handleReservationCancelled(buildReservationData());

            verify(interventionRepository, never()).save(any());
        }

        @Test
        @DisplayName("cancels multiple matching interventions in one pass")
        void cancelsMultipleMatching() {
            stubMappingFound();
            Intervention i1 = new Intervention();
            i1.setStatus(InterventionStatus.PENDING);
            i1.setSpecialInstructions("[VRBO:" + RESERVATION_ID + "] foo");
            Intervention i2 = new Intervention();
            i2.setStatus(InterventionStatus.IN_PROGRESS);
            i2.setSpecialInstructions("[VRBO:" + RESERVATION_ID + "] bar");
            when(interventionRepository.findByPropertyId(PROPERTY_ID, ORG_ID))
                    .thenReturn(List.of(i1, i2));

            service.handleReservationCancelled(buildReservationData());

            verify(interventionRepository, times(2)).save(any(Intervention.class));
            assertThat(i1.getStatus()).isEqualTo(InterventionStatus.CANCELLED);
            assertThat(i2.getStatus()).isEqualTo(InterventionStatus.CANCELLED);
        }

        @Test
        @DisplayName("skips interventions without matching reservation id")
        void skipsUnrelated() {
            stubMappingFound();
            Intervention unrelated = new Intervention();
            unrelated.setStatus(InterventionStatus.PENDING);
            unrelated.setSpecialInstructions("[VRBO:other] foo");
            when(interventionRepository.findByPropertyId(PROPERTY_ID, ORG_ID))
                    .thenReturn(List.of(unrelated));

            service.handleReservationCancelled(buildReservationData());

            verify(interventionRepository, never()).save(any());
            assertThat(unrelated.getStatus()).isEqualTo(InterventionStatus.PENDING);
        }

        @Test
        @DisplayName("handles missing organization_id (returns null orgId)")
        void missingOrgId() {
            Map<String, Object> data = buildReservationData();
            data.remove("organization_id");

            service.handleReservationCancelled(data);

            verify(interventionRepository, never()).findByPropertyId(any(), any());
        }
    }

    // ─── Org ID parsing variants ──────────────────────────────────────────

    @Nested
    @DisplayName("parseOrgId variants")
    class ParseOrgId {

        @Test
        @DisplayName("accepts Long organization_id")
        void longOrgId() {
            stubMappingFound();
            when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(buildProperty()));

            Map<String, Object> data = buildReservationData();
            data.put("organization_id", ORG_ID); // already a Long

            service.handleReservationCreated(data);

            verify(interventionRepository).save(any(Intervention.class));
        }

        @Test
        @DisplayName("accepts numeric string organization_id")
        void stringOrgId() {
            stubMappingFound();
            when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(buildProperty()));

            Map<String, Object> data = buildReservationData();
            data.put("organization_id", "10");

            service.handleReservationCreated(data);

            verify(interventionRepository).save(any(Intervention.class));
        }
    }
}
