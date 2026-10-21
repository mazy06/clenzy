package com.clenzy.marketplace.controller;

import com.clenzy.marketplace.service.MarketplacePublicRateLimiter;
import com.clenzy.service.BaitlyManagementInquiries;
import com.clenzy.service.LoginProtectionService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/public/baitly-catalog/profiles")
@PreAuthorize("permitAll()")
public class BaitlyPublicManagementInquiryController {
    private final BaitlyManagementInquiries inquiries;
    private final MarketplacePublicRateLimiter limiter;
    private final LoginProtectionService protection;
    @Value("${clenzy.marketplace.captcha-enabled:${captcha.enabled:false}}") private boolean captchaEnabled;
    public BaitlyPublicManagementInquiryController(BaitlyManagementInquiries inquiries,MarketplacePublicRateLimiter limiter,LoginProtectionService protection) {
        this.inquiries=inquiries; this.limiter=limiter; this.protection=protection;
    }
    @PostMapping("/{id}/inquiries")
    public ResponseEntity<Map<String,String>> receive(@PathVariable UUID id,@Valid @RequestBody BaitlyManagementInquiries.Command body,HttpServletRequest request) {
        if(!limiter.tryAcquireManagementInquiry(request))return ResponseEntity.status(429).header("Retry-After","3600").body(Map.of("status","RATE_LIMITED"));
        if(captchaEnabled && !protection.validateCaptchaToken(body.captchaToken(),"management-inquiry"))return ResponseEntity.badRequest().body(Map.of("status","CAPTCHA_REQUIRED"));
        inquiries.receive(id,body);
        return ResponseEntity.accepted().body(Map.of("status","RECEIVED"));
    }
}
