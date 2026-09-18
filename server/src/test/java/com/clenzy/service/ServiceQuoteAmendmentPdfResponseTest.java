package com.clenzy.service;

import com.clenzy.controller.ServiceQuoteAmendmentPdfController;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Contrat HTTP uniquement ; les droits sont testés dans ServiceQuoteAmendmentServiceTest. */
class ServiceQuoteAmendmentPdfResponseTest {
    @Test void preparingResponseCannotBeMistakenForPdfOrServerFailure() throws Exception {
        var pdf = mock(ServiceQuoteAmendmentPdfService.class);
        var tenant = mock(TenantContext.class);
        when(tenant.getRequiredOrganizationId()).thenReturn(7L);
        when(pdf.download(4L, 7L, null)).thenThrow(new ServiceQuoteAmendmentPdfService.ArchivePendingException());
        var mvc = MockMvcBuilders.standaloneSetup(new ServiceQuoteAmendmentPdfController(pdf, tenant))
                .setCustomArgumentResolvers(new org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver())
                .build();
        mvc.perform(get("/api/service-quote-amendments/4/pdf"))
                .andExpect(status().isAccepted()).andExpect(header().string(HttpHeaders.RETRY_AFTER, "60"))
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
                .andExpect(header().doesNotExist(HttpHeaders.CONTENT_DISPOSITION)).andExpect(content().string(""));
    }
}
