package com.clenzy.controller;

import com.clenzy.service.MobilePaymentService;
import com.stripe.exception.ApiException;
import com.stripe.exception.StripeException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MobilePaymentControllerTest {

    @Mock private MobilePaymentService mobilePaymentService;

    private MobilePaymentController controller;
    private Jwt jwt;

    @BeforeEach
    void setUp() {
        controller = new MobilePaymentController(mobilePaymentService);
        ReflectionTestUtils.setField(controller, "publishableKey", "pk_test_xxx");
        jwt = Jwt.withTokenValue("token")
            .header("alg", "none")
            .subject("kc-user-1")
            .issuedAt(Instant.now())
            .expiresAt(Instant.now().plusSeconds(60))
            .build();
    }

    @Test
    void createPaymentSheet_validSubscription_returnsOk() throws StripeException {
        Map<String, String> result = Map.of("paymentIntent", "pi_x", "ephemeralKey", "ek");
        when(mobilePaymentService.createPaymentSheet(
            eq("kc-user-1"), eq("subscription"), eq("confort"), any(), any())).thenReturn(result);

        Map<String, Object> body = new HashMap<>();
        body.put("type", "subscription");
        body.put("forfait", "confort");

        ResponseEntity<Map<String, String>> response = controller.createPaymentSheet(jwt, body);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("pi_x", response.getBody().get("paymentIntent"));
    }

    @Test
    void createPaymentSheet_validIntervention_returnsOk() throws StripeException {
        when(mobilePaymentService.createPaymentSheet(
            eq("kc-user-1"), eq("intervention"), any(), eq(5L), eq(1000L))).thenReturn(Map.of());

        Map<String, Object> body = new HashMap<>();
        body.put("type", "intervention");
        body.put("interventionId", 5);
        body.put("amount", 1000);

        ResponseEntity<Map<String, String>> response = controller.createPaymentSheet(jwt, body);

        assertEquals(HttpStatus.OK, response.getStatusCode());
    }

    @Test
    void createPaymentSheet_missingType_badRequest() {
        ResponseEntity<Map<String, String>> response = controller.createPaymentSheet(jwt, Map.of());

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertTrue(response.getBody().get("error").contains("type"));
    }

    @Test
    void createPaymentSheet_blankType_badRequest() {
        Map<String, Object> body = new HashMap<>();
        body.put("type", "  ");

        ResponseEntity<Map<String, String>> response = controller.createPaymentSheet(jwt, body);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
    }

    @Test
    void createPaymentSheet_illegalArg_badRequest() throws StripeException {
        when(mobilePaymentService.createPaymentSheet(any(), any(), any(), any(), any()))
            .thenThrow(new IllegalArgumentException("bad input"));

        Map<String, Object> body = new HashMap<>();
        body.put("type", "subscription");
        body.put("forfait", "confort");

        ResponseEntity<Map<String, String>> response = controller.createPaymentSheet(jwt, body);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertEquals("bad input", response.getBody().get("error"));
    }

    @Test
    void createPaymentSheet_stripeError_internalServerError() throws StripeException {
        when(mobilePaymentService.createPaymentSheet(any(), any(), any(), any(), any()))
            .thenThrow(new ApiException("stripe down", null, null, 500, null));

        Map<String, Object> body = new HashMap<>();
        body.put("type", "subscription");
        body.put("forfait", "premium");

        ResponseEntity<Map<String, String>> response = controller.createPaymentSheet(jwt, body);

        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, response.getStatusCode());
        assertTrue(response.getBody().get("error").contains("stripe down"));
    }

    @Test
    void getStripeConfig_returnsPublishableKey() {
        ResponseEntity<Map<String, String>> response = controller.getStripeConfig();

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("pk_test_xxx", response.getBody().get("publishableKey"));
    }
}
