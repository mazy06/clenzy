package com.clenzy.service.agent.payment;

import com.clenzy.dto.HostBalanceSummaryDto;
import com.clenzy.model.User;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.DeferredPaymentService;
import com.stripe.exception.StripeException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("InterventionPaymentAgentService — pont agent → paiement des impayés")
class InterventionPaymentAgentServiceTest {

    private static final String KC = "kc-1";
    private static final Long USER_ID = 42L;

    @Mock private UserRepository userRepository;
    @Mock private DeferredPaymentService deferredPaymentService;
    @Mock private User user;

    private InterventionPaymentAgentService service;

    @BeforeEach
    void setUp() {
        service = new InterventionPaymentAgentService(userRepository, deferredPaymentService);
    }

    @Test
    @DisplayName("unpaidSummary : résout l'utilisateur courant (hostId = soi) puis délègue")
    void unpaidSummary_resolvesCurrentUser() {
        HostBalanceSummaryDto summary = new HostBalanceSummaryDto();
        summary.setTotalInterventions(2);
        when(user.getId()).thenReturn(USER_ID);
        when(userRepository.findByKeycloakId(KC)).thenReturn(Optional.of(user));
        when(deferredPaymentService.getHostBalance(USER_ID)).thenReturn(summary);

        assertThat(service.unpaidSummary(KC)).isSameAs(summary);
    }

    @Test
    @DisplayName("createPaymentLink : délègue createGroupedPaymentSession pour l'utilisateur courant")
    void createPaymentLink_delegates() throws StripeException {
        when(user.getId()).thenReturn(USER_ID);
        when(userRepository.findByKeycloakId(KC)).thenReturn(Optional.of(user));
        when(deferredPaymentService.createGroupedPaymentSession(USER_ID)).thenReturn("https://checkout.stripe/x");

        assertThat(service.createPaymentLink(KC)).isEqualTo("https://checkout.stripe/x");
    }

    @Test
    @DisplayName("utilisateur introuvable → IllegalStateException (jamais de hostId arbitraire)")
    void unknownUser_throws() {
        when(userRepository.findByKeycloakId(KC)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.unpaidSummary(KC))
                .isInstanceOf(IllegalStateException.class);
    }
}
