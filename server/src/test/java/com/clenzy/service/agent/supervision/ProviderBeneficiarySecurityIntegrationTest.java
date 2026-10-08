package com.clenzy.service.agent.supervision;

import com.clenzy.model.SupervisionSuggestion;
import com.clenzy.repository.*;
import com.clenzy.service.payout.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import org.springframework.transaction.PlatformTransactionManager;
import java.time.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Vraie interception Spring Security sur l'exécuteur appelé par les cartes HITL. */
@SpringJUnitConfig(ProviderBeneficiarySecurityIntegrationTest.Config.class)
class ProviderBeneficiarySecurityIntegrationTest {
    @Configuration @EnableMethodSecurity
    static class Config {
        @Bean ProviderPayoutBeneficiaryService beneficiaries() { return mock(ProviderPayoutBeneficiaryService.class); }
        @Bean HousekeeperPayoutService payouts() { return mock(HousekeeperPayoutService.class); }
        @Bean ProviderBeneficiarySupervision service(ProviderPayoutBeneficiaryService beneficiaries, HousekeeperPayoutService payouts) {
            return new ProviderBeneficiarySupervision(mock(InterventionRepository.class), beneficiaries, payouts,
                    mock(SupervisionSuggestionService.class), mock(SupervisionSuggestionRepository.class),
                    mock(SupervisionRealtimePublisher.class), new ObjectMapper(), Clock.systemUTC(), mock(PlatformTransactionManager.class));
        }
    }
    @Autowired ProviderBeneficiarySupervision service;
    @Autowired ProviderPayoutBeneficiaryService beneficiaries;
    @Autowired HousekeeperPayoutService payouts;
    SupervisionSuggestion card;
    @BeforeEach void setup() {
        reset(beneficiaries, payouts);
        card = new SupervisionSuggestion(7L, 75L, "fin", null, "Bénéficiaire", "", Instant.now().plusSeconds(3600));
        card.setAppliedBy("user:admin");
        card.setActionParams("{\"missionId\":11,\"propertyId\":75,\"organizationId\":9,\"assignedUserId\":42,\"teamId\":null,\"recipientUserId\":42}");
    }
    @Test @WithMockUser(roles="HOST") void hostCannotBypassInlinePermissionsViaHitl() { denied(); }
    @Test @WithMockUser(roles="SUPERVISOR") void supervisorCannotRedirectPayout() { denied(); }
    @Test @WithMockUser(roles="TECHNICIAN") void technicianCannotRedirectPayout() { denied(); }
    private void denied() {
        assertThatThrownBy(() -> service.apply(card)).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(beneficiaries, payouts);
    }
    @Test @WithMockUser(roles="SUPER_MANAGER") void authorizedHumanUsesSameBeneficiaryAndPayoutCircuit() {
        service.apply(card);
        verify(beneficiaries).selectReviewedOrganization(eq(7L), argThat(r -> r.missionId().equals(11L) && r.organizationId().equals(9L)), eq("admin"));
        verify(payouts).processCompletedMission(11L, 7L);
    }
}
