package com.clenzy.controller;

import com.clenzy.service.CaptchaService;
import com.clenzy.service.CaptchaService.CaptchaChallenge;
import com.clenzy.service.CaptchaService.CaptchaVerificationResult;
import com.clenzy.service.LoginProtectionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CaptchaControllerTest {

    @Mock private CaptchaService captchaService;
    @Mock private LoginProtectionService loginProtectionService;

    private CaptchaController controller;

    @BeforeEach
    void setUp() {
        controller = new CaptchaController(captchaService, loginProtectionService);
    }

    @Test
    @DisplayName("generate returns challenge from service")
    void whenGenerate_thenReturnsChallenge() {
        CaptchaChallenge challenge = new CaptchaChallenge("token-123", "bg-data", "piece-data", 150, 200, 300);
        when(captchaService.generateChallenge()).thenReturn(challenge);

        ResponseEntity<CaptchaChallenge> response = controller.generate();

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).isEqualTo(challenge);
    }

    @Nested
    @DisplayName("verify")
    class Verify {
        @Test
        void whenNullRequest_thenBadRequest() {
            ResponseEntity<?> response = controller.verify(null);
            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        void whenNullToken_thenBadRequest() {
            var request = new CaptchaController.CaptchaVerifyRequest(null, 100);
            ResponseEntity<?> response = controller.verify(request);
            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        void whenVerificationSucceeds_thenReturnsCaptchaToken() {
            when(captchaService.verify("tok-1", 150)).thenReturn(new CaptchaVerificationResult(true, null));

            var request = new CaptchaController.CaptchaVerifyRequest("tok-1", 150);
            ResponseEntity<?> response = controller.verify(request);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(loginProtectionService).markCaptchaVerified("tok-1");
        }

        @Test
        void whenVerificationFails_thenReturnsFailure() {
            when(captchaService.verify("tok-2", 50)).thenReturn(new CaptchaVerificationResult(false, "Wrong position"));

            var request = new CaptchaController.CaptchaVerifyRequest("tok-2", 50);
            ResponseEntity<?> response = controller.verify(request);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(loginProtectionService, never()).markCaptchaVerified(anyString());
        }
    }
}
