package com.clenzy.service.messaging;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class MessageDeliveryResultTest {

    @Test
    void success_hasCorrectState() {
        var result = MessageDeliveryResult.success("msg-123");

        assertTrue(result.success());
        assertEquals("msg-123", result.providerMessageId());
        assertNull(result.errorMessage());
    }

    @Test
    void failure_hasCorrectState() {
        var result = MessageDeliveryResult.failure("SMTP timeout");

        assertFalse(result.success());
        assertNull(result.providerMessageId());
        assertEquals("SMTP timeout", result.errorMessage());
    }

    @Test
    void success_withNullMessageId() {
        var result = MessageDeliveryResult.success(null);

        assertTrue(result.success());
        assertNull(result.providerMessageId());
    }
}
