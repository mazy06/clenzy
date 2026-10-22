package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.NotificationRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.tenant.TenantContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class BaitlyOperationalNotificationTest {
    final NotificationRepository rows = mock(NotificationRepository.class);
    final NotificationPreferenceService preferences = mock(NotificationPreferenceService.class);
    final UserRepository users = mock(UserRepository.class);
    final NotificationService service = new NotificationService(rows, preferences, users,
            mock(TenantContext.class), mock(OutboxPublisher.class), new ObjectMapper(), mock(NotificationFactsResolver.class));

    User user(String id, Long org) {
        User user = new User(); user.setKeycloakId(id); user.setOrganizationId(org); return user;
    }

    void staff(User... staff) {
        when(users.findByStatusAndRoleInAndKeycloakIdIsNotNullOrderByFirstNameAscLastNameAsc(
                eq(UserStatus.ACTIVE), eq(List.of(UserRole.SUPER_ADMIN, UserRole.SUPER_MANAGER))))
                .thenReturn(List.of(staff));
    }

    @Test void returnsPersistedCountAndPreservesRecipientOrganizationAndPreferences() {
        staff(user("enabled", 10L), user("disabled", 20L), user(null, 30L));
        when(preferences.isEnabled("enabled", NotificationKey.OPS_ALERT)).thenReturn(true);
        when(rows.save(any(Notification.class))).thenAnswer(inv -> {
            Notification row = inv.getArgument(0); row.setId(1L); row.setCreatedAt(Instant.now()); return row;
        });
        assertThat(service.notifyPlatformOpsStrict("Synthetic", "Test", null)).isEqualTo(1);
        var saved = ArgumentCaptor.forClass(Notification.class);
        verify(rows).save(saved.capture());
        assertThat(saved.getValue().getOrganizationId()).isEqualTo(10L);
        assertThat(saved.getValue().getUserId()).isEqualTo("enabled");
        assertThat(saved.getValue().getNotificationKey()).isEqualTo(NotificationKey.OPS_ALERT);
    }

    @Test void storageFailurePropagatesForDurableSenderRetry() {
        staff(user("staff", 10L));
        when(preferences.isEnabled("staff", NotificationKey.OPS_ALERT)).thenReturn(true);
        when(rows.save(any(Notification.class))).thenThrow(new IllegalStateException("storage unavailable"));
        assertThatThrownBy(() -> service.notifyPlatformOpsStrict("Synthetic", "Test", null))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test void emptyStaffListCannotBeAcknowledgedAsNotified() {
        staff();
        assertThatThrownBy(() -> service.notifyPlatformOpsStrict("Synthetic", "Test", null))
                .isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(rows);
    }

    @Test void disabledPreferencesRemainDisabledButMissingDeliveryIsReported() {
        staff(user("disabled", 10L));
        assertThatThrownBy(() -> service.notifyPlatformOpsStrict("Synthetic", "Test", null))
                .isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(rows);
    }
}
