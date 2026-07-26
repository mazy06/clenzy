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
    private com.clenzy.repository.NotificationRepository notificationRepository;
    private FcmNotificationConsumer consumer;

    @BeforeEach
    void setUp() {
        fcmService = mock(FcmService.class);
        notificationRepository = mock(com.clenzy.repository.NotificationRepository.class);
        consumer = new FcmNotificationConsumer(fcmService, notificationRepository);
    }

    /** La notification persistee : desormais seule source du destinataire et du contenu. */
    private com.clenzy.model.Notification storedNotification(String userId, String title, String message) {
        com.clenzy.model.Notification n = new com.clenzy.model.Notification();
        n.setId(42L);
        n.setOrganizationId(7L);
        n.setUserId(userId);
        n.setTitle(title);
        n.setMessage(message);
        when(notificationRepository.findById(42L)).thenReturn(java.util.Optional.of(n));
        return n;
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

            storedNotification("u1", "Hello", "Body");

            Map<String, Object> event = new HashMap<>();
            event.put("notificationId", 42L);
            event.put("entityId", 12345L);

            consumer.handleNotificationEvent(event);

            verify(fcmService).sendToUser(eq("u1"), eq("Hello"), eq("Body"), any());
        }
    }

    /**
     * Audit 2026-07 (P5-08) — ce test validait auparavant le broadcast par targetUserIds.
     * Ce champ n'etait produit par AUCUN code du projet : sa seule voie d'acces etait un
     * evenement forge, ce qui en faisait une primitive de push de masse avec titre et corps
     * libres. Il est supprime ; le test verifie desormais qu'il n'est plus honore.
     */
    @Test
    @DisplayName("targetUserIds forge n'est plus honore — pas de broadcast (P5-08)")
    void forgedBroadcastListIsIgnored() {
        try (MockedStatic<FirebaseApp> mocked = mockStatic(FirebaseApp.class)) {
            FirebaseApp app = mock(FirebaseApp.class);
            mocked.when(FirebaseApp::getApps).thenReturn(List.of(app));
            storedNotification("u1", "Titre legitime", "Corps legitime");

            Map<String, Object> event = new HashMap<>();
            event.put("notificationId", 42L);
            event.put("targetUserIds", List.of("u1", "u2", "u3"));

            consumer.handleNotificationEvent(event);

            verify(fcmService, never()).sendToUsers(any(), anyString(), any(), any());
            verify(fcmService).sendToUser(eq("u1"), eq("Titre legitime"), eq("Corps legitime"), any());
        }
    }

    /**
     * Le cas d'attaque complet : un evenement forge annoncant un autre destinataire et un
     * contenu de phishing. Seule la notification persistee fait foi.
     */
    @Test
    @DisplayName("titre, corps et destinataire viennent de la base, pas de l'evenement (P5-08)")
    void contentComesFromStoredNotification() {
        try (MockedStatic<FirebaseApp> mocked = mockStatic(FirebaseApp.class)) {
            FirebaseApp app = mock(FirebaseApp.class);
            mocked.when(FirebaseApp::getApps).thenReturn(List.of(app));
            storedNotification("kc-victime", "Intervention assignee", "Demain 14h");

            Map<String, Object> event = new HashMap<>();
            event.put("notificationId", 42L);
            event.put("userId", "kc-attaquant");
            event.put("title", "Votre compte va etre suspendu");
            event.put("message", "Confirmez vos identifiants ici");

            consumer.handleNotificationEvent(event);

            verify(fcmService).sendToUser(
                    eq("kc-victime"), eq("Intervention assignee"), eq("Demain 14h"), any());
        }
    }

    @Test
    @DisplayName("notification inconnue : aucun push")
    void unknownNotification_skips() {
        try (MockedStatic<FirebaseApp> mocked = mockStatic(FirebaseApp.class)) {
            FirebaseApp app = mock(FirebaseApp.class);
            mocked.when(FirebaseApp::getApps).thenReturn(List.of(app));
            when(notificationRepository.findById(4242L)).thenReturn(java.util.Optional.empty());

            Map<String, Object> event = new HashMap<>();
            event.put("notificationId", 4242L);

            consumer.handleNotificationEvent(event);

            verifyNoInteractions(fcmService);
        }
    }

    @Test
    @DisplayName("exception swallowed (best-effort)")
    void exception_swallowed() {
        try (MockedStatic<FirebaseApp> mocked = mockStatic(FirebaseApp.class)) {
            FirebaseApp app = mock(FirebaseApp.class);
            mocked.when(FirebaseApp::getApps).thenReturn(List.of(app));

            storedNotification("u1", "T", "B");
            doThrow(new RuntimeException("boom")).when(fcmService)
                    .sendToUser(anyString(), anyString(), any(), any());

            Map<String, Object> event = Map.of("notificationId", 42L);

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

            storedNotification("u1", "T", null);

            Map<String, Object> event = new HashMap<>();
            event.put("notificationId", 42L);
            event.put("entityId", 999L);

            consumer.handleNotificationEvent(event);

            verify(fcmService).sendToUser(eq("u1"), eq("T"), any(), any());
        }
    }
}
