package com.clenzy.dto;

import com.clenzy.model.Conversation;
import com.clenzy.model.ConversationChannel;
import com.clenzy.model.ConversationStatus;
import com.clenzy.model.Guest;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;

class ConversationDtoTest {

    // --- Canonical record accessors ---

    @Test
    void canonicalConstructor_exposesAllFields() {
        LocalDateTime lastMessageAt = LocalDateTime.of(2026, 5, 30, 12, 0);
        LocalDateTime createdAt = LocalDateTime.of(2026, 1, 1, 0, 0);

        ConversationDto dto = new ConversationDto(
                1L, 100L, "Jean Dupont",
                10L, "Villa Bleue", 50L,
                ConversationChannel.WHATSAPP, ConversationStatus.OPEN,
                "Subject", "Preview", lastMessageAt,
                "kc-user-1", true, 5, createdAt,
                java.time.LocalDate.of(2026, 6, 1), java.time.LocalDate.of(2026, 6, 5), "33612345678@c.us",
                "Brouillon IA", "{\"sentiment\":\"POSITIVE\"}"
        );

        assertEquals(1L, dto.id());
        assertEquals(100L, dto.guestId());
        assertEquals("Jean Dupont", dto.guestName());
        assertEquals(10L, dto.propertyId());
        assertEquals("Villa Bleue", dto.propertyName());
        assertEquals(50L, dto.reservationId());
        assertEquals(ConversationChannel.WHATSAPP, dto.channel());
        assertEquals(ConversationStatus.OPEN, dto.status());
        assertEquals("Subject", dto.subject());
        assertEquals("Preview", dto.lastMessagePreview());
        assertEquals(lastMessageAt, dto.lastMessageAt());
        assertEquals("kc-user-1", dto.assignedToKeycloakId());
        assertTrue(dto.unread());
        assertEquals(5, dto.messageCount());
        assertEquals(createdAt, dto.createdAt());
        assertEquals(java.time.LocalDate.of(2026, 6, 1), dto.checkIn());
        assertEquals(java.time.LocalDate.of(2026, 6, 5), dto.checkOut());
        assertEquals("33612345678@c.us", dto.externalConversationId());
        assertEquals("Brouillon IA", dto.aiDraftReply());
        assertEquals("{\"sentiment\":\"POSITIVE\"}", dto.aiDraftMeta());
    }

    // --- from(entity) factory ---

    @Test
    void from_withAllRelations_mapsIdsAndNames() {
        Guest guest = new Guest();
        guest.setId(100L);
        guest.setFirstName("Jean");
        guest.setLastName("Dupont");

        Property property = new Property();
        property.setId(10L);
        property.setName("Villa Bleue");

        Reservation reservation = new Reservation();
        reservation.setId(50L);

        LocalDateTime lastMessageAt = LocalDateTime.of(2026, 5, 30, 12, 0);

        Conversation c = new Conversation();
        c.setId(1L);
        c.setGuest(guest);
        c.setProperty(property);
        c.setReservation(reservation);
        c.setChannel(ConversationChannel.AIRBNB);
        c.setStatus(ConversationStatus.CLOSED);
        c.setSubject("Subj");
        c.setLastMessagePreview("Hello");
        c.setLastMessageAt(lastMessageAt);
        c.setAssignedToKeycloakId("kc-42");
        c.setUnread(false);
        c.setMessageCount(7);

        ConversationDto dto = ConversationDto.from(c);

        assertEquals(1L, dto.id());
        assertEquals(100L, dto.guestId());
        assertEquals("Jean Dupont", dto.guestName());
        assertEquals(10L, dto.propertyId());
        assertEquals("Villa Bleue", dto.propertyName());
        assertEquals(50L, dto.reservationId());
        assertEquals(ConversationChannel.AIRBNB, dto.channel());
        assertEquals(ConversationStatus.CLOSED, dto.status());
        assertEquals("Subj", dto.subject());
        assertEquals("Hello", dto.lastMessagePreview());
        assertEquals(lastMessageAt, dto.lastMessageAt());
        assertEquals("kc-42", dto.assignedToKeycloakId());
        assertFalse(dto.unread());
        assertEquals(7, dto.messageCount());
    }

    @Test
    void from_withNullGuest_returnsNullGuestIdAndName() {
        Conversation c = new Conversation();
        c.setGuest(null);
        c.setProperty(propertyWithId(10L, "P"));
        c.setReservation(reservationWithId(50L));

        ConversationDto dto = ConversationDto.from(c);

        assertNull(dto.guestId());
        assertNull(dto.guestName());
        assertEquals(10L, dto.propertyId());
        assertEquals("P", dto.propertyName());
        assertEquals(50L, dto.reservationId());
    }

    @Test
    void from_withNullProperty_returnsNullPropertyIdAndName() {
        Conversation c = new Conversation();
        c.setGuest(guestWithName(100L, "A", "B"));
        c.setProperty(null);
        c.setReservation(reservationWithId(50L));

        ConversationDto dto = ConversationDto.from(c);

        assertEquals(100L, dto.guestId());
        assertNull(dto.propertyId());
        assertNull(dto.propertyName());
        assertEquals(50L, dto.reservationId());
    }

    @Test
    void from_withNullReservation_returnsNullReservationId() {
        Conversation c = new Conversation();
        c.setGuest(guestWithName(100L, "A", "B"));
        c.setProperty(propertyWithId(10L, "P"));
        c.setReservation(null);

        ConversationDto dto = ConversationDto.from(c);

        assertNull(dto.reservationId());
    }

    @Test
    void from_withAllRelationsNull_returnsNullsForAllRelatedIds() {
        Conversation c = new Conversation();
        c.setGuest(null);
        c.setProperty(null);
        c.setReservation(null);
        c.setChannel(ConversationChannel.INTERNAL);
        c.setStatus(ConversationStatus.ARCHIVED);

        ConversationDto dto = ConversationDto.from(c);

        assertNull(dto.guestId());
        assertNull(dto.guestName());
        assertNull(dto.propertyId());
        assertNull(dto.propertyName());
        assertNull(dto.reservationId());
        assertEquals(ConversationChannel.INTERNAL, dto.channel());
        assertEquals(ConversationStatus.ARCHIVED, dto.status());
    }

    // --- Record equality ---

    @Test
    void records_equalityByValue() {
        ConversationDto a = new ConversationDto(1L, null, null, null, null, null,
                ConversationChannel.INTERNAL, ConversationStatus.OPEN,
                null, null, null, null, false, 0, null, null, null, null, null, null);
        ConversationDto b = new ConversationDto(1L, null, null, null, null, null,
                ConversationChannel.INTERNAL, ConversationStatus.OPEN,
                null, null, null, null, false, 0, null, null, null, null, null, null);
        assertEquals(a, b);
        assertEquals(a.hashCode(), b.hashCode());
    }

    // --- Helpers ---

    private static Guest guestWithName(Long id, String first, String last) {
        Guest g = new Guest();
        g.setId(id);
        g.setFirstName(first);
        g.setLastName(last);
        return g;
    }

    private static Property propertyWithId(Long id, String name) {
        Property p = new Property();
        p.setId(id);
        p.setName(name);
        return p;
    }

    private static Reservation reservationWithId(Long id) {
        Reservation r = new Reservation();
        r.setId(id);
        return r;
    }
}
