package com.clenzy.service;

import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

class LoginProtectionSecurityTest {
    @Test
    void missingSecretNeverValidatesAnAttackerSuppliedToken() {
        RestTemplate http = mock(RestTemplate.class);
        LoginProtectionService service = new LoginProtectionService(mock(StringRedisTemplate.class), http);
        ReflectionTestUtils.setField(service, "captchaEnabled", true);
        ReflectionTestUtils.setField(service, "turnstileSecretKey", "");

        assertFalse(service.validateCaptchaToken("attacker-supplied-token"));
        verifyNoInteractions(http);
    }

    @Test
    void disabledLoginCaptchaCannotApproveAMandatoryMarketplaceChallenge() {
        RestTemplate http = mock(RestTemplate.class);
        LoginProtectionService service = new LoginProtectionService(mock(StringRedisTemplate.class), http);
        ReflectionTestUtils.setField(service, "captchaEnabled", false);

        assertFalse(service.validateCaptchaToken("attacker-supplied-token"));
        verifyNoInteractions(http);
    }
}
