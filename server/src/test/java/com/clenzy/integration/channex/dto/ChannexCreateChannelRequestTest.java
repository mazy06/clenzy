package com.clenzy.integration.channex.dto;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class ChannexCreateChannelRequestTest {

    @Test
    void canonicalConstructor_setsAllAccessors() {
        ChannexCreateChannelRequest req = new ChannexCreateChannelRequest(
                "Airbnb - Marrakech",
                "Airbnb",
                "prop-uuid",
                "group-uuid"
        );

        assertEquals("Airbnb - Marrakech", req.title());
        assertEquals("Airbnb", req.channelName());
        assertEquals("prop-uuid", req.propertyId());
        assertEquals("group-uuid", req.groupId());
    }

    @Test
    void toApiPayload_wrapsFieldsUnderChannelKey() {
        ChannexCreateChannelRequest req = new ChannexCreateChannelRequest(
                "Booking - Casa",
                "BookingCom",
                "prop-1",
                "group-1"
        );

        Map<String, Object> payload = req.toApiPayload();

        assertEquals(1, payload.size());
        assertTrue(payload.containsKey("channel"));

        @SuppressWarnings("unchecked")
        Map<String, Object> channel = (Map<String, Object>) payload.get("channel");

        assertEquals("Booking - Casa", channel.get("title"));
        assertEquals("BookingCom", channel.get("channel"));
        assertEquals("prop-1", channel.get("property_id"));
        assertEquals("group-1", channel.get("group_id"));
        assertEquals(Boolean.FALSE, channel.get("is_active"));
    }

    @Test
    void toApiPayload_isActiveAlwaysFalseAtCreation() {
        ChannexCreateChannelRequest req = new ChannexCreateChannelRequest("t", "c", "p", "g");

        Map<String, Object> payload = req.toApiPayload();
        @SuppressWarnings("unchecked")
        Map<String, Object> channel = (Map<String, Object>) payload.get("channel");

        assertEquals(Boolean.FALSE, channel.get("is_active"));
    }

    @Test
    void toApiPayload_acceptsNullsForOptionalFields() {
        ChannexCreateChannelRequest req = new ChannexCreateChannelRequest(null, null, null, null);

        Map<String, Object> payload = req.toApiPayload();
        @SuppressWarnings("unchecked")
        Map<String, Object> channel = (Map<String, Object>) payload.get("channel");

        assertNull(channel.get("title"));
        assertNull(channel.get("channel"));
        assertNull(channel.get("property_id"));
        assertNull(channel.get("group_id"));
        assertEquals(Boolean.FALSE, channel.get("is_active"));
    }

    @Test
    void toApiPayload_preservesInsertionOrder() {
        ChannexCreateChannelRequest req = new ChannexCreateChannelRequest("t", "Airbnb", "p", "g");

        @SuppressWarnings("unchecked")
        Map<String, Object> channel = (Map<String, Object>) req.toApiPayload().get("channel");

        // LinkedHashMap → ordre attendu : title, channel, property_id, group_id, is_active
        var keys = channel.keySet().toArray(new String[0]);
        assertEquals("title", keys[0]);
        assertEquals("channel", keys[1]);
        assertEquals("property_id", keys[2]);
        assertEquals("group_id", keys[3]);
        assertEquals("is_active", keys[4]);
    }

    @Test
    void equalsAndHashCode_recordSemantics() {
        ChannexCreateChannelRequest a = new ChannexCreateChannelRequest("t", "Airbnb", "p", "g");
        ChannexCreateChannelRequest b = new ChannexCreateChannelRequest("t", "Airbnb", "p", "g");
        ChannexCreateChannelRequest c = new ChannexCreateChannelRequest("other", "Airbnb", "p", "g");

        assertEquals(a, b);
        assertEquals(a.hashCode(), b.hashCode());
        assertNotEquals(a, c);
    }

    @Test
    void toString_includesFields() {
        ChannexCreateChannelRequest req = new ChannexCreateChannelRequest("Airbnb-Paris", "Airbnb", "p", "g");
        String s = req.toString();
        assertNotNull(s);
        assertTrue(s.contains("Airbnb-Paris") || s.contains("Airbnb"));
    }
}
