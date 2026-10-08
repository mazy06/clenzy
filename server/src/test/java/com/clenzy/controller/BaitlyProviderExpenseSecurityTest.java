package com.clenzy.controller;

import com.clenzy.service.ProviderExpenseService;
import com.clenzy.service.ReceiptStorageService;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@SpringJUnitConfig(BaitlyProviderExpenseSecurityTest.Config.class)
class BaitlyProviderExpenseSecurityTest {
    @Configuration @EnableMethodSecurity static class Config {
        @Bean ProviderExpenseService expenses() { return mock(ProviderExpenseService.class); }
        @Bean ReceiptStorageService storage() { return mock(ReceiptStorageService.class); }
        @Bean TenantContext tenant() { return mock(TenantContext.class); }
        @Bean ProviderExpenseController controller(ProviderExpenseService expenses,ReceiptStorageService storage,TenantContext tenant) {
            return new ProviderExpenseController(expenses,storage,tenant,new com.clenzy.service.BaitlyExpenseViews(expenses));
        }
    }
    @Autowired ProviderExpenseController controller;
    @Autowired ProviderExpenseService expenses;
    @Autowired ReceiptStorageService storage;
    @Autowired TenantContext tenant;
    @BeforeEach void setup() { reset(expenses,storage,tenant); when(tenant.getRequiredOrganizationId()).thenReturn(7L); }
    void denied() {
        assertThatThrownBy(()->controller.create(null)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->controller.update(1L,null)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->controller.approve(1L)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->controller.cancel(1L)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->controller.markAsPaid(1L,"fake")).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->controller.uploadReceipt(1L,null)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->controller.deleteReceipt(1L)).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(expenses,storage);
    }
    @Test @WithMockUser(roles="HOUSEKEEPER") void providerCannotApproveOrAlterExpenses() { denied(); }
    @Test @WithMockUser(roles="HOST") void propertyOwnershipDoesNotGrantPlatformApproval() { denied(); }
    @Test @WithMockUser(roles="SUPER_MANAGER") void staffApprovalKeepsOrganizationBoundary() {
        var expense=new com.clenzy.model.ProviderExpense(); expense.setId(1L);
        when(expenses.approve(1L,7L)).thenReturn(expense);
        assertThat(controller.approve(1L).id()).isEqualTo(1L);
        verify(expenses).approve(1L,7L);
    }
}
