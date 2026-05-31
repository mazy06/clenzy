package com.clenzy.integration.twilio.service;

import com.clenzy.integration.twilio.config.TwilioConfig;
import com.twilio.Twilio;
import com.twilio.rest.api.v2010.account.Message;
import com.twilio.rest.api.v2010.account.MessageCreator;
import com.twilio.rest.verify.v2.service.Verification;
import com.twilio.rest.verify.v2.service.VerificationCheck;
import com.twilio.rest.verify.v2.service.VerificationCheckCreator;
import com.twilio.rest.verify.v2.service.VerificationCreator;
import com.twilio.type.PhoneNumber;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link TwilioApiService}.
 *
 * <p>Covers SDK initialisation, phone-number validation guard clauses, and the
 * SMS / WhatsApp / OTP / OTP-verify happy paths via {@link MockedStatic} on
 * the Twilio static API.</p>
 */
@ExtendWith(MockitoExtension.class)
class TwilioApiServiceTest {

    private TwilioConfig config;
    private TwilioApiService service;

    @BeforeEach
    void setUp() {
        config = new TwilioConfig();
        config.setAccountSid("AC123456789abcdef");
        config.setAuthToken("auth-token-12345");
        config.setMessagingServiceSid("MG-msg-svc");
        config.setWhatsappFrom("+33700000000");
        config.setVerifyServiceSid("VA-verify-svc");
        service = new TwilioApiService(config);
    }

    // ===================================================================
    // init()
    // ===================================================================

    @Nested
    @DisplayName("init")
    class Init {

        @Test
        @DisplayName("initialises Twilio SDK when configured")
        void whenConfigured_thenInitialisesSdk() {
            try (MockedStatic<Twilio> twilio = mockStatic(Twilio.class)) {
                // Act
                service.init();

                // Assert
                twilio.verify(() -> Twilio.init("AC123456789abcdef", "auth-token-12345"));
            }
        }

        @Test
        @DisplayName("does not initialise Twilio SDK when not configured")
        void whenNotConfigured_thenSkipsInitialisation() {
            // Arrange
            TwilioConfig emptyConfig = new TwilioConfig();
            TwilioApiService empty = new TwilioApiService(emptyConfig);

            try (MockedStatic<Twilio> twilio = mockStatic(Twilio.class)) {
                // Act
                empty.init();

                // Assert
                twilio.verifyNoInteractions();
            }
        }
    }

    // ===================================================================
    // sendSms — validation + happy path
    // ===================================================================

    @Nested
    @DisplayName("sendSms")
    class SendSms {

