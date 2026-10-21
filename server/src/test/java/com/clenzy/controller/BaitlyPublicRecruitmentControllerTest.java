package com.clenzy.controller;

import com.clenzy.marketplace.controller.BaitlyPublicRecruitmentController;
import com.clenzy.marketplace.service.MarketplacePublicRateLimiter;
import com.clenzy.service.*;
import org.junit.jupiter.api.*;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.test.util.ReflectionTestUtils;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class BaitlyPublicRecruitmentControllerTest {
    BaitlyRecruitment recruitment=mock(BaitlyRecruitment.class);
    BaitlyManagementInquiries inquiries=mock(BaitlyManagementInquiries.class);
    MarketplacePublicRateLimiter limiter=mock(MarketplacePublicRateLimiter.class);
    LoginProtectionService protection=mock(LoginProtectionService.class);
    BaitlyPublicRecruitmentController controller=new BaitlyPublicRecruitmentController(recruitment,inquiries,limiter,protection);
    MockMvc mvc;final UUID id=UUID.randomUUID();
    @BeforeEach void setup(){mvc=MockMvcBuilders.standaloneSetup(controller).build();when(limiter.tryAcquireManagementInquiry(any())).thenReturn(true);}
    String body(boolean requested){return """
        {"requestId":"%s","name":"Samira","email":"samira@example.com","city":"Rabat","services":["CLEANING"],"replyChannel":"EMAIL","requestContact":%s}
        """.formatted(UUID.randomUUID(),requested);}
    @Test void contactRequestAndNonEmptyServicesAreMandatory() throws Exception {
        mvc.perform(post("/api/public/baitly-catalog/recruitment/"+id+"/applications").contentType("application/json").content(body(false))).andExpect(status().isBadRequest());
        mvc.perform(post("/api/public/baitly-catalog/recruitment/"+id+"/applications").contentType("application/json").content(body(true).replace("[\"CLEANING\"]","[]"))).andExpect(status().isBadRequest());
        verifyNoInteractions(inquiries);
    }
    @Test void rateLimitAndCaptchaPrecedeMutation() throws Exception {
        when(limiter.tryAcquireManagementInquiry(any())).thenReturn(false);
        mvc.perform(post("/api/public/baitly-catalog/recruitment/"+id+"/applications").contentType("application/json").content(body(true))).andExpect(status().isTooManyRequests());
        when(limiter.tryAcquireManagementInquiry(any())).thenReturn(true);ReflectionTestUtils.setField(controller,"captchaEnabled",true);
        mvc.perform(post("/api/public/baitly-catalog/recruitment/"+id+"/applications").contentType("application/json").content(body(true))).andExpect(status().isBadRequest());
        verifyNoInteractions(inquiries);
    }
    @Test void receiptExposesNoPrivateIdentifiersAndIgnoresClientTenant() throws Exception {
        mvc.perform(post("/api/public/baitly-catalog/recruitment/"+id+"/applications").contentType("application/json").content(body(true)))
            .andExpect(status().isAccepted()).andExpect(content().json("{\"status\":\"RECEIVED\"}",true));
        verify(inquiries).receiveApplication(eq(id),any());
    }
    @Test void publicPageOnlyExposesPublicationFields() throws Exception {
        when(recruitment.publicPage(id)).thenReturn(new BaitlyRecruitment.Page(id,true,"Maison Rabat","Ménage","Rabat","MA","Weekends",List.of("CLEANING")));
        mvc.perform(get("/api/public/baitly-catalog/recruitment/"+id)).andExpect(status().isOk()).andExpect(jsonPath("$.recipientName").value("Maison Rabat"))
            .andExpect(jsonPath("$.organizationId").doesNotExist()).andExpect(jsonPath("$.email").doesNotExist());
    }
}
