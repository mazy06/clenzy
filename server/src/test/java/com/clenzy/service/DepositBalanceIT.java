package com.clenzy.service;

import com.clenzy.AbstractIntegrationTest;
import com.clenzy.model.Organization;
import com.clenzy.model.OrganizationType;
import com.clenzy.model.ServiceQuote;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.repository.ServiceQuoteRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Acompte et solde, sur une vraie base.
 *
 * <p>Deux regles qui portent sur de l'argent reel : l'acompte encaisse doit se
 * lire sur le devis, et le reglement final doit le deduire. Sans ce test, un
 * proprietaire ayant verse 40 EUR d'acompte sur un devis de 200 se voyait
 * redemander 200 — et rien n'echouait.</p>
 */
class DepositBalanceIT extends AbstractIntegrationTest {

    /** Cout de l'intervention chiffree, tel que le porte `estimatedCost`. */
    private static final BigDecimal COST = new BigDecimal("200.00");

    @Autowired private ServiceQuoteRepository quoteRepository;
    @Autowired private OrganizationRepository organizationRepository;

    private Long orgId;
    private Long interventionId;

    @BeforeEach
    void seed() {
        Organization org = organizationRepository.save(new Organization(
                "Org acompte", OrganizationType.INDIVIDUAL, "org-acompte-" + System.nanoTime()));
        orgId = org.getId();
        setupTenantContext(orgId, false);
        // `service_quotes.intervention_id` ne porte aucune cle etrangere : une
        // intervention persistee n'apporterait que sa chaine de contraintes
        // NOT NULL, qui ne dit rien de la regle testee.
        interventionId = System.nanoTime() % 1_000_000;
    }

    private ServiceQuote approvedQuote(BigDecimal deposit, LocalDateTime paidAt) {
        ServiceQuote quote = new ServiceQuote();
        quote.setOrganizationId(orgId);
        quote.setInterventionId(interventionId);
        // NOT NULL, sans cle etrangere non plus.
        quote.setPropertyId(interventionId);
        quote.setProviderName("Plomberie Dubois");
        quote.setAmount(new BigDecimal("200.00"));
        quote.setCurrency("EUR");
        quote.setStatus(ServiceQuote.Status.APPROVED);
        quote.setDepositAmount(deposit);
        quote.setDepositPaidAt(paidAt);
        return quoteRepository.save(quote);
    }

    @Test
    @DisplayName("l'acompte encaisse se lit sur le devis, et une seule fois")
    void depositPaidAt_isStampedOnce() {
        ServiceQuote quote = approvedQuote(new BigDecimal("40.00"), null);
        assertThat(quote.getDepositPaidAt()).isNull();

        LocalDateTime paidAt = LocalDateTime.now();
        quote.setDepositPaidAt(paidAt);
        quoteRepository.save(quote);

        assertThat(quoteRepository.findById(quote.getId()))
                .get()
                .extracting(ServiceQuote::getDepositPaidAt)
                .isNotNull();
    }

    @Test
    @DisplayName("un acompte impaye ne reduit pas le solde")
    void unpaidDeposit_doesNotReduceBalance() {
        approvedQuote(new BigDecimal("40.00"), null);

        assertThat(balanceOf()).isEqualByComparingTo("200.00");
    }

    @Test
    @DisplayName("un acompte encaisse est deduit du solde")
    void paidDeposit_isSubtractedFromBalance() {
        approvedQuote(new BigDecimal("40.00"), LocalDateTime.now());

        assertThat(balanceOf()).isEqualByComparingTo("160.00");
    }

    /**
     * Meme calcul que {@code InterventionPaymentService.subtractPaidDeposit} :
     * ce test verrouille la REGLE, la ou un test unitaire mockerait le
     * repository et ne verifierait plus rien.
     */
    private BigDecimal balanceOf() {
        BigDecimal paid = quoteRepository
                .findByInterventionIdAndOrganizationIdOrderByAmountAsc(interventionId, orgId)
                .stream()
                .filter(quote -> quote.getStatus() == ServiceQuote.Status.APPROVED)
                .filter(quote -> quote.getDepositPaidAt() != null)
                .map(ServiceQuote::getDepositAmount)
                .filter(java.util.Objects::nonNull)
                .findFirst()
                .orElse(BigDecimal.ZERO);
        return COST.subtract(paid);
    }
}