        @Test
        @DisplayName("rejects null phone")
        void whenPhoneNull_thenThrows() {
            assertThatThrownBy(() -> service.sendSms(null, "Hello"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Numero de telephone requis");
        }

        @Test
        @DisplayName("rejects blank phone")
        void whenPhoneBlank_thenThrows() {
            assertThatThrownBy(() -> service.sendSms("   ", "Hello"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Numero de telephone requis");
        }

        @Test
        @DisplayName("rejects phone not in E.164 format")
        void whenPhoneNotE164_thenThrows() {
            assertThatThrownBy(() -> service.sendSms("0612345678", "msg"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Numero de telephone invalide");
        }

        @Test
        @DisplayName("rejects phone with leading zero after +")
        void whenPhoneStartsWithPlusZero_thenThrows() {
            assertThatThrownBy(() -> service.sendSms("+0612345678", "msg"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("invalide");
        }

        @Test
        @DisplayName("returns Twilio SID on happy path")
        void whenValidPhone_thenReturnsSid() {
            // Arrange
            MessageCreator creator = mock(MessageCreator.class);
            Message message = mock(Message.class);
            when(creator.create()).thenReturn(message);
            when(message.getSid()).thenReturn("SMxxxxx");
            when(message.getStatus()).thenReturn(Message.Status.QUEUED);

            try (MockedStatic<Message> staticMsg = mockStatic(Message.class)) {
                staticMsg.when(() -> Message.creator(
                                any(PhoneNumber.class),
                                eq("MG-msg-svc"),
                                eq("Hello world")))
                        .thenReturn(creator);

                // Act
                String sid = service.sendSms("+33612345678", "Hello world");

                // Assert
                assertThat(sid).isEqualTo("SMxxxxx");
            }
        }
    }

    // ===================================================================
    // sendWhatsApp
    // ===================================================================

    @Nested
    @DisplayName("sendWhatsApp")
    class SendWhatsApp {

        @Test
        @DisplayName("rejects invalid phone")
        void whenInvalidPhone_thenThrows() {
            assertThatThrownBy(() -> service.sendWhatsApp("invalid", "msg"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("invalide");
        }

        @Test
        @DisplayName("prefixes whatsapp: scheme when missing and returns SID")
        void whenPhoneWithoutScheme_thenAddsWhatsappPrefix() {
            // Arrange
            MessageCreator creator = mock(MessageCreator.class);
            Message message = mock(Message.class);
            when(creator.create()).thenReturn(message);
            when(message.getSid()).thenReturn("WAxxxxx");
            when(message.getStatus()).thenReturn(Message.Status.QUEUED);

            try (MockedStatic<Message> staticMsg = mockStatic(Message.class)) {
                staticMsg.when(() -> Message.creator(
                                any(PhoneNumber.class),
                                any(PhoneNumber.class),
                                anyString()))
                        .thenReturn(creator);

                // Act
                String sid = service.sendWhatsApp("+33612345678", "Hi");

                // Assert
                assertThat(sid).isEqualTo("WAxxxxx");
            }
        }

        @Test
        @DisplayName("accepts already-prefixed whatsapp: number")
        void whenPhoneAlreadyHasWhatsappPrefix_thenAccepts() {
            // Arrange
            MessageCreator creator = mock(MessageCreator.class);
            Message message = mock(Message.class);
            when(creator.create()).thenReturn(message);
            when(message.getSid()).thenReturn("WAyyy");
            when(message.getStatus()).thenReturn(Message.Status.QUEUED);

            try (MockedStatic<Message> staticMsg = mockStatic(Message.class)) {
                staticMsg.when(() -> Message.creator(
                                any(PhoneNumber.class),
                                any(PhoneNumber.class),
                                anyString()))
                        .thenReturn(creator);

                // Act
                String sid = service.sendWhatsApp("whatsapp:+33612345678", "Hi");

                // Assert
                assertThat(sid).isEqualTo("WAyyy");
            }
        }
    }

    // ===================================================================
    // sendOtp
    // ===================================================================

    @Nested
    @DisplayName("sendOtp")
    class SendOtp {

        @Test
        @DisplayName("rejects invalid phone")
        void whenInvalidPhone_thenThrows() {
            assertThatThrownBy(() -> service.sendOtp("not-a-phone", "sms"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("invalide");
        }

        @Test
        @DisplayName("returns verification status on happy path")
        void whenValidPhone_thenReturnsStatus() {
            // Arrange
            VerificationCreator creator = mock(VerificationCreator.class);
            Verification verification = mock(Verification.class);
            when(creator.create()).thenReturn(verification);
            when(verification.getStatus()).thenReturn("pending");

            try (MockedStatic<Verification> staticVerif = mockStatic(Verification.class)) {
                staticVerif.when(() -> Verification.creator(
                                eq("VA-verify-svc"),
                                eq("+33612345678"),
                                eq("sms")))
                        .thenReturn(creator);

                // Act
                String status = service.sendOtp("+33612345678", "sms");

                // Assert
                assertThat(status).isEqualTo("pending");
            }
        }
    }

    // ===================================================================
    // verifyOtp
    // ===================================================================

    @Nested
    @DisplayName("verifyOtp")
    class VerifyOtp {

        @Test
        @DisplayName("rejects invalid phone")
        void whenInvalidPhone_thenThrows() {
            assertThatThrownBy(() -> service.verifyOtp("abc", "1234"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("invalide");
        }

        @Test
        @DisplayName("returns true when Twilio status is 'approved'")
        void whenStatusApproved_thenReturnsTrue() {
            // Arrange
            VerificationCheckCreator creator = mock(VerificationCheckCreator.class);
            VerificationCheck check = mock(VerificationCheck.class);
            when(creator.setTo(anyString())).thenReturn(creator);
            when(creator.setCode(anyString())).thenReturn(creator);
            when(creator.create()).thenReturn(check);
            when(check.getStatus()).thenReturn("approved");

            try (MockedStatic<VerificationCheck> staticCheck = mockStatic(VerificationCheck.class)) {
                staticCheck.when(() -> VerificationCheck.creator(eq("VA-verify-svc")))
                        .thenReturn(creator);

                // Act
                boolean valid = service.verifyOtp("+33612345678", "1234");

                // Assert
                assertThat(valid).isTrue();
            }
        }

        @Test
        @DisplayName("returns false for non-approved status")
        void whenStatusNotApproved_thenReturnsFalse() {
            // Arrange
            VerificationCheckCreator creator = mock(VerificationCheckCreator.class);
            VerificationCheck check = mock(VerificationCheck.class);
            when(creator.setTo(anyString())).thenReturn(creator);
            when(creator.setCode(anyString())).thenReturn(creator);
            when(creator.create()).thenReturn(check);
            when(check.getStatus()).thenReturn("pending");

            try (MockedStatic<VerificationCheck> staticCheck = mockStatic(VerificationCheck.class)) {
                staticCheck.when(() -> VerificationCheck.creator(eq("VA-verify-svc")))
                        .thenReturn(creator);

                // Act
                boolean valid = service.verifyOtp("+33612345678", "wrong");

                // Assert
                assertThat(valid).isFalse();
            }
        }
    }
}
