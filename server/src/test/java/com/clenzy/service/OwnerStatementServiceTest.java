package com.clenzy.service;

import com.clenzy.model.ExpenseCategory;
import com.clenzy.model.Intervention;
import com.clenzy.model.OwnerPayout;
import com.clenzy.model.OwnerPayout.PayoutStatus;
import com.clenzy.model.Property;
import com.clenzy.model.ProviderExpense;
import com.clenzy.model.User;
import com.clenzy.repository.OwnerPayoutRepository;
import com.clenzy.repository.ProviderExpenseRepository;
import com.clenzy.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OwnerStatementServiceTest {

    @Mock private OwnerPayoutRepository payoutRepository;
    @Mock private UserRepository userRepository;
    @Mock private EmailService emailService;
    @Mock private ProviderExpenseRepository providerExpenseRepository;

    private OwnerStatementService service;

    @BeforeEach
    void setUp() {
        service = new OwnerStatementService(payoutRepository, userRepository, emailService,
                providerExpenseRepository);
    }

    private User user(Long id, String email, String first, String last) {
        User u = new User();
        u.setId(id);
        u.setEmail(email);
        u.setFirstName(first);
        u.setLastName(last);
        return u;
    }

    private OwnerPayout payout(PayoutStatus status, LocalDate start, LocalDate end,
                                BigDecimal gross, BigDecimal commission, BigDecimal expenses,
                                BigDecimal net) {
        OwnerPayout p = new OwnerPayout();
        p.setStatus(status);
        p.setPeriodStart(start);
        p.setPeriodEnd(end);
        p.setGrossRevenue(gross);
        p.setCommissionAmount(commission);
        p.setExpenses(expenses);
        p.setNetAmount(net);
        return p;
    }

    // ── sendStatement ─────────────────────────────────────────────────────

    @Nested
    @DisplayName("sendStatement")
    class SendStatement {
        @Test
        void noPayouts_sendsEmptyStatement() {
            User owner = user(1L, "owner@example.com", "Jean", "Dupont");
            when(userRepository.findById(1L)).thenReturn(Optional.of(owner));
            when(payoutRepository.findByOwnerId(1L, 100L)).thenReturn(List.of());

            OwnerStatementService.OwnerStatementResult result = service.sendStatement(
                    1L, 100L, LocalDate.of(2026, 5, 1), LocalDate.of(2026, 5, 31),
                    "Cleanly Co.");

            assertThat(result.emailSentTo()).isEqualTo("owner@example.com");
            assertThat(result.ownerName()).isEqualTo("Jean Dupont");
            assertThat(result.payoutsCount()).isEqualTo(0);
            assertThat(result.totalPaid()).isEqualByComparingTo("0.00");
            verify(emailService).sendSimpleHtmlEmail(eq("owner@example.com"), anyString(), anyString());
        }

        @Test
        void singlePaidPayout_aggregatesAmounts() {
            User owner = user(1L, "owner@example.com", "Jean", "Dupont");
            when(userRepository.findById(1L)).thenReturn(Optional.of(owner));
            OwnerPayout p1 = payout(PayoutStatus.PAID,
                    LocalDate.of(2026, 5, 1), LocalDate.of(2026, 5, 31),
                    new BigDecimal("1000.00"), new BigDecimal("200.00"),
                    new BigDecimal("50.00"), new BigDecimal("750.00"));
            when(payoutRepository.findByOwnerId(1L, 100L)).thenReturn(List.of(p1));

            OwnerStatementService.OwnerStatementResult result = service.sendStatement(
                    1L, 100L, LocalDate.of(2026, 5, 1), LocalDate.of(2026, 5, 31),
                    "Cleanly Co.");

            assertThat(result.payoutsCount()).isEqualTo(1);
            assertThat(result.totalPaid()).isEqualByComparingTo("750.00");
            assertThat(result.totalGross()).isEqualByComparingTo("1000.00");
            assertThat(result.totalCommission()).isEqualByComparingTo("200.00");
            assertThat(result.totalExpenses()).isEqualByComparingTo("50.00");
        }

        @Test
        void multiplePayouts_sumsTotals() {
            User owner = user(1L, "owner@example.com", "Jean", "Dupont");
            when(userRepository.findById(1L)).thenReturn(Optional.of(owner));
            OwnerPayout p1 = payout(PayoutStatus.PAID,
                    LocalDate.of(2026, 4, 1), LocalDate.of(2026, 4, 30),
                    new BigDecimal("500"), new BigDecimal("100"),
                    BigDecimal.ZERO, new BigDecimal("400"));
            OwnerPayout p2 = payout(PayoutStatus.PAID,
                    LocalDate.of(2026, 5, 1), LocalDate.of(2026, 5, 31),
                    new BigDecimal("800"), new BigDecimal("160"),
                    new BigDecimal("40"), new BigDecimal("600"));
            when(payoutRepository.findByOwnerId(1L, 100L)).thenReturn(List.of(p1, p2));

            OwnerStatementService.OwnerStatementResult result = service.sendStatement(
                    1L, 100L, LocalDate.of(2026, 4, 1), LocalDate.of(2026, 5, 31),
                    "Cleanly Co.");

            assertThat(result.payoutsCount()).isEqualTo(2);
            assertThat(result.totalPaid()).isEqualByComparingTo("1000.00");
            assertThat(result.totalGross()).isEqualByComparingTo("1300.00");
            assertThat(result.totalCommission()).isEqualByComparingTo("260.00");
            assertThat(result.totalExpenses()).isEqualByComparingTo("40.00");
        }

        @Test
        void pendingPayouts_excluded() {
            User owner = user(1L, "owner@example.com", "Jean", "Dupont");
            when(userRepository.findById(1L)).thenReturn(Optional.of(owner));
            OwnerPayout pending = payout(PayoutStatus.PENDING,
                    LocalDate.of(2026, 5, 1), LocalDate.of(2026, 5, 31),
                    new BigDecimal("999"), new BigDecimal("1"),
                    BigDecimal.ZERO, new BigDecimal("998"));
            when(payoutRepository.findByOwnerId(1L, 100L)).thenReturn(List.of(pending));

            OwnerStatementService.OwnerStatementResult result = service.sendStatement(
                    1L, 100L, LocalDate.of(2026, 5, 1), LocalDate.of(2026, 5, 31),
                    "Cleanly Co.");

            assertThat(result.payoutsCount()).isEqualTo(0);
        }

        @Test
        void payoutOutsideDateRange_excluded() {
            User owner = user(1L, "owner@example.com", "Jean", "Dupont");
            when(userRepository.findById(1L)).thenReturn(Optional.of(owner));
            // Payout for April; query period is May -> excluded
            OwnerPayout outside = payout(PayoutStatus.PAID,
                    LocalDate.of(2026, 4, 1), LocalDate.of(2026, 4, 30),
                    new BigDecimal("500"), new BigDecimal("100"),
                    BigDecimal.ZERO, new BigDecimal("400"));
            when(payoutRepository.findByOwnerId(1L, 100L)).thenReturn(List.of(outside));

            OwnerStatementService.OwnerStatementResult result = service.sendStatement(
                    1L, 100L, LocalDate.of(2026, 5, 1), LocalDate.of(2026, 5, 31),
                    "Cleanly Co.");

            assertThat(result.payoutsCount()).isEqualTo(0);
        }

        @Test
        void payoutWithPartialOverlap_included() {
            User owner = user(1L, "owner@example.com", "Jean", "Dupont");
            when(userRepository.findById(1L)).thenReturn(Optional.of(owner));
            // Payout 2026-04-25 -> 2026-05-05 overlaps period 2026-05-01 -> 2026-05-31
            OwnerPayout overlap = payout(PayoutStatus.PAID,
                    LocalDate.of(2026, 4, 25), LocalDate.of(2026, 5, 5),
                    new BigDecimal("600"), new BigDecimal("120"),
                    BigDecimal.ZERO, new BigDecimal("480"));
            when(payoutRepository.findByOwnerId(1L, 100L)).thenReturn(List.of(overlap));

            OwnerStatementService.OwnerStatementResult result = service.sendStatement(
                    1L, 100L, LocalDate.of(2026, 5, 1), LocalDate.of(2026, 5, 31),
                    "Cleanly Co.");

            assertThat(result.payoutsCount()).isEqualTo(1);
        }

        @Test
        void ownerNotFound_throws() {
            when(userRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() ->
                    service.sendStatement(99L, 100L,
                            LocalDate.now(), LocalDate.now(), "Co."))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Proprietaire introuvable");
        }

        @Test
        void ownerWithoutEmail_throws() {
            User owner = user(1L, null, "John", "Doe");
            when(userRepository.findById(1L)).thenReturn(Optional.of(owner));

            assertThatThrownBy(() ->
                    service.sendStatement(1L, 100L, LocalDate.now(), LocalDate.now(), "Co."))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("n'a pas d'email");
        }

        @Test
        void ownerWithBlankEmail_throws() {
            User owner = user(1L, "   ", "John", "Doe");
            when(userRepository.findById(1L)).thenReturn(Optional.of(owner));

            assertThatThrownBy(() ->
                    service.sendStatement(1L, 100L, LocalDate.now(), LocalDate.now(), "Co."))
                    .isInstanceOf(IllegalStateException.class);
        }

        @Test
        void emptyNames_defaultsToProprietaire() {
            User owner = user(1L, "e@x.com", "", "");
            when(userRepository.findById(1L)).thenReturn(Optional.of(owner));
            when(payoutRepository.findByOwnerId(1L, 100L)).thenReturn(List.of());

            OwnerStatementService.OwnerStatementResult result = service.sendStatement(
                    1L, 100L, LocalDate.of(2026, 5, 1), LocalDate.of(2026, 5, 31), "Co.");

            assertThat(result.ownerName()).isEqualTo("Proprietaire");
        }

        @Test
        void nullNames_defaultsToProprietaire() {
            User owner = user(1L, "e@x.com", null, null);
            when(userRepository.findById(1L)).thenReturn(Optional.of(owner));
            when(payoutRepository.findByOwnerId(1L, 100L)).thenReturn(List.of());

            OwnerStatementService.OwnerStatementResult result = service.sendStatement(
                    1L, 100L, LocalDate.of(2026, 5, 1), LocalDate.of(2026, 5, 31), "Co.");

            assertThat(result.ownerName()).isEqualTo("Proprietaire");
        }

        @Test
        void nullConciergerieName_defaults() {
            User owner = user(1L, "e@x.com", "John", "Doe");
            when(userRepository.findById(1L)).thenReturn(Optional.of(owner));
            when(payoutRepository.findByOwnerId(1L, 100L)).thenReturn(List.of());

            service.sendStatement(1L, 100L, LocalDate.of(2026, 5, 1), LocalDate.of(2026, 5, 31), null);

            ArgumentCaptor<String> bodyCaptor = ArgumentCaptor.forClass(String.class);
            verify(emailService).sendSimpleHtmlEmail(anyString(), anyString(), bodyCaptor.capture());
            assertThat(bodyCaptor.getValue()).contains("Votre conciergerie");
        }

        @Test
        void blankConciergerieName_defaults() {
            User owner = user(1L, "e@x.com", "John", "Doe");
            when(userRepository.findById(1L)).thenReturn(Optional.of(owner));
            when(payoutRepository.findByOwnerId(1L, 100L)).thenReturn(List.of());

            service.sendStatement(1L, 100L, LocalDate.of(2026, 5, 1), LocalDate.of(2026, 5, 31), "  ");

            ArgumentCaptor<String> bodyCaptor = ArgumentCaptor.forClass(String.class);
            verify(emailService).sendSimpleHtmlEmail(anyString(), anyString(), bodyCaptor.capture());
            assertThat(bodyCaptor.getValue()).contains("Votre conciergerie");
        }

        @Test
        void htmlContainsKeySections() {
            User owner = user(1L, "owner@example.com", "Jean", "Dupont");
            when(userRepository.findById(1L)).thenReturn(Optional.of(owner));
            OwnerPayout p = payout(PayoutStatus.PAID,
                    LocalDate.of(2026, 5, 1), LocalDate.of(2026, 5, 31),
                    new BigDecimal("1000"), new BigDecimal("200"),
                    new BigDecimal("50"), new BigDecimal("750"));
            when(payoutRepository.findByOwnerId(1L, 100L)).thenReturn(List.of(p));

            service.sendStatement(1L, 100L, LocalDate.of(2026, 5, 1), LocalDate.of(2026, 5, 31),
                    "MyConcierge");

            ArgumentCaptor<String> bodyCaptor = ArgumentCaptor.forClass(String.class);
            ArgumentCaptor<String> subjectCaptor = ArgumentCaptor.forClass(String.class);
            verify(emailService).sendSimpleHtmlEmail(eq("owner@example.com"),
                    subjectCaptor.capture(), bodyCaptor.capture());
            assertThat(subjectCaptor.getValue()).contains("Releve de reversements");
            assertThat(bodyCaptor.getValue())
                    .contains("Bonjour Jean Dupont")
                    .contains("Releve de reversements")
                    .contains("Total verse")
                    .contains("MyConcierge");
        }

        @Test
        void htmlEmptyState_shownWhenNoPayouts() {
            User owner = user(1L, "e@x.com", "John", "Doe");
            when(userRepository.findById(1L)).thenReturn(Optional.of(owner));
            when(payoutRepository.findByOwnerId(1L, 100L)).thenReturn(List.of());

            service.sendStatement(1L, 100L, LocalDate.of(2026, 5, 1), LocalDate.of(2026, 5, 31), "Co.");

            ArgumentCaptor<String> bodyCaptor = ArgumentCaptor.forClass(String.class);
            verify(emailService).sendSimpleHtmlEmail(anyString(), anyString(), bodyCaptor.capture());
            assertThat(bodyCaptor.getValue()).contains("Aucun reversement effectue");
        }

        @Test
        void htmlExpensesZeroOrNull_showsDash() {
            User owner = user(1L, "e@x.com", "John", "Doe");
            when(userRepository.findById(1L)).thenReturn(Optional.of(owner));
            OwnerPayout p = payout(PayoutStatus.PAID,
                    LocalDate.of(2026, 5, 1), LocalDate.of(2026, 5, 31),
                    new BigDecimal("1000"), new BigDecimal("200"),
                    BigDecimal.ZERO, new BigDecimal("800"));
            when(payoutRepository.findByOwnerId(1L, 100L)).thenReturn(List.of(p));

            service.sendStatement(1L, 100L, LocalDate.of(2026, 5, 1), LocalDate.of(2026, 5, 31), "Co.");

            ArgumentCaptor<String> bodyCaptor = ArgumentCaptor.forClass(String.class);
            verify(emailService).sendSimpleHtmlEmail(anyString(), anyString(), bodyCaptor.capture());
            // dash character (em dash) used when expenses == 0
            assertThat(bodyCaptor.getValue()).contains("—");
        }

        @Test
        void singlePayout_subjectIncludesPeriodDates() {
            User owner = user(1L, "e@x.com", "John", "Doe");
            when(userRepository.findById(1L)).thenReturn(Optional.of(owner));
            when(payoutRepository.findByOwnerId(1L, 100L)).thenReturn(List.of());

            service.sendStatement(1L, 100L,
                    LocalDate.of(2026, 5, 1), LocalDate.of(2026, 5, 31), "Co.");

            ArgumentCaptor<String> subjectCaptor = ArgumentCaptor.forClass(String.class);
            verify(emailService).sendSimpleHtmlEmail(anyString(), subjectCaptor.capture(), anyString());
            assertThat(subjectCaptor.getValue()).contains("01/05/2026").contains("31/05/2026");
        }
    }

    // ── Bareme conseille menage (P11, PLAN-MOTEUR-MENAGE.md) ─────────────

    @Nested
    @DisplayName("bareme conseille menage")
    class CleaningAdvisories {

        private OwnerPayout paidPayoutWithId(long id) {
            OwnerPayout p = payout(PayoutStatus.PAID,
                    LocalDate.of(2026, 5, 1), LocalDate.of(2026, 5, 31),
                    new BigDecimal("1000"), new BigDecimal("200"),
                    new BigDecimal("120"), new BigDecimal("680"));
            p.setId(id);
            return p;
        }

        private ProviderExpense cleaningExpense(BigDecimal billedTtc, BigDecimal recommendedCost) {
            Property property = new Property();
            property.setName("Duplex Marrakech");

            Intervention intervention = new Intervention();
            intervention.setRecommendedCost(recommendedCost);

            ProviderExpense expense = new ProviderExpense();
            expense.setCategory(ExpenseCategory.CLEANING);
            expense.setAmountTtc(billedTtc);
            expense.setIntervention(intervention);
            expense.setProperty(property);
            expense.setExpenseDate(LocalDate.of(2026, 5, 12));
            return expense;
        }

        private String sentHtml() {
            ArgumentCaptor<String> bodyCaptor = ArgumentCaptor.forClass(String.class);
            verify(emailService).sendSimpleHtmlEmail(anyString(), anyString(), bodyCaptor.capture());
            return bodyCaptor.getValue();
        }

        @Test
        void cleaningExpenseAboveTolerance_showsAdvisoryPrice() {
            User owner = user(1L, "e@x.com", "John", "Doe");
            when(userRepository.findById(1L)).thenReturn(Optional.of(owner));
            OwnerPayout p = paidPayoutWithId(7L);
            when(payoutRepository.findByOwnerId(1L, 100L)).thenReturn(List.of(p));
            when(providerExpenseRepository.findByPayoutIdAndOrgId(7L, 100L))
                    .thenReturn(List.of(cleaningExpense(new BigDecimal("120.00"), new BigDecimal("95.00"))));

            service.sendStatement(1L, 100L, LocalDate.of(2026, 5, 1), LocalDate.of(2026, 5, 31), "Co.");

            // Ecart 25 € > tolerance 5 € : le bareme est affiche a cote du facture.
            assertThat(sentHtml())
                    .contains("Duplex Marrakech")
                    .contains("Bareme conseille : 95,00");
        }

        @Test
        void cleaningExpenseWithinTolerance_showsConformeAuBareme() {
            User owner = user(1L, "e@x.com", "John", "Doe");
            when(userRepository.findById(1L)).thenReturn(Optional.of(owner));
            OwnerPayout p = paidPayoutWithId(7L);
            when(payoutRepository.findByOwnerId(1L, 100L)).thenReturn(List.of(p));
            when(providerExpenseRepository.findByPayoutIdAndOrgId(7L, 100L))
                    .thenReturn(List.of(cleaningExpense(new BigDecimal("98.00"), new BigDecimal("95.00"))));

            service.sendStatement(1L, 100L, LocalDate.of(2026, 5, 1), LocalDate.of(2026, 5, 31), "Co.");

            // |98 - 95| = 3 € ≤ 5 € : conforme, pas d'affichage du bareme.
            assertThat(sentHtml())
                    .contains("conforme au bareme")
                    .doesNotContain("Bareme conseille :");
        }

        @Test
        void nonCleaningOrUnsnapshottedExpenses_noAdvisoryBlock() {
            User owner = user(1L, "e@x.com", "John", "Doe");
            when(userRepository.findById(1L)).thenReturn(Optional.of(owner));
            OwnerPayout p = paidPayoutWithId(7L);
            when(payoutRepository.findByOwnerId(1L, 100L)).thenReturn(List.of(p));

            ProviderExpense maintenance = cleaningExpense(new BigDecimal("120.00"), new BigDecimal("95.00"));
            maintenance.setCategory(ExpenseCategory.MAINTENANCE);
            ProviderExpense noSnapshot = cleaningExpense(new BigDecimal("120.00"), null);
            when(providerExpenseRepository.findByPayoutIdAndOrgId(7L, 100L))
                    .thenReturn(List.of(maintenance, noSnapshot));

            service.sendStatement(1L, 100L, LocalDate.of(2026, 5, 1), LocalDate.of(2026, 5, 31), "Co.");

            assertThat(sentHtml()).doesNotContain("bareme conseille");
        }

        @Test
        void payoutWithoutId_skipsExpenseLookup() {
            // Les payouts non persistes (id null) ne declenchent aucune requete depense.
            User owner = user(1L, "e@x.com", "John", "Doe");
            when(userRepository.findById(1L)).thenReturn(Optional.of(owner));
            OwnerPayout p = payout(PayoutStatus.PAID,
                    LocalDate.of(2026, 5, 1), LocalDate.of(2026, 5, 31),
                    new BigDecimal("1000"), new BigDecimal("200"),
                    BigDecimal.ZERO, new BigDecimal("800"));
            when(payoutRepository.findByOwnerId(1L, 100L)).thenReturn(List.of(p));

            service.sendStatement(1L, 100L, LocalDate.of(2026, 5, 1), LocalDate.of(2026, 5, 31), "Co.");

            verify(providerExpenseRepository, never()).findByPayoutIdAndOrgId(any(), any());
        }
    }

    // ── OwnerStatementResult record ──────────────────────────────────────

    @Nested
    @DisplayName("OwnerStatementResult record")
    class StatementRecordTests {
        @Test
        void recordValues() {
            OwnerStatementService.OwnerStatementResult r = new OwnerStatementService.OwnerStatementResult(
                    "e@x.com", "John Doe", 3,
                    new BigDecimal("100"), new BigDecimal("200"),
                    new BigDecimal("20"), new BigDecimal("10"));
            assertThat(r.emailSentTo()).isEqualTo("e@x.com");
            assertThat(r.ownerName()).isEqualTo("John Doe");
            assertThat(r.payoutsCount()).isEqualTo(3);
            assertThat(r.totalPaid()).isEqualByComparingTo("100");
        }
    }
}
