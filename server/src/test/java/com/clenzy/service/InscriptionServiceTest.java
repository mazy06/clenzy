package com.clenzy.service;

import com.clenzy.dto.CreateUserDto;
import com.clenzy.model.*;
import com.clenzy.repository.PendingInscriptionRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.util.StringUtils;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Field;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class InscriptionServiceTest {

    @Mock private PendingInscriptionRepository pendingInscriptionRepository;
    @Mock private UserRepository userRepository;
    @Mock private KeycloakService keycloakService;
    @Mock private OrganizationService organizationService;

    private InscriptionService inscriptionService;

    @BeforeEach
    void setUp() throws Exception {
        inscriptionService = new InscriptionService(
                pendingInscriptionRepository, userRepository,
                keycloakService, organizationService);

        // Set @Value fields via reflection for testing
        setField(inscriptionService, "stripeSecretKey", "sk_test_dummy");
        setField(inscriptionService, "currency", "EUR");
        setField(inscriptionService, "inscriptionSuccessUrl", "http://localhost:3000/login?inscription=success");
        setField(inscriptionService, "inscriptionCancelUrl", "http://localhost:3000/inscription?payment=cancelled");
    }

    private void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }

    private PendingInscription buildPending(String email, String stripeSessionId) {
        PendingInscription pending = new PendingInscription();
        pending.setId(1L);
        pending.setFirstName("Jean");
        pending.setLastName("Dupont");
        pending.setEmail(email);
        pending.setPassword("Passw0rd!");
        pending.setPhoneNumber("+33612345678");
        pending.setForfait("essentiel");
        pending.setStripeSessionId(stripeSessionId);
        pending.setStatus(PendingInscriptionStatus.PENDING_PAYMENT);
        pending.setBillingPeriod("MONTHLY");
        return pending;
    }

    // ===== COMPLETE INSCRIPTION =====

    @Nested
    class CompleteInscription {

        @Test
        void whenValidSession_thenCreatesKeycloakAndDbUser() {
            PendingInscription pending = buildPending("jean@test.com", "sess_123");
            when(pendingInscriptionRepository.findByStripeSessionId("sess_123"))
                    .thenReturn(Optional.of(pending));
            when(keycloakService.createUser(any(CreateUserDto.class))).thenReturn("kc-new-id");
            when(userRepository.save(any(User.class))).thenAnswer(inv -> {
                User u = inv.getArgument(0);
                u.setId(42L);
                return u;
            });

            inscriptionService.completeInscription("sess_123", "cus_stripe", "sub_stripe");

            // Keycloak user created
            ArgumentCaptor<CreateUserDto> kcCaptor = ArgumentCaptor.forClass(CreateUserDto.class);
            verify(keycloakService).createUser(kcCaptor.capture());
            assertThat(kcCaptor.getValue().getEmail()).isEqualTo("jean@test.com");
            assertThat(kcCaptor.getValue().getRole()).isEqualTo("HOST");

            // DB user created
            ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
            verify(userRepository).save(userCaptor.capture());
            User savedUser = userCaptor.getValue();
            assertThat(savedUser.getKeycloakId()).isEqualTo("kc-new-id");
            assertThat(savedUser.getRole()).isEqualTo(UserRole.HOST);
            assertThat(savedUser.getStatus()).isEqualTo(UserStatus.ACTIVE);
            assertThat(savedUser.getStripeCustomerId()).isEqualTo("cus_stripe");
            assertThat(savedUser.getStripeSubscriptionId()).isEqualTo("sub_stripe");

            // Pending marked as COMPLETED
            assertThat(pending.getStatus()).isEqualTo(PendingInscriptionStatus.COMPLETED);
            verify(pendingInscriptionRepository).save(pending);

            // Organization created
            verify(organizationService).createForUserWithBilling(
                    any(User.class), anyString(), eq(OrganizationType.INDIVIDUAL),
                    eq("cus_stripe"), eq("sub_stripe"), eq("essentiel"), eq("MONTHLY"));
        }

        @Test
        void whenSessionNotFound_thenThrowsRuntime() {
            when(pendingInscriptionRepository.findByStripeSessionId("unknown"))
                    .thenReturn(Optional.empty());

            assertThatThrownBy(() -> inscriptionService.completeInscription(
                    "unknown", "cus", "sub"))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("non trouvee");
        }

        @Test
        void whenAlreadyCompleted_thenSkips() {
            PendingInscription pending = buildPending("jean@test.com", "sess_dup");
            pending.setStatus(PendingInscriptionStatus.COMPLETED);
            when(pendingInscriptionRepository.findByStripeSessionId("sess_dup"))
                    .thenReturn(Optional.of(pending));

            inscriptionService.completeInscription("sess_dup", "cus", "sub");

            verify(keycloakService, never()).createUser(any());
            verify(userRepository, never()).save(any());
        }

        @Test
        void whenKeycloakFails_thenMarksFailed() {
            PendingInscription pending = buildPending("fail@test.com", "sess_fail");
            when(pendingInscriptionRepository.findByStripeSessionId("sess_fail"))
                    .thenReturn(Optional.of(pending));
            when(keycloakService.createUser(any())).thenThrow(new RuntimeException("Keycloak down"));

            assertThatThrownBy(() -> inscriptionService.completeInscription(
                    "sess_fail", "cus", "sub"))
                    .isInstanceOf(RuntimeException.class);

            assertThat(pending.getStatus()).isEqualTo(PendingInscriptionStatus.PAYMENT_FAILED);
        }
    }

    // ===== MARK INSCRIPTION FAILED =====

    @Nested
    class MarkInscriptionFailed {

        @Test
        void whenSessionExists_thenMarksAsFailed() {
            PendingInscription pending = buildPending("fail@test.com", "sess_fail");
            when(pendingInscriptionRepository.findByStripeSessionId("sess_fail"))
                    .thenReturn(Optional.of(pending));

            inscriptionService.markInscriptionFailed("sess_fail");

            assertThat(pending.getStatus()).isEqualTo(PendingInscriptionStatus.PAYMENT_FAILED);
            verify(pendingInscriptionRepository).save(pending);
        }

        @Test
        void whenSessionNotFound_thenDoesNothing() {
            when(pendingInscriptionRepository.findByStripeSessionId("unknown"))
                    .thenReturn(Optional.empty());

            inscriptionService.markInscriptionFailed("unknown");

            verify(pendingInscriptionRepository, never()).save(any());
        }
    }

    // ===== CLEANUP EXPIRED =====

    @Nested
    class CleanupExpired {

        @Test
        void whenCalled_thenDeletesExpiredPendingInscriptions() {
            inscriptionService.cleanupExpiredInscriptions();

            verify(pendingInscriptionRepository).deleteByStatusAndExpiresAtBefore(
                    eq(PendingInscriptionStatus.PENDING_PAYMENT), any());
        }
    }
}
