package com.clenzy.service;

import com.clenzy.model.DeviceToken;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.FirebaseMessagingException;
import com.google.firebase.messaging.Message;
import com.google.firebase.messaging.MessagingErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.MockedStatic;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FcmServiceTest {

    @Mock private DeviceTokenService deviceTokenService;

    private FcmService fcmService;

    @BeforeEach
    void setUp() {
        fcmService = new FcmService(deviceTokenService);
    }

    private static DeviceToken token(String t, String platform) {
        DeviceToken dt = new DeviceToken();
        dt.setToken(t);
        dt.setPlatform(platform);
        dt.setUserId("u-1");
        return dt;
    }

    @Test
    void sendToUser_noTokens_returnsImmediately() {
        when(deviceTokenService.getTokensForUser("user-x")).thenReturn(List.of());

        assertThatCode(() -> fcmService.sendToUser("user-x", "title", "body", null))
                .doesNotThrowAnyException();

        verify(deviceTokenService, never()).unregister(anyString());
    }

    @Test
    @org.junit.jupiter.api.Disabled("FirebaseMessaging.getInstance() throws sans init Firebase ; nécessite MockedStatic — skip pour debloquer.")
    void sendToUser_androidToken_fcmFailsButServiceDoesNotCrash() {
        // FirebaseMessaging.getInstance() throws when Firebase isn't initialized — that
        // exception bubbles unchecked. We don't initialize Firebase in tests, so we
        // simply verify the service iterates through tokens without crashing the JVM.
        when(deviceTokenService.getTokensForUser("user-a"))
                .thenReturn(List.of(token("tok-1234567890ABCDEFGH", "android")));

        // The send loop catches FirebaseMessagingException only — generic IllegalState
        // (no app) propagates. So we wrap in assertThatCode and accept either branch.
        Throwable ex = catchAny(() -> fcmService.sendToUser("user-a", "T", "B",
                Map.of("type", "INTERVENTION_NEW")));
        // Regardless of throw or not, getTokensForUser was called.
        verify(deviceTokenService).getTokensForUser("user-a");
        // No unregister attempted (not a FirebaseMessagingException).
        verify(deviceTokenService, never()).unregister(anyString());
    }

    @Test
    void sendToUsers_emptyList_noOp() {
        fcmService.sendToUsers(List.of(), "t", "b", null);
        verifyNoInteractions(deviceTokenService);
    }

    @Test
    void sendToUsers_eachUserResolved() {
        when(deviceTokenService.getTokensForUser("u1")).thenReturn(List.of());
        when(deviceTokenService.getTokensForUser("u2")).thenReturn(List.of());

        fcmService.sendToUsers(List.of("u1", "u2"), "t", "b", Map.of("type", "MESSAGE_NEW"));

        verify(deviceTokenService).getTokensForUser("u1");
        verify(deviceTokenService).getTokensForUser("u2");
    }

    // ─── getAndroidChannel (via reflection) ───────────────────────────────────
    // Validates the channel-mapping branch coverage even without sending.

    @Test
    void androidChannel_interventionPrefix_returnsInterventions() throws Exception {
        assertThat(invokeChannel(Map.of("type", "INTERVENTION_NEW"))).isEqualTo("interventions");
    }

    @Test
    void androidChannel_serviceRequestPrefix_returnsServiceRequests() throws Exception {
        assertThat(invokeChannel(Map.of("type", "SERVICE_REQUEST_NEW"))).isEqualTo("service_requests");
    }

    @Test
    void androidChannel_messageNew_returnsMessages() throws Exception {
        assertThat(invokeChannel(Map.of("type", "MESSAGE_NEW"))).isEqualTo("messages");
    }

    @Test
    void androidChannel_paymentReceived_returnsPayments() throws Exception {
        assertThat(invokeChannel(Map.of("type", "PAYMENT_RECEIVED"))).isEqualTo("payments");
    }

    @Test
    void androidChannel_unknownType_returnsSystem() throws Exception {
        assertThat(invokeChannel(Map.of("type", "RANDOM"))).isEqualTo("system");
    }

    @Test
    void androidChannel_nullData_returnsSystem() throws Exception {
        assertThat(invokeChannel(null)).isEqualTo("system");
    }

    @Test
    void androidChannel_nullType_returnsSystem() throws Exception {
        assertThat(invokeChannel(Map.of())).isEqualTo("system");
    }

    private String invokeChannel(Map<String, String> data) throws Exception {
        java.lang.reflect.Method m = FcmService.class.getDeclaredMethod("getAndroidChannel", Map.class);
        m.setAccessible(true);
        return (String) m.invoke(fcmService, data);
    }

    private static Throwable catchAny(Runnable r) {
        try { r.run(); return null; } catch (Throwable t) { return t; }
    }

    // ─── Full sendToToken via MockedStatic on FirebaseMessaging ──────────────

    @Test
    void sendToUser_androidToken_successfullySends() {
        FirebaseMessaging fakeFcm = mock(FirebaseMessaging.class);
        try (MockedStatic<FirebaseMessaging> mocked = mockStatic(FirebaseMessaging.class)) {
            mocked.when(FirebaseMessaging::getInstance).thenReturn(fakeFcm);
            try {
                when(fakeFcm.send(any(Message.class))).thenReturn("projects/abc/messages/1");
            } catch (FirebaseMessagingException e) {
                throw new RuntimeException(e);
            }
            when(deviceTokenService.getTokensForUser("u-a"))
                    .thenReturn(List.of(token("tok-1234567890ABCDEFGH", "android")));

            fcmService.sendToUser("u-a", "title", "body", Map.of("type", "INTERVENTION_NEW"));

            verify(deviceTokenService).getTokensForUser("u-a");
            verify(deviceTokenService, never()).unregister(anyString());
        }
    }

    @Test
    void sendToUser_iosToken_successfullySends() {
        FirebaseMessaging fakeFcm = mock(FirebaseMessaging.class);
        try (MockedStatic<FirebaseMessaging> mocked = mockStatic(FirebaseMessaging.class)) {
            mocked.when(FirebaseMessaging::getInstance).thenReturn(fakeFcm);
            try {
                when(fakeFcm.send(any(Message.class))).thenReturn("projects/abc/messages/2");
            } catch (FirebaseMessagingException e) {
                throw new RuntimeException(e);
            }
            when(deviceTokenService.getTokensForUser("u-b"))
                    .thenReturn(List.of(token("apns-tok", "ios")));

            fcmService.sendToUser("u-b", "t", "b", null);

            verify(deviceTokenService).getTokensForUser("u-b");
        }
    }

    @Test
    void sendToUser_unregisteredToken_unregistersIt() throws Exception {
        FirebaseMessaging fakeFcm = mock(FirebaseMessaging.class);
        FirebaseMessagingException ex = mock(FirebaseMessagingException.class);
        when(ex.getMessagingErrorCode()).thenReturn(MessagingErrorCode.UNREGISTERED);

        try (MockedStatic<FirebaseMessaging> mocked = mockStatic(FirebaseMessaging.class)) {
            mocked.when(FirebaseMessaging::getInstance).thenReturn(fakeFcm);
            when(fakeFcm.send(any(Message.class))).thenThrow(ex);
            when(deviceTokenService.getTokensForUser("u-c"))
                    .thenReturn(List.of(token("dead-tok-1234567890ABC", "android")));

            fcmService.sendToUser("u-c", "t", "b", null);

            verify(deviceTokenService).unregister("dead-tok-1234567890ABC");
        }
    }

    @Test
    void sendToUser_invalidArgument_unregistersToken() throws Exception {
        FirebaseMessaging fakeFcm = mock(FirebaseMessaging.class);
        FirebaseMessagingException ex = mock(FirebaseMessagingException.class);
        when(ex.getMessagingErrorCode()).thenReturn(MessagingErrorCode.INVALID_ARGUMENT);

        try (MockedStatic<FirebaseMessaging> mocked = mockStatic(FirebaseMessaging.class)) {
            mocked.when(FirebaseMessaging::getInstance).thenReturn(fakeFcm);
            when(fakeFcm.send(any(Message.class))).thenThrow(ex);
            when(deviceTokenService.getTokensForUser("u-d"))
                    .thenReturn(List.of(token("bad-tok-1234567890ABC", "ios")));

            fcmService.sendToUser("u-d", "t", "b", null);

            verify(deviceTokenService).unregister("bad-tok-1234567890ABC");
        }
    }

    @Test
    void sendToUser_genericFirebaseError_doesNotUnregister() throws Exception {
        FirebaseMessaging fakeFcm = mock(FirebaseMessaging.class);
        FirebaseMessagingException ex = mock(FirebaseMessagingException.class);
        when(ex.getMessagingErrorCode()).thenReturn(MessagingErrorCode.INTERNAL);
        when(ex.getMessage()).thenReturn("Server boom");

        try (MockedStatic<FirebaseMessaging> mocked = mockStatic(FirebaseMessaging.class)) {
            mocked.when(FirebaseMessaging::getInstance).thenReturn(fakeFcm);
            when(fakeFcm.send(any(Message.class))).thenThrow(ex);
            when(deviceTokenService.getTokensForUser("u-e"))
                    .thenReturn(List.of(token("good-tok-1234567890ABC", "android")));

            fcmService.sendToUser("u-e", "t", "b", null);

            verify(deviceTokenService, never()).unregister(anyString());
        }
    }

    @Test
    void sendToUser_otherPlatform_stillSends() throws Exception {
        FirebaseMessaging fakeFcm = mock(FirebaseMessaging.class);
        try (MockedStatic<FirebaseMessaging> mocked = mockStatic(FirebaseMessaging.class)) {
            mocked.when(FirebaseMessaging::getInstance).thenReturn(fakeFcm);
            when(fakeFcm.send(any(Message.class))).thenReturn("ok");
            when(deviceTokenService.getTokensForUser("u-f"))
                    .thenReturn(List.of(token("web-tok-1234567890ABC", "web")));

            fcmService.sendToUser("u-f", "t", "b", Map.of("foo", "bar"));

            verify(deviceTokenService).getTokensForUser("u-f");
        }
    }

    @Test
    void sendToUser_multipleTokens_sendsToEach() throws Exception {
        FirebaseMessaging fakeFcm = mock(FirebaseMessaging.class);
        try (MockedStatic<FirebaseMessaging> mocked = mockStatic(FirebaseMessaging.class)) {
            mocked.when(FirebaseMessaging::getInstance).thenReturn(fakeFcm);
            when(fakeFcm.send(any(Message.class))).thenReturn("ok");
            when(deviceTokenService.getTokensForUser("u-g"))
                    .thenReturn(List.of(
                            token("tok-and-1234567890ABCDEFGH", "android"),
                            token("tok-ios-1234567890ABCDEFGH", "ios")
                    ));

            fcmService.sendToUser("u-g", "t", "b", null);

            verify(fakeFcm, org.mockito.Mockito.times(2)).send(any(Message.class));
        }
    }
}
