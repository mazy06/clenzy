package com.clenzy.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("CacheInvalidationMessage")
class CacheInvalidationMessageTest {

    @Test void serializeThenDeserialize_roundTripsKeyMessage() {
        CacheInvalidationMessage original = new CacheInvalidationMessage("node-1", "properties", "42");

        CacheInvalidationMessage parsed = CacheInvalidationMessage.deserialize(original.serialize());

        assertThat(parsed).isNotNull();
        assertThat(parsed.originId()).isEqualTo("node-1");
        assertThat(parsed.cacheName()).isEqualTo("properties");
        assertThat(parsed.key()).isEqualTo("42");
        assertThat(parsed.isClear()).isFalse();
    }

    @Test void clearMarker_roundTripsAsClear() {
        CacheInvalidationMessage original = CacheInvalidationMessage.clear("node-1", "permissions");

        CacheInvalidationMessage parsed = CacheInvalidationMessage.deserialize(original.serialize());

        assertThat(parsed).isNotNull();
        assertThat(parsed.cacheName()).isEqualTo("permissions");
        assertThat(parsed.key()).isNull();
        assertThat(parsed.isClear()).isTrue();
    }

    @Test void keyContainingSeparator_isPreserved() {
        // limit=3 : seules les 2 premieres barres separent, la cle peut contenir des '|'.
        CacheInvalidationMessage original = new CacheInvalidationMessage("node-1", "users", "a|b|c");

        CacheInvalidationMessage parsed = CacheInvalidationMessage.deserialize(original.serialize());

        assertThat(parsed).isNotNull();
        assertThat(parsed.key()).isEqualTo("a|b|c");
    }

    @Test void deserialize_null_returnsNull() {
        assertThat(CacheInvalidationMessage.deserialize(null)).isNull();
    }

    @Test void deserialize_malformedPayload_returnsNull() {
        assertThat(CacheInvalidationMessage.deserialize("only-one-segment")).isNull();
        assertThat(CacheInvalidationMessage.deserialize("two|segments")).isNull();
        assertThat(CacheInvalidationMessage.deserialize("|missing-origin|key")).isNull();
        assertThat(CacheInvalidationMessage.deserialize("origin||key")).isNull();
    }
}
