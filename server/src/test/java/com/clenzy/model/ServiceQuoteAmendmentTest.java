package com.clenzy.model;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.time.Instant;
import static org.assertj.core.api.Assertions.*;

class ServiceQuoteAmendmentTest {
    ServiceQuote quote;
    Intervention mission;
    @BeforeEach void setup() {
        quote = new ServiceQuote(); quote.setId(1L); quote.setOrganizationId(7L);
        quote.setInterventionId(2L); quote.setAmount(new BigDecimal("120"));
        quote.setCurrency("MAD"); quote.setStatus(ServiceQuote.Status.APPROVED);
        mission = new Intervention(); mission.setId(2L); mission.setOrganizationId(7L);
        mission.setCurrency("MAD");
        mission.setStatus(InterventionStatus.PENDING); mission.setEstimatedCost(new BigDecimal("120"));
        mission.setVersion(4L);
    }
    ServiceQuoteAmendment propose(String amount) {
        return ServiceQuoteAmendment.propose(quote, mission, 3L, new BigDecimal(amount), " Travaux supplémentaires ", Instant.EPOCH);
    }
    @Test void proposalDoesNotChangeCurrentAgreement() {
        var proposal = propose("150");
        assertThat(proposal.getStatus()).isEqualTo(ServiceQuoteAmendment.Status.PROPOSED);
        assertThat(proposal.getOriginalAmount()).isEqualByComparingTo("120");
        assertThat(proposal.getProposedAmount()).isEqualByComparingTo("150");
        assertThat(proposal.getCurrency()).isEqualTo("MAD");
        assertThat(proposal.getBaseInterventionVersion()).isEqualTo(4L);
        assertThat(quote.getAmount()).isEqualByComparingTo("120");
        assertThat(mission.getEstimatedCost()).isEqualByComparingTo("120");
    }
    @Test void subsequentProposalUsesCurrentAgreementInsteadOfOriginalQuote() {
        BigDecimal current = new BigDecimal("150");
        mission.setEstimatedCost(current);
        var proposal = ServiceQuoteAmendment.propose(quote, mission, 3L, new BigDecimal("120"),
                "Retour au prix initial", Instant.EPOCH, current);
        assertThat(proposal.getOriginalAmount()).isEqualByComparingTo("150");
        assertThat(proposal.isBasedOn(quote, mission, current)).isTrue();
        assertThat(proposal.isBasedOn(quote, mission, new BigDecimal("160"))).isFalse();
        assertThat(quote.getAmount()).isEqualByComparingTo("120");
        assertThatThrownBy(() -> ServiceQuoteAmendment.propose(quote, mission, 3L, current,
                "Sans changement", Instant.EPOCH, current)).isInstanceOf(IllegalArgumentException.class);
    }
    @Test void differentOrganizationIsRejected() {
        mission.setOrganizationId(8L);
        assertThatThrownBy(() -> propose("150")).isInstanceOf(IllegalStateException.class);
    }
    @Test void startedMissionIsRejected() {
        mission.setStatus(InterventionStatus.IN_PROGRESS);
        assertThatThrownBy(() -> propose("150")).isInstanceOf(IllegalStateException.class);
    }
    @Test void paidOrProcessingMissionIsRejected() {
        for (var status : java.util.List.of(PaymentStatus.PAID, PaymentStatus.PARTIALLY_PAID, PaymentStatus.PROCESSING)) {
            mission.setPaymentStatus(status);
            assertThatThrownBy(() -> propose("150")).isInstanceOf(IllegalStateException.class);
        }
    }
    @Test void existingCheckoutIsRejected() {
        mission.setStripeSessionId("cs_pending");
        assertThatThrownBy(() -> propose("150")).isInstanceOf(IllegalStateException.class);
    }
    @Test void changedPriceOrCurrencyBlocksAcceptanceWithoutChangingDecision() {
        var proposal = propose("150");
        mission.setEstimatedCost(new BigDecimal("121"));
        assertThatThrownBy(() -> proposal.accept(quote, mission, quote.getAmount(), 5L, 0, Instant.EPOCH))
                .hasMessageContaining("prix de la mission");
        mission.setEstimatedCost(quote.getAmount());
        mission.setCurrency("EUR");
        assertThatThrownBy(() -> proposal.accept(quote, mission, quote.getAmount(), 5L, 0, Instant.EPOCH))
                .hasMessageContaining("prix de la mission");
        assertThat(proposal.getStatus()).isEqualTo(ServiceQuoteAmendment.Status.PROPOSED);
        assertThat(proposal.getDecidedAt()).isNull();
    }
    @Test void invalidPrecisionAndUnchangedPriceAreRejected() {
        for (String amount : java.util.List.of("-1", "120.00", "130.001", "10000000000")) {
            assertThatThrownBy(() -> propose(amount)).isInstanceOf(IllegalArgumentException.class);
        }
    }

    @Test void changedAgreementOrMissionInvalidatesProposalBasis() {
        var proposal = propose("150");
        assertThat(proposal.isBasedOn(quote, mission)).isTrue();
        mission.setVersion(5L);
        assertThat(proposal.isBasedOn(quote, mission)).isFalse();
        mission.setVersion(4L);
        quote.setCurrency("EUR");
        assertThat(proposal.isBasedOn(quote, mission)).isFalse();
        quote.setCurrency("MAD");
        quote.setAmount(new BigDecimal("130"));
        assertThat(proposal.isBasedOn(quote, mission)).isFalse();
    }
}
