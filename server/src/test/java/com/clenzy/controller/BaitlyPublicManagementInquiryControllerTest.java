package com.clenzy.controller;

import com.clenzy.marketplace.controller.BaitlyPublicManagementInquiryController;
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

class BaitlyPublicManagementInquiryControllerTest {
    BaitlyManagementInquiries inquiries=mock(BaitlyManagementInquiries.class);
    MarketplacePublicRateLimiter limiter=mock(MarketplacePublicRateLimiter.class);
    LoginProtectionService protection=mock(LoginProtectionService.class);
    BaitlyPublicManagementInquiryController controller=new BaitlyPublicManagementInquiryController(inquiries,limiter,protection);
    MockMvc mvc; final UUID profile=UUID.randomUUID();
    @BeforeEach void setup(){mvc=MockMvcBuilders.standaloneSetup(controller).build();when(limiter.tryAcquireManagementInquiry(any())).thenReturn(true);}
    String body(boolean requested){return """
        {"requestId":"%s","purpose":"MANAGEMENT","name":"Alice","email":"alice@example.com","city":"Rabat",
          "propertyType":"HOUSE","replyChannel":"EMAIL","requestContact":%s}
        """.formatted(UUID.randomUUID(),requested);}
    @Test void explicitRequestRequiredBeforeAnyMutation() throws Exception {
        mvc.perform(post("/api/public/baitly-catalog/profiles/"+profile+"/inquiries").contentType("application/json").content(body(false))).andExpect(status().isBadRequest());
        verifyNoInteractions(inquiries);
    }
    @Test void rateLimitAndCaptchaBlockBeforePersistence() throws Exception {
        when(limiter.tryAcquireManagementInquiry(any())).thenReturn(false);
        mvc.perform(post("/api/public/baitly-catalog/profiles/"+profile+"/inquiries").contentType("application/json").content(body(true)))
            .andExpect(status().isTooManyRequests()).andExpect(header().string("Retry-After","3600"));
        when(limiter.tryAcquireManagementInquiry(any())).thenReturn(true);ReflectionTestUtils.setField(controller,"captchaEnabled",true);
        mvc.perform(post("/api/public/baitly-catalog/profiles/"+profile+"/inquiries").contentType("application/json").content(body(true))).andExpect(status().isBadRequest());
        verifyNoInteractions(inquiries);
    }
    @Test void receiptDoesNotExposePrivateCrmIdentifiers() throws Exception {
        mvc.perform(post("/api/public/baitly-catalog/profiles/"+profile+"/inquiries").contentType("application/json").content(body(true)))
            .andExpect(status().isAccepted()).andExpect(content().json("{\"status\":\"RECEIVED\"}",true));
        verify(inquiries).receive(eq(profile),any());
    }
}
