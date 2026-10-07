package com.clenzy.controller;

import com.clenzy.exception.PaymentValidationException;
import com.clenzy.service.BaitlyRefundSeriesStore;
import com.clenzy.service.ManagedRefundReconciliation;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import java.math.BigDecimal;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringJUnitConfig(BaitlyRefundSeriesControllerTest.Config.class)
class BaitlyRefundSeriesControllerTest {
    @Configuration @EnableMethodSecurity
    static class Config {
        @Bean BaitlyRefundSeriesStore store() { return mock(BaitlyRefundSeriesStore.class); }
        @Bean ManagedRefundReconciliation refunds() { return mock(ManagedRefundReconciliation.class); }
        @Bean TenantContext tenant() { return mock(TenantContext.class); }
        @Bean BaitlyRefundSeriesController controller(BaitlyRefundSeriesStore store, ManagedRefundReconciliation refunds, TenantContext tenant) {
            return new BaitlyRefundSeriesController(store, refunds, tenant);
        }
    }
    @Autowired BaitlyRefundSeriesController controller;
    @Autowired BaitlyRefundSeriesStore store;
    @Autowired ManagedRefundReconciliation refunds;
    @Autowired TenantContext tenant;

    @BeforeEach void setup() { reset(store, refunds, tenant); when(tenant.getRequiredOrganizationId()).thenReturn(7L); }

    @Test @WithMockUser(roles="SUPER_ADMIN")
    void businessRefusalKeepsItsExplanationAndNeverStartsStripeRefund() throws Exception {
        String reason="Après reversement avec commission, remboursez le solde entier ou rapprochez sa récupération partielle";
        when(store.prepare(eq(7L),eq(364L),eq(new BigDecimal("5.01")),any()))
                .thenThrow(new PaymentValidationException(reason));
        var mvc=org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new com.clenzy.exception.GlobalExceptionHandler(mock(com.clenzy.config.SyncMetrics.class))).build();
        mvc.perform(post("/api/payments/364/refund-installment").contentType("application/json")
                        .content("{\"amount\":5.01,\"requestId\":\""+UUID.randomUUID()+"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("REFUND_NOT_READY"))
                .andExpect(jsonPath("$.message").value(reason));
        verifyNoInteractions(refunds);
    }

    @Test @WithMockUser(roles="HOST") void ownerCannotLaunchRefundOrReadAnotherRefund() { denied(); }
    @Test @WithMockUser(roles="TECHNICIAN") void providerCannotLaunchRefundOrReadAnotherRefund() { denied(); }
    private void denied() {
        assertThatThrownBy(() -> controller.refund(364L,new BaitlyRefundSeriesController.Request(BigDecimal.ONE,UUID.randomUUID())))
                .isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> controller.status("REF-another"))
                .isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(store,refunds);
    }
}
