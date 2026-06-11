package com.clenzy.payment.payout;

import com.clenzy.model.NotificationKey;
import com.clenzy.model.OwnerPayout;
import com.clenzy.model.User;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.NotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PayoutNotifierTest {

    @Mock private NotificationService notificationService;
    @Mock private UserRepository userRepository;

    private PayoutNotifier notifier;

    @BeforeEach
    void setUp() {
        notifier = new PayoutNotifier(notificationService, userRepository);
    }

    private OwnerPayout buildPayout() {
        OwnerPayout p = new OwnerPayout();
        p.setId(10L);
        p.setOrganizationId(1L);
        p.setOwnerId(20L);
        p.setNetAmount(new BigDecimal("500.00"));
        p.setCurrency("EUR");
        p.setPaymentReference("PAY-REF-1");
        return p;
    }

    @Test
    void notifySuccess_notifiesAdminsAndOwner() {
        OwnerPayout payout = buildPayout();
        User owner = new User();
        owner.setKeycloakId("kc-owner");
        when(userRepository.findById(20L)).thenReturn(Optional.of(owner));

        notifier.notifySuccess(payout);

        verify(notificationService).notifyAdminsAndManagersByOrgId(
            eq(1L), eq(NotificationKey.PAYOUT_EXECUTED),
            contains("Reversement execute"),
            any(String.class), eq("/billing"));
        verify(notificationService).sendByOrgId(
            eq("kc-owner"), eq(NotificationKey.PAYOUT_EXECUTED),
            any(String.class), any(String.class), eq("/billing"), eq(1L));
    }

    @Test
    void notifySuccess_ownerWithoutKeycloakId_skipsOwnerNotification() {
        OwnerPayout payout = buildPayout();
        User owner = new User();
        owner.setKeycloakId(null);
        when(userRepository.findById(20L)).thenReturn(Optional.of(owner));

        notifier.notifySuccess(payout);

        verify(notificationService).notifyAdminsAndManagersByOrgId(any(), any(), any(), any(), any());
        verify(notificationService, never()).sendByOrgId(any(), any(), any(), any(), any(), any());
    }

    @Test
    void notifySuccess_ownerNotFound_skipsOwnerNotification() {
        OwnerPayout payout = buildPayout();
        when(userRepository.findById(20L)).thenReturn(Optional.empty());

        notifier.notifySuccess(payout);

        verify(notificationService).notifyAdminsAndManagersByOrgId(any(), any(), any(), any(), any());
        verify(notificationService, never()).sendByOrgId(any(), any(), any(), any(), any(), any());
    }

    @Test
    void notifyFailure_notifiesAdminsAndOwner() {
        OwnerPayout payout = buildPayout();
        User owner = new User();
        owner.setKeycloakId("kc-owner");
        when(userRepository.findById(20L)).thenReturn(Optional.of(owner));

        notifier.notifyFailure(payout, "API error");

        verify(notificationService).notifyAdminsAndManagersByOrgId(
            eq(1L), eq(NotificationKey.PAYOUT_FAILED),
            contains("Echec"), contains("API error"), eq("/billing"));
        verify(notificationService).sendByOrgId(
            eq("kc-owner"), eq(NotificationKey.PAYOUT_FAILED),
            any(), any(), eq("/billing"), eq(1L));
    }

    @Test
    void notifyFailure_ownerNotFound_skipsOwner() {
        OwnerPayout payout = buildPayout();
        when(userRepository.findById(20L)).thenReturn(Optional.empty());

        notifier.notifyFailure(payout, "err");

        verify(notificationService).notifyAdminsAndManagersByOrgId(any(), any(), any(), any(), any());
        verify(notificationService, never()).sendByOrgId(any(), any(), any(), any(), any(), any());
    }

    @Test
    void notifyReconciliationRequired_notifiesAdminsWithTransferReference() {
        OwnerPayout payout = buildPayout();

        notifier.notifyReconciliationRequired(payout, "tr_abc123");

        verify(notificationService).notifyAdminsAndManagersByOrgId(
            eq(1L), eq(NotificationKey.RECONCILIATION_FAILED),
            contains("Reconciliation"), contains("tr_abc123"), eq("/billing"));
    }

    @Test
    void notifyReconciliationRequired_doesNotNotifyOwner() {
        OwnerPayout payout = buildPayout();

        notifier.notifyReconciliationRequired(payout, "tr_abc123");

        verify(notificationService, never()).sendByOrgId(any(), any(), any(), any(), any(), any());
        verify(userRepository, never()).findById(any());
    }

    @Test
    void notifySepaPending_notifiesAdmins() {
        OwnerPayout payout = buildPayout();

        notifier.notifySepaPending(payout);

        verify(notificationService).notifyAdminsAndManagersByOrgId(
            eq(1L), eq(NotificationKey.PAYOUT_PENDING_APPROVAL),
            contains("SEPA"), any(), eq("/billing"));
    }

    @Test
    void notifySepaPending_doesNotNotifyOwner() {
        OwnerPayout payout = buildPayout();

        notifier.notifySepaPending(payout);

        verify(notificationService, never()).sendByOrgId(any(), any(), any(), any(), any(), any());
        verify(userRepository, never()).findById(any());
    }
}
