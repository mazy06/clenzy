package com.clenzy.service;

import com.clenzy.dto.NotificationDto;
import com.clenzy.model.*;
import com.clenzy.repository.NotificationRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class NotificationServiceTest {

    @Mock private NotificationRepository notificationRepository;
    @Mock private NotificationPreferenceService preferenceService;
    @Mock private UserRepository userRepository;
    @Mock private TenantContext tenantContext;

    private NotificationService service;

    private static final String USER_ID = "user-kc-123";
    private static final Long ORG_ID = 42L;
    private static final String TITLE = "Test Title";
    private static final String MESSAGE = "Test message body";
    private static final String ACTION_URL = "/dashboard/interventions/99";

    @BeforeEach
    void setUp() {
        service = new NotificationService(
                notificationRepository,
                preferenceService,
                userRepository,
                tenantContext
        );
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private Notification buildNotification(String userId, NotificationType type, NotificationCategory category) {
        Notification n = new Notification(userId, TITLE, MESSAGE, type, category);
        n.setId(1L);
        n.setActionUrl(ACTION_URL);
        n.setOrganizationId(ORG_ID);
        n.setCreatedAt(LocalDateTime.of(2026, 2, 22, 10, 0));
        return n;
    }

    private Notification buildDefaultNotification() {
        return buildNotification(USER_ID, NotificationType.INFO, NotificationCategory.SYSTEM);
    }

    // ─── getAllForUser ─────────────────────────────────────────────────────────

    @Nested
    class GetAllForUser {

        @Test
        void getAllForUser_withExistingNotifications_returnsMappedDtos() {
            Notification n1 = buildNotification(USER_ID, NotificationType.INFO, NotificationCategory.SYSTEM);
            n1.setId(1L);
            Notification n2 = buildNotification(USER_ID, NotificationType.WARNING, NotificationCategory.INTERVENTION);
            n2.setId(2L);
            n2.setTitle("Second");

            when(notificationRepository.findByUserIdOrderByCreatedAtDesc(USER_ID))
                    .thenReturn(List.of(n1, n2));

            List<NotificationDto> result = service.getAllForUser(USER_ID);

            assertEquals(2, result.size());
            assertEquals(1L, result.get(0).id);
            assertEquals(2L, result.get(1).id);
            assertEquals("info", result.get(0).type);
            assertEquals("warning", result.get(1).type);
            verify(notificationRepository).findByUserIdOrderByCreatedAtDesc(USER_ID);
        }

        @Test
        void getAllForUser_withNoNotifications_returnsEmptyList() {
            when(notificationRepository.findByUserIdOrderByCreatedAtDesc(USER_ID))
                    .thenReturn(Collections.emptyList());

            List<NotificationDto> result = service.getAllForUser(USER_ID);

            assertTrue(result.isEmpty());
        }
    }

    // ─── getUnreadCount ───────────────────────────────────────────────────────

    @Test
    void getUnreadCount_delegatesToRepository() {
        when(notificationRepository.countByUserIdAndReadFalse(USER_ID)).thenReturn(5L);

        long count = service.getUnreadCount(USER_ID);

        assertEquals(5L, count);
        verify(notificationRepository).countByUserIdAndReadFalse(USER_ID);
    }

    // ─── markAsRead ───────────────────────────────────────────────────────────

    @Nested
    class MarkAsRead {

        @Test
        void markAsRead_whenFound_marksReadAndReturnsDto() {
            Notification notification = buildDefaultNotification();
            notification.setRead(false);

            when(notificationRepository.findByIdAndUserId(1L, USER_ID))
                    .thenReturn(Optional.of(notification));
            when(notificationRepository.save(notification)).thenReturn(notification);

            NotificationDto result = service.markAsRead(1L, USER_ID);

            assertTrue(notification.isRead());
            assertNotNull(result);
            assertEquals(1L, result.id);
            verify(notificationRepository).save(notification);
        }

        @Test
        void markAsRead_whenNotFound_throwsIllegalArgumentException() {
            when(notificationRepository.findByIdAndUserId(999L, USER_ID))
                    .thenReturn(Optional.empty());

            IllegalArgumentException ex = assertThrows(
                    IllegalArgumentException.class,
                    () -> service.markAsRead(999L, USER_ID)
            );

            assertTrue(ex.getMessage().contains("introuvable"));
            verify(notificationRepository, never()).save(any());
        }
    }

    // ─── markAllAsRead ────────────────────────────────────────────────────────

    @Test
    void markAllAsRead_delegatesToRepositoryWithOrgId() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
        when(notificationRepository.markAllAsReadByUserId(USER_ID, ORG_ID)).thenReturn(3);

        service.markAllAsRead(USER_ID);

        verify(notificationRepository).markAllAsReadByUserId(USER_ID, ORG_ID);
        verify(tenantContext).getRequiredOrganizationId();
    }

    // ─── delete ───────────────────────────────────────────────────────────────

    @Nested
    class Delete {

        @Test
        void delete_whenFound_deletesNotification() {
            Notification notification = buildDefaultNotification();

            when(notificationRepository.findByIdAndUserId(1L, USER_ID))
                    .thenReturn(Optional.of(notification));

            service.delete(1L, USER_ID);

            verify(notificationRepository).delete(notification);
        }

        @Test
        void delete_whenNotFound_throwsIllegalArgumentException() {
            when(notificationRepository.findByIdAndUserId(999L, USER_ID))
                    .thenReturn(Optional.empty());

            IllegalArgumentException ex = assertThrows(
                    IllegalArgumentException.class,
                    () -> service.delete(999L, USER_ID)
            );

            assertTrue(ex.getMessage().contains("introuvable"));
            verify(notificationRepository, never()).delete(any(Notification.class));
        }
    }

    // ─── create (legacy) ──────────────────────────────────────────────────────

    @Nested
    class Create {

        @Test
        void create_savesNotificationWithCorrectFieldsAndReturnsDto() {
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);

            ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
            when(notificationRepository.save(captor.capture())).thenAnswer(invocation -> {
                Notification saved = invocation.getArgument(0);
                saved.setId(10L);
                saved.setCreatedAt(LocalDateTime.now());
                return saved;
            });

            NotificationDto result = service.create(
                    USER_ID, TITLE, MESSAGE,
                    NotificationType.WARNING, NotificationCategory.PAYMENT,
                    ACTION_URL
            );

            Notification captured = captor.getValue();
            assertEquals(USER_ID, captured.getUserId());
            assertEquals(TITLE, captured.getTitle());
            assertEquals(MESSAGE, captured.getMessage());
            assertEquals(NotificationType.WARNING, captured.getType());
            assertEquals(NotificationCategory.PAYMENT, captured.getCategory());
            assertEquals(ACTION_URL, captured.getActionUrl());
            assertEquals(ORG_ID, captured.getOrganizationId());

            assertNotNull(result);
            assertEquals(10L, result.id);
            assertEquals("warning", result.type);
            assertEquals("payment", result.category);
        }
    }

    // ─── createInfo / createSuccess / createWarning / createError ─────────────

    @Nested
    class CreateShortcuts {

        @BeforeEach
        void setUpTenant() {
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            when(notificationRepository.save(any(Notification.class))).thenAnswer(invocation -> {
                Notification saved = invocation.getArgument(0);
                saved.setId(1L);
                saved.setCreatedAt(LocalDateTime.now());
                return saved;
            });
        }

        @Test
        void createInfo_delegatesWithInfoType() {
            service.createInfo(USER_ID, TITLE, MESSAGE, NotificationCategory.SYSTEM, ACTION_URL);

            ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
            verify(notificationRepository).save(captor.capture());
            assertEquals(NotificationType.INFO, captor.getValue().getType());
        }

        @Test
        void createSuccess_delegatesWithSuccessType() {
            service.createSuccess(USER_ID, TITLE, MESSAGE, NotificationCategory.SYSTEM, ACTION_URL);

            ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
            verify(notificationRepository).save(captor.capture());
            assertEquals(NotificationType.SUCCESS, captor.getValue().getType());
        }

        @Test
        void createWarning_delegatesWithWarningType() {
            service.createWarning(USER_ID, TITLE, MESSAGE, NotificationCategory.SYSTEM, ACTION_URL);

            ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
            verify(notificationRepository).save(captor.capture());
            assertEquals(NotificationType.WARNING, captor.getValue().getType());
        }

        @Test
        void createError_delegatesWithErrorType() {
            service.createError(USER_ID, TITLE, MESSAGE, NotificationCategory.SYSTEM, ACTION_URL);

            ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
            verify(notificationRepository).save(captor.capture());
            assertEquals(NotificationType.ERROR, captor.getValue().getType());
        }
    }

    // ─── send ─────────────────────────────────────────────────────────────────

    @Nested
    class Send {

        private static final NotificationKey KEY = NotificationKey.INTERVENTION_CREATED;

        @Test
        void send_whenUserIdNull_returnsNull() {
            NotificationDto result = service.send(null, KEY, TITLE, MESSAGE, ACTION_URL);

            assertNull(result);
            verifyNoInteractions(preferenceService);
            verifyNoInteractions(notificationRepository);
        }

        @Test
        void send_whenKeyNull_returnsNull() {
            NotificationDto result = service.send(USER_ID, null, TITLE, MESSAGE, ACTION_URL);

            assertNull(result);
            verifyNoInteractions(preferenceService);
            verifyNoInteractions(notificationRepository);
        }

        @Test
        void send_whenPreferenceDisabled_returnsNull() {
            when(preferenceService.isEnabled(USER_ID, KEY)).thenReturn(false);

            NotificationDto result = service.send(USER_ID, KEY, TITLE, MESSAGE, ACTION_URL);

            assertNull(result);
            verify(preferenceService).isEnabled(USER_ID, KEY);
            verifyNoInteractions(notificationRepository);
        }

        @Test
        void send_whenPreferenceEnabled_createsAndSavesNotification() {
            when(preferenceService.isEnabled(USER_ID, KEY)).thenReturn(true);
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);

            ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
            when(notificationRepository.save(captor.capture())).thenAnswer(invocation -> {
                Notification saved = invocation.getArgument(0);
                saved.setId(7L);
                saved.setCreatedAt(LocalDateTime.now());
                return saved;
            });

            NotificationDto result = service.send(USER_ID, KEY, TITLE, MESSAGE, ACTION_URL);

            assertNotNull(result);
            assertEquals(7L, result.id);

            Notification captured = captor.getValue();
            assertEquals(USER_ID, captured.getUserId());
            assertEquals(TITLE, captured.getTitle());
            assertEquals(MESSAGE, captured.getMessage());
            assertEquals(KEY.getDefaultType(), captured.getType());
            assertEquals(KEY.getCategory(), captured.getCategory());
            assertEquals(KEY, captured.getNotificationKey());
            assertEquals(ACTION_URL, captured.getActionUrl());
            assertEquals(ORG_ID, captured.getOrganizationId());
        }

        @Test
        void send_whenExceptionOccurs_returnsNullAndNeverThrows() {
            when(preferenceService.isEnabled(USER_ID, KEY)).thenReturn(true);
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            when(notificationRepository.save(any(Notification.class)))
                    .thenThrow(new RuntimeException("DB connection lost"));

            NotificationDto result = service.send(USER_ID, KEY, TITLE, MESSAGE, ACTION_URL);

            assertNull(result);
            // No exception propagated
        }
    }

    // ─── notifyAdminsAndManagers ──────────────────────────────────────────────

    @Nested
    class NotifyAdminsAndManagers {

        private static final NotificationKey KEY = NotificationKey.INTERVENTION_OVERDUE;

        @Test
        void notifyAdminsAndManagers_findsUsersAndSendsForEach() {
            User admin = new User();
            admin.setKeycloakId("admin-kc-1");
            User manager = new User();
            manager.setKeycloakId("manager-kc-2");

            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(userRepository.findByRoleIn(
                    Arrays.asList(UserRole.SUPER_ADMIN, UserRole.SUPER_MANAGER), ORG_ID
            )).thenReturn(List.of(admin, manager));

            // Stub the send path (preference enabled)
            when(preferenceService.isEnabled(anyString(), eq(KEY))).thenReturn(true);
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            when(notificationRepository.save(any(Notification.class))).thenAnswer(invocation -> {
                Notification saved = invocation.getArgument(0);
                saved.setId(1L);
                saved.setCreatedAt(LocalDateTime.now());
                return saved;
            });

            service.notifyAdminsAndManagers(KEY, TITLE, MESSAGE, ACTION_URL);

            verify(preferenceService).isEnabled("admin-kc-1", KEY);
            verify(preferenceService).isEnabled("manager-kc-2", KEY);
            verify(notificationRepository, times(2)).save(any(Notification.class));
        }

        @Test
        void notifyAdminsAndManagers_skipsUsersWithNullKeycloakId() {
            User admin = new User();
            admin.setKeycloakId("admin-kc-1");
            User userNoKc = new User();
            userNoKc.setKeycloakId(null);

            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(userRepository.findByRoleIn(
                    Arrays.asList(UserRole.SUPER_ADMIN, UserRole.SUPER_MANAGER), ORG_ID
            )).thenReturn(List.of(admin, userNoKc));

            // Stub send for the admin
            when(preferenceService.isEnabled("admin-kc-1", KEY)).thenReturn(true);
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            when(notificationRepository.save(any(Notification.class))).thenAnswer(invocation -> {
                Notification saved = invocation.getArgument(0);
                saved.setId(1L);
                saved.setCreatedAt(LocalDateTime.now());
                return saved;
            });

            service.notifyAdminsAndManagers(KEY, TITLE, MESSAGE, ACTION_URL);

            // Only one notification created (for admin), null keycloakId user skipped via send() null guard
            verify(preferenceService, times(1)).isEnabled(anyString(), eq(KEY));
        }

        @Test
        void notifyAdminsAndManagers_whenExceptionOccurs_swallowsIt() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(userRepository.findByRoleIn(any(), eq(ORG_ID)))
                    .thenThrow(new RuntimeException("DB error"));

            // Should not throw
            assertDoesNotThrow(() ->
                    service.notifyAdminsAndManagers(KEY, TITLE, MESSAGE, ACTION_URL)
            );
        }
    }

    // ─── notifyUsers ──────────────────────────────────────────────────────────

    @Nested
    class NotifyUsers {

        private static final NotificationKey KEY = NotificationKey.TEAM_MEMBER_ADDED;

        @Test
        void notifyUsers_whenNullList_doesNothing() {
            service.notifyUsers(null, KEY, TITLE, MESSAGE, ACTION_URL);

            verifyNoInteractions(preferenceService);
            verifyNoInteractions(notificationRepository);
        }

        @Test
        void notifyUsers_whenEmptyList_doesNothing() {
            service.notifyUsers(Collections.emptyList(), KEY, TITLE, MESSAGE, ACTION_URL);

            verifyNoInteractions(preferenceService);
            verifyNoInteractions(notificationRepository);
        }

        @Test
        void notifyUsers_filtersNullsAndDuplicates() {
            when(preferenceService.isEnabled(anyString(), eq(KEY))).thenReturn(true);
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            when(notificationRepository.save(any(Notification.class))).thenAnswer(invocation -> {
                Notification saved = invocation.getArgument(0);
                saved.setId(1L);
                saved.setCreatedAt(LocalDateTime.now());
                return saved;
            });

            List<String> ids = Arrays.asList("user-1", null, "user-2", "user-1", null, "user-2");

            service.notifyUsers(ids, KEY, TITLE, MESSAGE, ACTION_URL);

            // Only "user-1" and "user-2" should trigger send() (nulls filtered, duplicates removed)
            verify(preferenceService, times(2)).isEnabled(anyString(), eq(KEY));
            verify(preferenceService).isEnabled("user-1", KEY);
            verify(preferenceService).isEnabled("user-2", KEY);
        }
    }

    // ─── notify ───────────────────────────────────────────────────────────────

    @Nested
    class Notify {

        private static final NotificationKey KEY = NotificationKey.PAYMENT_CONFIRMED;

        @Test
        void notify_whenKeycloakIdNull_doesNothing() {
            service.notify(null, KEY, TITLE, MESSAGE, ACTION_URL);

            verifyNoInteractions(preferenceService);
            verifyNoInteractions(notificationRepository);
        }

        @Test
        void notify_delegatesToSend() {
            when(preferenceService.isEnabled(USER_ID, KEY)).thenReturn(true);
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            when(notificationRepository.save(any(Notification.class))).thenAnswer(invocation -> {
                Notification saved = invocation.getArgument(0);
                saved.setId(1L);
                saved.setCreatedAt(LocalDateTime.now());
                return saved;
            });

            service.notify(USER_ID, KEY, TITLE, MESSAGE, ACTION_URL);

            verify(preferenceService).isEnabled(USER_ID, KEY);
            verify(notificationRepository).save(any(Notification.class));
        }
    }
}
