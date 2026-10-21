package com.clenzy.marketplace.controller;

import com.clenzy.marketplace.service.MarketplacePublicRateLimiter;
import com.clenzy.service.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/public/baitly-campaign-replies")
@PreAuthorize("permitAll()")
public class BaitlyPublicCampaignReplyController {
    private final BaitlyCrmCampaignResponses responses;private final MarketplacePublicRateLimiter limiter;private final LoginProtectionService protection;
    @Value("${clenzy.marketplace.captcha-enabled:${captcha.enabled:false}}") private boolean captchaEnabled;
    public BaitlyPublicCampaignReplyController(BaitlyCrmCampaignResponses responses,MarketplacePublicRateLimiter limiter,LoginProtectionService protection){this.responses=responses;this.limiter=limiter;this.protection=protection;}
    @PostMapping("/lookup") public ResponseEntity<?> lookup(@Valid @RequestBody BaitlyCrmCampaignResponses.Token token,HttpServletRequest request){
        if(!limiter.tryAcquireManagementInquiry(request))return limited();
        return ResponseEntity.ok(responses.lookup(token.token()));
    }
    @PostMapping("/respond") public ResponseEntity<?> respond(@Valid @RequestBody BaitlyCrmCampaignResponses.PublicResponse command,HttpServletRequest request){
        if(!limiter.tryAcquireManagementInquiry(request))return limited();
        if(captchaEnabled && !protection.validateCaptchaToken(command.captchaToken(),"crm-campaign-response"))return ResponseEntity.badRequest().body(Map.of("status","CAPTCHA_REQUIRED"));
        responses.publicResponse(command);return ResponseEntity.accepted().body(Map.of("status","RECEIVED"));
    }
    /** RFC 8058: POST only. GET scanners and link previews cannot withdraw consent. */
    @PostMapping("/{token}/unsubscribe") public Map<String,String> unsubscribe(@PathVariable String token){responses.oneClick(token);return Map.of("status","UNSUBSCRIBED");}
    private ResponseEntity<?> limited(){return ResponseEntity.status(429).header("Retry-After","3600").body(Map.of("status","RATE_LIMITED"));}
}
