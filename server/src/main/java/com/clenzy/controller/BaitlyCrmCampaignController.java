package com.clenzy.controller;

import com.clenzy.service.*;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/prospect-campaigns")
@PreAuthorize("isAuthenticated() and (hasAnyRole('SUPER_ADMIN','SUPER_MANAGER') or (hasPermission(null, 'baitly-crm:view')))")
public class BaitlyCrmCampaignController {
    private final BaitlyCrmCampaigns campaigns;private final BaitlyCrmCampaignDelivery delivery;private final BaitlyCrmCampaignResponses responses;
    public BaitlyCrmCampaignController(BaitlyCrmCampaigns campaigns,BaitlyCrmCampaignDelivery delivery,BaitlyCrmCampaignResponses responses){this.campaigns=campaigns;this.delivery=delivery;this.responses=responses;}
    @GetMapping public Map<String,Object> list(@AuthenticationPrincipal Jwt jwt,@RequestParam(defaultValue="0") int page){return campaigns.list(jwt.getSubject(),page);}
    @GetMapping("/templates") public List<Map<String,Object>> templates(@AuthenticationPrincipal Jwt jwt){return campaigns.templates(jwt.getSubject());}
    @PostMapping("/preview") public BaitlyCrmCampaigns.Preview preview(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody BaitlyCrmCampaigns.Segment segment,@RequestParam(defaultValue="0") int page){return campaigns.preview(jwt.getSubject(),segment,page);}
    @GetMapping("/transport") public Map<String,Boolean> transport(){return Map.of("available",delivery.available());}
    @GetMapping("/{id}") public Map<String,Object> detail(@AuthenticationPrincipal Jwt jwt,@PathVariable long id,@RequestParam(defaultValue="0") int page){return campaigns.detail(jwt.getSubject(),id,page);}
    @PostMapping("/templates")
    @PreAuthorize("isAuthenticated() and (hasAnyRole('SUPER_ADMIN','SUPER_MANAGER') or (hasPermission(null, 'baitly-crm:view') and hasPermission(null, 'baitly-crm:manage')))")
    public Map<String,Object> createTemplate(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody BaitlyCrmCampaigns.Template template){return campaigns.saveTemplate(jwt.getSubject(),null,template);}
    @PutMapping("/templates/{id}")
    @PreAuthorize("isAuthenticated() and (hasAnyRole('SUPER_ADMIN','SUPER_MANAGER') or (hasPermission(null, 'baitly-crm:view') and hasPermission(null, 'baitly-crm:manage')))")
    public Map<String,Object> updateTemplate(@AuthenticationPrincipal Jwt jwt,@PathVariable Long id,@Valid @RequestBody BaitlyCrmCampaigns.Template template){return campaigns.saveTemplate(jwt.getSubject(),id,template);}
    @PostMapping
    @PreAuthorize("isAuthenticated() and (hasAnyRole('SUPER_ADMIN','SUPER_MANAGER') or (hasPermission(null, 'baitly-crm:view') and hasPermission(null, 'baitly-crm:manage')))")
    public Map<String,Object> create(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody BaitlyCrmCampaigns.Create create){return campaigns.create(jwt.getSubject(),create);}
    @PostMapping("/{id}/dispatch")
    @PreAuthorize("isAuthenticated() and (hasAnyRole('SUPER_ADMIN','SUPER_MANAGER') or (hasPermission(null, 'baitly-crm:view') and hasPermission(null, 'baitly-crm:manage') and hasPermission(null, 'baitly-crm:campaign-send')))")
    public Map<String,Integer> dispatch(@AuthenticationPrincipal Jwt jwt,@PathVariable long id){
        String replyTo=Boolean.TRUE.equals(jwt.getClaim("email_verified"))?BaitlyCrmIdentity.email(jwt.getClaimAsString("email")):null;
        return delivery.dispatch(jwt.getSubject(),id,replyTo);
    }
    @PostMapping("/{id}/cancel")
    @PreAuthorize("isAuthenticated() and (hasAnyRole('SUPER_ADMIN','SUPER_MANAGER') or (hasPermission(null, 'baitly-crm:view') and hasPermission(null, 'baitly-crm:manage')))")
    public void cancel(@AuthenticationPrincipal Jwt jwt,@PathVariable long id){campaigns.cancel(jwt.getSubject(),id);}
    @PostMapping("/recipients/{id}/responses")
    @PreAuthorize("isAuthenticated() and (hasAnyRole('SUPER_ADMIN','SUPER_MANAGER') or (hasPermission(null, 'baitly-crm:view') and hasPermission(null, 'baitly-crm:manage')))")
    public void response(@AuthenticationPrincipal Jwt jwt,@PathVariable long id,@Valid @RequestBody BaitlyCrmCampaignResponses.Response response){responses.manual(jwt.getSubject(),id,response);}
}
