package com.clenzy.marketplace.service;

import com.clenzy.service.EmailService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MarketplaceNotificationServiceTest {
    @Mock private EmailService emails;
    private MarketplaceNotificationService service;

    @BeforeEach
    void setUp() {
        service = new MarketplaceNotificationService(emails);
        ReflectionTestUtils.setField(service, "landingUrl", "https://baitly.example/");
    }

    @Test
    void activationUsesThePublicPageAndEncodesTheToken() {
        service.sendAccountActivation("Atelier", "pro@example.com", "a+b/c");
        verify(emails).sendSystemTemplateEmail("pro@example.com", "marketplace_account_activation",
            Map.of("displayName", "Atelier", "activationLink",
                "https://baitly.example/prestataires/activation?token=a%2Bb%2Fc"), null);
    }

    @Test
    void smtpFailureReachesTheDurableWorker() {
        doThrow(new IllegalStateException("SMTP unavailable")).when(emails)
            .sendSystemTemplateEmail(any(), any(), any(), any());
        assertThatThrownBy(() -> service.sendAccountActivation(null, "pro@example.com", "token"))
            .isInstanceOf(IllegalStateException.class).hasMessage("SMTP unavailable");
    }

    @Test
    void missingRecipientCannotBeReportedAsDelivered() {
        assertThatThrownBy(() -> service.sendAccountActivation("Atelier", " ", "token"))
            .isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(emails);
    }

    @Test
    void missingTokenCannotProduceAnUnusableInvitation() {
        assertThatThrownBy(() -> service.sendAccountActivation("Atelier", "pro@example.com", null))
            .isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(emails);
    }
}
