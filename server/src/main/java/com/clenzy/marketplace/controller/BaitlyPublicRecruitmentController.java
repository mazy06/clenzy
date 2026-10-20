package com.clenzy.marketplace.controller;

import com.clenzy.marketplace.service.MarketplacePublicRateLimiter;
import com.clenzy.service.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/public/baitly-catalog/recruitment")
@PreAuthorize("permitAll()")
public class BaitlyPublicRecruitmentController {
    private final BaitlyRecruitment recruitment;
    private final BaitlyManagementInquiries inquiries;
    private final MarketplacePublicRateLimiter limiter;
    private final LoginProtectionService protection;
    @Value("${clenzy.marketplace.captcha-enabled:${captcha.enabled:false}}") private boolean captchaEnabled;
    public BaitlyPublicRecruitmentController(BaitlyRecruitment recruitment,BaitlyManagementInquiries inquiries,MarketplacePublicRateLimiter limiter,LoginProtectionService protection){
        this.recruitment=recruitment;this.inquiries=inquiries;this.limiter=limiter;this.protection=protection;
    }
    @GetMapping("/{id}") public BaitlyRecruitment.Page page(@PathVariable UUID id){return recruitment.publicPage(id);}
    @PostMapping("/{id}/applications")
    public ResponseEntity<Map<String,String>> apply(@PathVariable UUID id,@Valid @RequestBody BaitlyRecruitment.Application command,HttpServletRequest request){
        if(!limiter.tryAcquireManagementInquiry(request))return ResponseEntity.status(429).header("Retry-After","3600").body(Map.of("status","RATE_LIMITED"));
        if(captchaEnabled && !protection.validateCaptchaToken(command.captchaToken(),"provider-recruitment"))return ResponseEntity.badRequest().body(Map.of("status","CAPTCHA_REQUIRED"));
        inquiries.receiveApplication(id,command);
        return ResponseEntity.accepted().body(Map.of("status","RECEIVED"));
    }
}
