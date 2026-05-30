package com.clenzy.service;

import com.clenzy.dto.CreateBookingRestrictionRequest;
import com.clenzy.model.BookingRestriction;
import com.clenzy.model.Property;
import com.clenzy.repository.BookingRestrictionRepository;
import com.clenzy.repository.PropertyRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class BookingRestrictionServiceTest {

    @Mock private BookingRestrictionRepository restrictionRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private OutboxPublisher outboxPublisher;
    private ObjectMapper objectMapper;

    private BookingRestrictionService service;

    private static final Long ORG_ID = 5L;
    private static final Long PROPERTY_ID = 100L;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        service = new BookingRestrictionService(restrictionRepository, propertyRepository,
            outboxPublisher, objectMapper);
        when(restrictionRepository.save(any(BookingRestriction.class))).thenAnswer(inv -> {
            BookingRestriction r = inv.getArgument(0);
            if (r.getId() == null) r.setId(7L);
            return r;
        });
    }

    private Property sampleProperty() {
        Property p = new Property();
        p.setId(PROPERTY_ID);
        p.setName("Appart Paris");
        return p;
    }

    private BookingRestriction sampleRestriction() {
        BookingRestriction r = new BookingRestriction(sampleProperty(),
            LocalDate.of(2025, 7, 1), LocalDate.of(2025, 8, 31), ORG_ID);
        r.setId(7L);
        r.setMinStay(2);
        r.setMaxStay(7);
        return r;
    }

    private CreateBookingRestrictionRequest fullRequest() {
        return new CreateBookingRestrictionRequest(
            PROPERTY_ID, LocalDate.of(2025, 7, 1), LocalDate.of(2025, 8, 31),
            3, 14, true, true, 1, 5, new Integer[]{1, 7}, 10);
    }

    private CreateBookingRestrictionRequest minimalRequest() {
        return new CreateBookingRestrictionRequest(
            PROPERTY_ID, LocalDate.of(2025, 7, 1), LocalDate.of(2025, 8, 31),
            null, null, null, null, null, null, null, null);
    }

    // ----- getByProperty / getById -----

    @Test
    void getByProperty_delegatesToRepository() {
        BookingRestriction r = sampleRestriction();
        when(restrictionRepository.findByPropertyId(PROPERTY_ID, ORG_ID)).thenReturn(List.of(r));

        assertThat(service.getByProperty(PROPERTY_ID, ORG_ID)).hasSize(1).contains(r);
    }

    @Test
    void getById_found_returns() {
        BookingRestriction r = sampleRestriction();
        when(restrictionRepository.findById(7L)).thenReturn(Optional.of(r));

        assertThat(service.getById(7L, ORG_ID)).isEqualTo(r);
    }

    @Test
    void getById_wrongOrg_throws() {
        BookingRestriction r = sampleRestriction();
        r.setOrganizationId(999L);
        when(restrictionRepository.findById(7L)).thenReturn(Optional.of(r));

        assertThatThrownBy(() -> service.getById(7L, ORG_ID))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void getById_notFound_throws() {
        when(restrictionRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getById(999L, ORG_ID))
            .isInstanceOf(IllegalArgumentException.class);
    }

    // ----- create -----

    @Test
    void create_full_setsAllFieldsAndPublishesEvent() {
        when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(sampleProperty()));

        BookingRestriction result = service.create(fullRequest(), ORG_ID);

        assertThat(result.getOrganizationId()).isEqualTo(ORG_ID);
        assertThat(result.getProperty().getId()).isEqualTo(PROPERTY_ID);
        assertThat(result.getStartDate()).isEqualTo(LocalDate.of(2025, 7, 1));
        assertThat(result.getMinStay()).isEqualTo(3);
        assertThat(result.getMaxStay()).isEqualTo(14);
        assertThat(result.getClosedToArrival()).isTrue();
        assertThat(result.getClosedToDeparture()).isTrue();
        assertThat(result.getGapDays()).isEqualTo(1);
        assertThat(result.getAdvanceNoticeDays()).isEqualTo(5);
        assertThat(result.getDaysOfWeek()).containsExactly(1, 7);
        assertThat(result.getPriority()).isEqualTo(10);

        verify(outboxPublisher).publishCalendarEvent(eq("RESTRICTION_CREATED"),
            eq(PROPERTY_ID), eq(ORG_ID), anyString());
    }

    @Test
    void create_minimal_appliesDefaults() {
        when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(sampleProperty()));

        BookingRestriction result = service.create(minimalRequest(), ORG_ID);

        assertThat(result.getClosedToArrival()).isFalse();
        assertThat(result.getClosedToDeparture()).isFalse();
        assertThat(result.getGapDays()).isEqualTo(0);
        assertThat(result.getPriority()).isEqualTo(0);
    }

    @Test
    void create_propertyNotFound_throws() {
        when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.create(fullRequest(), ORG_ID))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Property not found");
    }

    // ----- update -----

    @Test
    void update_modifiesAndPublishes() {
        BookingRestriction existing = sampleRestriction();
        when(restrictionRepository.findById(7L)).thenReturn(Optional.of(existing));

        BookingRestriction result = service.update(7L, ORG_ID, fullRequest());

        assertThat(result.getMinStay()).isEqualTo(3);
        assertThat(result.getMaxStay()).isEqualTo(14);
        assertThat(result.getPriority()).isEqualTo(10);
        verify(outboxPublisher).publishCalendarEvent(eq("RESTRICTION_UPDATED"),
            eq(PROPERTY_ID), eq(ORG_ID), anyString());
    }

    @Test
    void update_notFound_throws() {
        when(restrictionRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.update(999L, ORG_ID, fullRequest()))
            .isInstanceOf(IllegalArgumentException.class);
    }

    // ----- delete -----

    @Test
    void delete_removesAndPublishes() {
        BookingRestriction existing = sampleRestriction();
        when(restrictionRepository.findById(7L)).thenReturn(Optional.of(existing));

        service.delete(7L, ORG_ID);

        verify(restrictionRepository).delete(existing);
        verify(outboxPublisher).publishCalendarEvent(eq("RESTRICTION_DELETED"),
            eq(PROPERTY_ID), eq(ORG_ID), anyString());
    }

    @Test
    void delete_notFound_throws() {
        when(restrictionRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.delete(999L, ORG_ID))
            .isInstanceOf(IllegalArgumentException.class);
    }

    // ----- Event publishing robustness -----

    @Test
    void create_outboxThrows_doesNotPropagate() {
        when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(sampleProperty()));
        doThrow(new RuntimeException("kafka down"))
            .when(outboxPublisher).publishCalendarEvent(anyString(), anyLong(), anyLong(), anyString());

        // Should not throw — publishing failure is swallowed
        BookingRestriction result = service.create(fullRequest(), ORG_ID);
        assertThat(result).isNotNull();
    }
}
