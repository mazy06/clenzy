package com.clenzy.integration.channex.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ChannexRoomTypeDetailDtoTest {

    private static final ObjectMapper M = new ObjectMapper();

    @Test
    void canonicalConstructor_setsAllAccessors() {
        JsonNode content = M.createObjectNode().put("description", "Lovely studio");
        ChannexRoomTypeDetailDto dto = new ChannexRoomTypeDetailDto(
                "room-1",
                "Studio Marais",
                "prop-1",
                2,
                3,
                1,
                1,
                4,
                6,
                "apartment",
                content
        );

        assertEquals("room-1", dto.id());
        assertEquals("Studio Marais", dto.title());
        assertEquals("prop-1", dto.propertyId());
        assertEquals(2, dto.countOfRooms());
        assertEquals(3, dto.occAdults());
        assertEquals(1, dto.occChildren());
        assertEquals(1, dto.occInfants());
        assertEquals(4, dto.defaultOccupancy());
        assertEquals(6, dto.capacity());
        assertEquals("apartment", dto.roomKind());
        assertEquals(content, dto.content());
    }

    @Test
    void resolveMaxGuests_sumOfAdultsChildrenInfants() {
        ChannexRoomTypeDetailDto dto = newDto(2, 1, 1, 5);
        assertEquals(4, dto.resolveMaxGuests());
    }

    @Test
    void resolveMaxGuests_adultsOnly_whenChildrenInfantsNull() {
        ChannexRoomTypeDetailDto dto = newDto(3, null, null, 5);
        assertEquals(3, dto.resolveMaxGuests());
    }

    @Test
    void resolveMaxGuests_adultsPlusChildren_whenInfantsNull() {
        ChannexRoomTypeDetailDto dto = newDto(2, 1, null, 5);
        assertEquals(3, dto.resolveMaxGuests());
    }

    @Test
    void resolveMaxGuests_adultsPlusInfants_whenChildrenNull() {
        ChannexRoomTypeDetailDto dto = newDto(2, null, 1, 5);
        assertEquals(3, dto.resolveMaxGuests());
    }

    @Test
    void resolveMaxGuests_fallsBackToDefaultOccupancy_whenAdultsNull() {
        ChannexRoomTypeDetailDto dto = newDto(null, 1, 1, 5);
        assertEquals(5, dto.resolveMaxGuests());
    }

    @Test
    void resolveMaxGuests_returnsNull_whenAdultsAndDefaultOccupancyNull() {
        ChannexRoomTypeDetailDto dto = newDto(null, 1, 1, null);
        assertNull(dto.resolveMaxGuests());
    }

    @Test
    void resolveMaxGuests_zeroAdults_yieldsZeroSum() {
        ChannexRoomTypeDetailDto dto = newDto(0, 0, 0, 5);
        assertEquals(0, dto.resolveMaxGuests());
    }

    @Test
    void canonicalConstructor_allowsAllNulls() {
        ChannexRoomTypeDetailDto dto = new ChannexRoomTypeDetailDto(
                null, null, null, null, null, null, null, null, null, null, null);
        assertNull(dto.id());
        assertNull(dto.title());
        assertNull(dto.propertyId());
        assertNull(dto.countOfRooms());
        assertNull(dto.occAdults());
        assertNull(dto.occChildren());
        assertNull(dto.occInfants());
        assertNull(dto.defaultOccupancy());
        assertNull(dto.capacity());
        assertNull(dto.roomKind());
        assertNull(dto.content());
        assertNull(dto.resolveMaxGuests());
    }

    @Test
    void equalsAndHashCode_recordSemantics() {
        ObjectNode c1 = M.createObjectNode().put("k", "v");
        ChannexRoomTypeDetailDto a = new ChannexRoomTypeDetailDto("id", "t", "p", 1, 2, null, null, null, null, "room", c1);
        ChannexRoomTypeDetailDto b = new ChannexRoomTypeDetailDto("id", "t", "p", 1, 2, null, null, null, null, "room", c1);
        ChannexRoomTypeDetailDto c = new ChannexRoomTypeDetailDto("other", "t", "p", 1, 2, null, null, null, null, "room", c1);

        assertEquals(a, b);
        assertEquals(a.hashCode(), b.hashCode());
        assertNotEquals(a, c);
    }

    private ChannexRoomTypeDetailDto newDto(Integer adults, Integer children, Integer infants, Integer defaultOcc) {
        return new ChannexRoomTypeDetailDto(
                "id", "title", "prop",
                1,
                adults, children, infants, defaultOcc,
                null,
                "room",
                null
        );
    }
}
