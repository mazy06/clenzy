package com.clenzy.controller;

import com.clenzy.marketplace.controller.BaitlyPublicCampaignReplyController;
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

class BaitlyPublicCampaignReplyControllerTest {
    final String token="a".repeat(43);BaitlyCrmCampaignResponses responses=mock(BaitlyCrmCampaignResponses.class);MarketplacePublicRateLimiter limiter=mock(MarketplacePublicRateLimiter.class);LoginProtectionService protection=mock(LoginProtectionService.class);
    BaitlyPublicCampaignReplyController controller=new BaitlyPublicCampaignReplyController(responses,limiter,protection);MockMvc mvc;
    @BeforeEach void setup(){mvc=MockMvcBuilders.standaloneSetup(controller).build();when(limiter.tryAcquireManagementInquiry(any())).thenReturn(true);}
    String body(){return "{\"token\":\""+token+"\",\"response\":{\"requestId\":\""+UUID.randomUUID()+"\",\"decision\":\"INTERESTED\"}}";}
    @Test void lookupExposesOnlyRecipientOrganization(){
        when(responses.lookup(token)).thenReturn(Map.of("organization","Maison Rabat"));
        try{mvc.perform(post("/api/public/baitly-campaign-replies/lookup").contentType("application/json").content("{\"token\":\""+token+"\"}")).andExpect(status().isOk()).andExpect(content().json("{\"organization\":\"Maison Rabat\"}",true));}catch(Exception e){throw new RuntimeException(e);}
    }
    @Test void linkScannersCannotUnsubscribeWithGet()throws Exception{
        mvc.perform(get("/api/public/baitly-campaign-replies/"+token+"/unsubscribe")).andExpect(status().isMethodNotAllowed());verifyNoInteractions(responses);
        mvc.perform(post("/api/public/baitly-campaign-replies/"+token+"/unsubscribe").contentType("application/x-www-form-urlencoded").content("List-Unsubscribe=One-Click")).andExpect(status().isOk());verify(responses).oneClick(token);
    }
    @Test void limiterAndCaptchaBlockBeforeAnyResponseMutation()throws Exception{
        when(limiter.tryAcquireManagementInquiry(any())).thenReturn(false);mvc.perform(post("/api/public/baitly-campaign-replies/respond").contentType("application/json").content(body())).andExpect(status().isTooManyRequests());
        when(limiter.tryAcquireManagementInquiry(any())).thenReturn(true);ReflectionTestUtils.setField(controller,"captchaEnabled",true);mvc.perform(post("/api/public/baitly-campaign-replies/respond").contentType("application/json").content(body())).andExpect(status().isBadRequest());verifyNoInteractions(responses);
    }
    @Test void receiptDoesNotExposeContactCampaignOrTokenIdentifiers()throws Exception{
        mvc.perform(post("/api/public/baitly-campaign-replies/respond").contentType("application/json").content(body())).andExpect(status().isAccepted()).andExpect(content().json("{\"status\":\"RECEIVED\"}",true));verify(responses).publicResponse(any());
    }
}
