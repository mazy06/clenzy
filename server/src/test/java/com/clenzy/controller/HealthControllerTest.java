package com.clenzy.controller;

import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests for {@link HealthController}.
 */
class HealthControllerTest {

    private final HealthController controller = new HealthController();

    @Test
    void whenHealth_thenReturnsStatusUp() {
        ResponseEntity<Map<String, String>> response = controller.health();

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        Map<String, String> body = response.getBody();
        assertThat(body).isNotNull();
        assertThat(body.get("status")).isEqualTo("UP");
        assertThat(body.get("message")).isEqualTo("Server is running");
        assertThat(body.get("timestamp")).isNotNull();
    }
}
