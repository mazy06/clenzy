package com.clenzy.service;

import com.clenzy.dto.CreateProviderExpenseRequest;
import com.clenzy.model.ExpenseCategory;
import com.clenzy.model.ExpenseStatus;
import com.clenzy.model.Intervention;
import com.clenzy.model.Property;
import com.clenzy.model.ProviderExpense;
import com.clenzy.model.User;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.PropertyRepository;
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
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProviderExpenseServiceTest {

    @Mock private ProviderExpenseRepository expenseRepository;
    @Mock private UserRepository userRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private InterventionRepository interventionRepository;

    private ProviderExpenseService service;

    private static final Long ORG_ID = 1L;

    @BeforeEach
    void setUp() {
        service = new ProviderExpenseService(expenseRepository, userRepository, propertyRepository, interventionRepository);
    }

    private User buildProvider(Long id) {
        User u = new User();
        u.setId(id);
        u.setFirstName("Provider");
        u.setLastName("Name");
        u.setEmail("p@x.com");
        return u;
    }

    private Property buildProperty(Long id) {
        Property p = new Property();
        p.setId(id);
        p.setName("Apt");
        p.setOrganizationId(ORG_ID);
        return p;
    }

    private ProviderExpense buildExpense(Long id, ExpenseStatus status) {
        ProviderExpense e = new ProviderExpense();
        e.setId(id);
        e.setOrganizationId(ORG_ID);
        e.setStatus(status);
        e.setAmountHt(new BigDecimal("100"));
        e.setTaxRate(new BigDecimal("0.2"));
        return e;
    }

    private CreateProviderExpenseRequest buildRequest() {
        return new CreateProviderExpenseRequest(
                10L, 20L, null,
                "Test expense", new BigDecimal("100"), new BigDecimal("0.2"),
                ExpenseCategory.MAINTENANCE, LocalDate.now(),
                "INV-001", "Notes");
    }

    @Nested
    @DisplayName("read operations")
    class Read {

        @Test
        void getAll_returnsList() {
            when(expenseRepository.findAllByOrgId(ORG_ID))
                    .thenReturn(List.of(buildExpense(1L, ExpenseStatus.DRAFT)));

            List<ProviderExpense> result = service.getAll(ORG_ID);
            assertThat(result).hasSize(1);
        }

        @Test
        void getById_whenFound_thenReturns() {
            ProviderExpense e = buildExpense(1L, ExpenseStatus.DRAFT);
            when(expenseRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.of(e));

            ProviderExpense result = service.getById(1L, ORG_ID);
            assertThat(result.getId()).isEqualTo(1L);
        }

        @Test
        void getById_whenNotFound_thenThrows() {
            when(expenseRepository.findByIdAndOrgId(99L, ORG_ID)).thenReturn(Optional.empty());
            assertThatThrownBy(() -> service.getById(99L, ORG_ID))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        void getByProviderId_returnsList() {
            when(expenseRepository.findByProviderIdAndOrgId(10L, ORG_ID))
                    .thenReturn(List.of(buildExpense(1L, ExpenseStatus.DRAFT)));
            assertThat(service.getByProviderId(10L, ORG_ID)).hasSize(1);
        }

        @Test
        void getByPropertyIdAndStatuses_returnsList() {
            when(expenseRepository.findByPropertyIdAndStatusIn(
                    20L, List.of(ExpenseStatus.APPROVED), ORG_ID))
                    .thenReturn(List.of(buildExpense(1L, ExpenseStatus.APPROVED)));
            assertThat(service.getByPropertyIdAndStatuses(20L, List.of(ExpenseStatus.APPROVED), ORG_ID)).hasSize(1);
        }

        @Test
        void getByPayoutId_returnsList() {
            when(expenseRepository.findByPayoutIdAndOrgId(5L, ORG_ID))
                    .thenReturn(List.of(buildExpense(1L, ExpenseStatus.INCLUDED)));
            assertThat(service.getByPayoutId(5L, ORG_ID)).hasSize(1);
        }

        @Test
        void getByStatus_returnsList() {
            when(expenseRepository.findByStatusAndOrgId(ExpenseStatus.PAID, ORG_ID))
                    .thenReturn(List.of(buildExpense(1L, ExpenseStatus.PAID)));
            assertThat(service.getByStatus(ExpenseStatus.PAID, ORG_ID)).hasSize(1);
        }

        @Test
        void getApprovedForPayout_returnsList() {
            when(expenseRepository.findApprovedByPropertyOwnerAndPeriod(
                    10L, LocalDate.now().minusDays(30), LocalDate.now(), ORG_ID))
                    .thenReturn(List.of(buildExpense(1L, ExpenseStatus.APPROVED)));

            assertThat(service.getApprovedForPayout(10L,
                    LocalDate.now().minusDays(30), LocalDate.now(), ORG_ID)).hasSize(1);
        }
    }

    @Nested
    @DisplayName("create")
    class Create {

        @Test
        void whenValid_thenCreatesAndComputesTaxAndTtc() {
            User provider = buildProvider(10L);
            Property property = buildProperty(20L);
            when(userRepository.findById(10L)).thenReturn(Optional.of(provider));
            when(propertyRepository.findById(20L)).thenReturn(Optional.of(property));
            when(expenseRepository.save(any(ProviderExpense.class))).thenAnswer(inv -> inv.getArgument(0));

            ProviderExpense result = service.create(buildRequest(), ORG_ID);

            assertThat(result.getStatus()).isEqualTo(ExpenseStatus.DRAFT);
            // 100 * 0.2 = 20 (tax), 100+20 = 120 (ttc)
            assertThat(result.getTaxAmount()).isEqualByComparingTo("20.00");
            assertThat(result.getAmountTtc()).isEqualByComparingTo("120.00");
        }

        @Test
        void whenProviderNotFound_thenThrows() {
            when(userRepository.findById(10L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.create(buildRequest(), ORG_ID))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        void whenPropertyNotFound_thenThrows() {
            when(userRepository.findById(10L)).thenReturn(Optional.of(buildProvider(10L)));
            when(propertyRepository.findById(20L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.create(buildRequest(), ORG_ID))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        void whenTaxRateNull_thenDefaultsToZero() {
            User provider = buildProvider(10L);
            Property property = buildProperty(20L);
            when(userRepository.findById(10L)).thenReturn(Optional.of(provider));
            when(propertyRepository.findById(20L)).thenReturn(Optional.of(property));
            when(expenseRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            CreateProviderExpenseRequest req = new CreateProviderExpenseRequest(
                    10L, 20L, null, "Test", new BigDecimal("50"), null,
                    ExpenseCategory.OTHER, LocalDate.now(), null, null);

            ProviderExpense result = service.create(req, ORG_ID);

            assertThat(result.getTaxRate()).isEqualByComparingTo("0");
            assertThat(result.getTaxAmount()).isEqualByComparingTo("0.00");
            assertThat(result.getAmountTtc()).isEqualByComparingTo("50.00");
        }

        @Test
        void whenInterventionId_thenLinks() {
            User provider = buildProvider(10L);
            Property property = buildProperty(20L);
            Intervention intervention = new Intervention();
            intervention.setId(5L);

            when(userRepository.findById(10L)).thenReturn(Optional.of(provider));
            when(propertyRepository.findById(20L)).thenReturn(Optional.of(property));
            when(interventionRepository.findById(5L)).thenReturn(Optional.of(intervention));
            when(expenseRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            CreateProviderExpenseRequest req = new CreateProviderExpenseRequest(
                    10L, 20L, 5L, "Test", new BigDecimal("100"), null,
                    ExpenseCategory.MAINTENANCE, LocalDate.now(), null, null);

            ProviderExpense result = service.create(req, ORG_ID);

            assertThat(result.getIntervention()).isNotNull();
            assertThat(result.getIntervention().getId()).isEqualTo(5L);
        }
    }

    @Nested
    @DisplayName("update")
    class Update {

        @Test
        void whenDraft_thenUpdates() {
            ProviderExpense existing = buildExpense(1L, ExpenseStatus.DRAFT);
            when(expenseRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.of(existing));
            when(userRepository.findById(10L)).thenReturn(Optional.of(buildProvider(10L)));
            when(propertyRepository.findById(20L)).thenReturn(Optional.of(buildProperty(20L)));
            when(expenseRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            ProviderExpense result = service.update(1L, buildRequest(), ORG_ID);

            assertThat(result.getDescription()).isEqualTo("Test expense");
        }

        @Test
        void whenNotDraft_thenThrows() {
            ProviderExpense existing = buildExpense(1L, ExpenseStatus.APPROVED);
            when(expenseRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.of(existing));

            assertThatThrownBy(() -> service.update(1L, buildRequest(), ORG_ID))
                    .isInstanceOf(IllegalStateException.class);
        }
    }

    @Nested
    @DisplayName("approve")
    class Approve {

        @Test
        void whenDraft_thenSetsApproved() {
            ProviderExpense expense = buildExpense(1L, ExpenseStatus.DRAFT);
            when(expenseRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.of(expense));
            when(expenseRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            ProviderExpense result = service.approve(1L, ORG_ID);
            assertThat(result.getStatus()).isEqualTo(ExpenseStatus.APPROVED);
        }

        @Test
        void whenNotDraft_thenThrows() {
            ProviderExpense expense = buildExpense(1L, ExpenseStatus.APPROVED);
            when(expenseRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.of(expense));

            assertThatThrownBy(() -> service.approve(1L, ORG_ID))
                    .isInstanceOf(IllegalStateException.class);
        }
    }

    @Nested
    @DisplayName("cancel")
    class Cancel {

        @Test
        void whenDraft_thenCancels() {
            ProviderExpense expense = buildExpense(1L, ExpenseStatus.DRAFT);
            when(expenseRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.of(expense));
            when(expenseRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            ProviderExpense result = service.cancel(1L, ORG_ID);
            assertThat(result.getStatus()).isEqualTo(ExpenseStatus.CANCELLED);
        }

        @Test
        void whenPaid_thenThrows() {
            ProviderExpense expense = buildExpense(1L, ExpenseStatus.PAID);
            when(expenseRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.of(expense));

            assertThatThrownBy(() -> service.cancel(1L, ORG_ID))
                    .isInstanceOf(IllegalStateException.class);
        }

        @Test
        void whenIncluded_thenThrows() {
            ProviderExpense expense = buildExpense(1L, ExpenseStatus.INCLUDED);
            when(expenseRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.of(expense));

            assertThatThrownBy(() -> service.cancel(1L, ORG_ID))
                    .isInstanceOf(IllegalStateException.class);
        }
    }

    @Nested
    @DisplayName("markAsPaid")
    class MarkAsPaid {

        @Test
        void whenApproved_thenMarksPaidWithReference() {
            ProviderExpense expense = buildExpense(1L, ExpenseStatus.APPROVED);
            when(expenseRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.of(expense));
            when(expenseRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            ProviderExpense result = service.markAsPaid(1L, "PAY-REF-123", ORG_ID);

            assertThat(result.getStatus()).isEqualTo(ExpenseStatus.PAID);
            assertThat(result.getPaymentReference()).isEqualTo("PAY-REF-123");
        }

        @Test
        void whenIncluded_thenMarksPaid() {
            ProviderExpense expense = buildExpense(1L, ExpenseStatus.INCLUDED);
            when(expenseRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.of(expense));
            when(expenseRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            ProviderExpense result = service.markAsPaid(1L, "REF", ORG_ID);
            assertThat(result.getStatus()).isEqualTo(ExpenseStatus.PAID);
        }

        @Test
        void whenDraft_thenThrows() {
            ProviderExpense expense = buildExpense(1L, ExpenseStatus.DRAFT);
            when(expenseRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.of(expense));

            assertThatThrownBy(() -> service.markAsPaid(1L, "REF", ORG_ID))
                    .isInstanceOf(IllegalStateException.class);
        }
    }

    @Nested
    @DisplayName("attachReceipt / removeReceipt")
    class Receipt {

        @Test
        void attachReceipt_setsPath() {
            ProviderExpense expense = buildExpense(1L, ExpenseStatus.DRAFT);
            when(expenseRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.of(expense));
            when(expenseRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            ProviderExpense result = service.attachReceipt(1L, "/receipts/file.pdf", ORG_ID);
            assertThat(result.getReceiptPath()).isEqualTo("/receipts/file.pdf");
        }

        @Test
        void removeReceipt_clearsPath() {
            ProviderExpense expense = buildExpense(1L, ExpenseStatus.DRAFT);
            expense.setReceiptPath("/some/path.pdf");
            when(expenseRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.of(expense));
            when(expenseRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            ProviderExpense result = service.removeReceipt(1L, ORG_ID);
            assertThat(result.getReceiptPath()).isNull();
        }
    }
}
