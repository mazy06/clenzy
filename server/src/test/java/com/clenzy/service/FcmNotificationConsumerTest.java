package com.clenzy.service;

import com.google.firebase.FirebaseApp;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class FcmNotificationConsumerTest {

    private FcmService fcmService;
    private FcmNotificationConsumer consumer;

    @BeforeEach
    void setUp() {
        fcmService = mock(FcmService.class);
        consumer = new FcmNotificationConsumer(fcmService);
    }

    @Test
    @DisplayName("when Firebase not initialized, skip silently")
    void firebaseNotInitialized_skips() {
        try (MockedStatic<FirebaseApp> mocked = mockStatic(FirebaseApp.class)) {
            mocked.when(FirebaseApp::getApps).thenReturn(List.of());

            Map<String, Object> event = Map.of("userId", "u1", "title", "Hi", "message", "Body");
            consumer.handleNotificationEvent(event);

            verifyNoInteractions(fcmService);
        }
    }

    @Test
    @DisplayName("when userId missing, do not send")
    void missingUserId_skips() {
        try (MockedStatic<FirebaseApp> mocked = mockStatic(FirebaseApp.class)) {
            FirebaseApp app = mock(FirebaseApp.class);
            mocked.when(FirebaseApp::getApps).thenReturn(List.of(app));

            Map<String, Object> event = new HashMap<>();
            event.put("title", "Hi");

            consumer.handleNotificationEvent(event);

            verifyNoInteractions(fcmService);
        }
    }

    @Test
    @DisplayName("when title missing, do not send")
    void missingTitle_skips() {
        try (MockedStatic<FirebaseApp> mocked = mockStatic(FirebaseApp.class)) {
            FirebaseApp app = mock(FirebaseApp.class);
            mocked.when(FirebaseApp::getApps).thenReturn(List.of(app));

            Map<String, Object> event = new HashMap<>();
            event.put("userId", "u1");

            consumer.handleNotificationEvent(event);

            verifyNoInteractions(fcmService);
        }
    }

    @Test
    @DisplayName("sends single user notification with full data map")
    void singleUser_sendsWithData() {
        try (MockedStatic<FirebaseApp> mocked = mockStatic(FirebaseApp.class)) {
            FirebaseApp app = mock(FirebaseApp.class);
            mocked.when(FirebaseApp::getApps).thenReturn(List.of(app));

            Map<String, Object> event = new HashMap<>();
            event.put("userId", "u1");
            event.put("title", "Hello");
            event.put("message", "Body");
            event.put("notificationType", "BOOKING");
            event.put("entityId", 12345L);
            event.put("actionUrl", "/bookings/1");

            consumer.handleNotificationEvent(event);

            verify(fcmService).sendToUser(eq("u1"), eq("Hello"), eq("Body"), any());
        }
    }

    @Test
    @DisplayName("sends to multiple users when targetUserIds list provided")
    void multipleUsers_sendsToList() {
        try (MockedStatic<FirebaseApp> mocked = mockStatic(FirebaseApp.class)) {
            FirebaseApp app = mock(FirebaseApp.class);
            mocked.when(FirebaseApp::getApps).thenReturn(List.of(app));

            Map<String, Object> event = new HashMap<>();
            event.put("userId", "ignored");
            event.put("title", "Group");
            event.put("message", "Multi");
            event.put("targetUserIds", List.of("u1", "u2", "u3"));

            consumer.handleNotificationEvent(event);

            verify(fcmService).sendToUsers(eq(List.of("u1", "u2", "u3")), eq("Group"), eq("Multi"), any());
            verify(fcmService, never()).sendToUser(anyString(), anyString(), any(), any());
        }
    }

    @Test
    @DisplayName("filters non-String items from targetUserIds")
    void targetUserIds_filtersNonString() {
        try (MockedStatic<FirebaseApp> mocked = mockStatic(FirebaseApp.class)) {
            FirebaseApp app = mock(FirebaseApp.class);
            mocked.when(FirebaseApp::getApps).thenReturn(List.of(app));

            Map<String, Object> event = new HashMap<>();
            event.put("userId", "fallback");
            event.put("title", "T");
            event.put("targetUserIds", List.of("u1", 42, "u2"));

            consumer.handleNotificationEvent(event);

            verify(fcmService).sendToUsers(eq(List.of("u1", "u2")), eq("T"), any(), any());
        }
    }

    @Test
    @DisplayName("exception swallowed (best-effort)")
    void exception_swallowed() {
        try (MockedStatic<FirebaseApp> mocked = mockStatic(FirebaseApp.class)) {
            FirebaseApp app = mock(FirebaseApp.class);
            mocked.when(FirebaseApp::getApps).thenReturn(List.of(app));

            doThrow(new RuntimeException("boom")).when(fcmService)
                    .sendToUser(anyString(), anyString(), any(), any());

            Map<String, Object> event = Map.of("userId", "u1", "title", "T", "message", "B");

            // Must not throw
            consumer.handleNotificationEvent(event);
        }
    }

    @Test
    @DisplayName("entityId numeric is coerced to String")
    void entityIdNumeric_coerced() {
        try (MockedStatic<FirebaseApp> mocked = mockStatic(FirebaseApp.class)) {
            FirebaseApp app = mock(FirebaseApp.class);
            mocked.when(FirebaseApp::getApps).thenReturn(List.of(app));

            Map<String, Object> event = new HashMap<>();
            event.put("userId", "u1");
            event.put("title", "T");
            event.put("entityId", 999L);
            event.put("notificationType", "INTERVENTION");

            consumer.handleNotificationEvent(event);

            verify(fcmService).sendToUser(eq("u1"), eq("T"), any(), any());
        }
    }
}
