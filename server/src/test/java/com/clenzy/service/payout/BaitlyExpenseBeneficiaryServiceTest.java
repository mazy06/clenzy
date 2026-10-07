package com.clenzy.service.payout;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class BaitlyExpenseBeneficiaryServiceTest {
    final ProviderExpenseRepository expenses=mock(ProviderExpenseRepository.class);
    final BaitlyExpenseBeneficiaryRepository choices=mock(BaitlyExpenseBeneficiaryRepository.class);
    final UserRepository users=mock(UserRepository.class);
    final BaitlyExpenseBeneficiaryService service=new BaitlyExpenseBeneficiaryService(expenses,choices,users);
    ProviderExpense expense; User actor; BaitlyExpenseBeneficiaryRepository.Company company;
    @BeforeEach void setup() {
        var provider=new User();provider.setId(42L);provider.setFirstName("Jean");provider.setLastName("Martin");
        expense=new ProviderExpense();expense.setId(31L);expense.setOrganizationId(7L);expense.setProvider(provider);expense.setStatus(ExpenseStatus.INCLUDED);
        actor=new User();actor.setId(1L);actor.setRole(UserRole.SUPER_ADMIN);
        when(users.findByKeycloakId("admin")).thenReturn(Optional.of(actor));
        when(expenses.findByIdAndOrgId(31L,7L)).thenReturn(Optional.of(expense));
        when(expenses.lockByIdAndOrgId(31L,7L)).thenReturn(Optional.of(expense));
        company=mock(BaitlyExpenseBeneficiaryRepository.Company.class);
        when(company.getId()).thenReturn(9L);when(company.getName()).thenReturn("Société test");
        when(choices.company(31L,7L)).thenReturn(Optional.of(company));
    }
    @Test void defaultIsTheNamedPersonEvenWhenTheyBelongToACompany() {
        assertThat(service.resolve(expense)).isEqualTo(PayoutBeneficiary.user(42L));
        assertThat(service.choice(31L,7L).name()).isEqualTo("Jean Martin");
        verify(choices,never()).saveAndFlush(any());
    }
    @Test void anAuditedChoiceIsPersistedOnceUnderExpenseLock() {
        when(choices.saveAndFlush(any())).thenAnswer(call -> {
            BaitlyExpenseBeneficiary saved=call.getArgument(0);
            assertThat(saved.getExpenseId()).isEqualTo(31L);assertThat(saved.getOrganizationId()).isEqualTo(7L);
            assertThat(saved.getProviderId()).isEqualTo(42L);assertThat(saved.getSelectedAt()).isNotNull();
            when(choices.findByExpenseIdAndOrganizationId(31L,7L)).thenReturn(Optional.of(saved));return saved;
        });
        var first=service.selectCompany(31L,7L,9L,"admin");
        assertThat(first.organizationId()).isEqualTo(9L);assertThat(first.userId()).isNull();assertThat(first.locked()).isTrue();
        assertThat(service.selectCompany(31L,7L,9L,"admin")).isEqualTo(first);
        var order=inOrder(expenses,choices);order.verify(expenses).lockByIdAndOrgId(31L,7L);order.verify(choices).saveAndFlush(any());
        verify(choices,times(1)).saveAndFlush(any());
    }
    @ParameterizedTest @ValueSource(strings={"paid","cancelled","reference","transfer","foreign-company","no-company","provider-changed","company-changed"})
    void ambiguousOrAlreadyCommittedCreditorsCannotBeReassigned(String defect) {
        switch(defect) {
            case "paid" -> expense.setStatus(ExpenseStatus.PAID);
            case "cancelled" -> expense.setStatus(ExpenseStatus.CANCELLED);
            case "reference" -> expense.setPaymentReference("legacy-proof");
            case "transfer" -> when(choices.hasTransfer(31L,7L)).thenReturn(true);
            case "foreign-company" -> when(company.getId()).thenReturn(8L);
            case "no-company" -> when(choices.company(31L,7L)).thenReturn(Optional.empty());
            case "provider-changed","company-changed" -> {
                when(choices.findByExpenseIdAndOrganizationId(31L,7L)).thenReturn(Optional.of(new BaitlyExpenseBeneficiary(expense,9L,1L)));
                if(defect.equals("provider-changed")) expense.getProvider().setId(43L); else when(company.getId()).thenReturn(8L);
            }
        }
        assertThatThrownBy(()->service.selectCompany(31L,7L,9L,"admin")).isInstanceOf(IllegalStateException.class);
        verify(choices,never()).saveAndFlush(any());
    }
    @Test void foreignTenantIsNotDisclosed() {
        assertThatThrownBy(()->service.choice(31L,8L)).isInstanceOf(com.clenzy.exception.NotFoundException.class);
        assertThatThrownBy(()->service.selectCompany(31L,8L,9L,"admin")).isInstanceOf(com.clenzy.exception.NotFoundException.class);
        verifyNoInteractions(choices);
    }
    @Test void providersCannotRedirectTheirOwnClaim() {
        actor.setRole(UserRole.HOUSEKEEPER);
        assertThatThrownBy(()->service.selectCompany(31L,7L,9L,"admin")).isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        verifyNoInteractions(expenses,choices);
    }
}
