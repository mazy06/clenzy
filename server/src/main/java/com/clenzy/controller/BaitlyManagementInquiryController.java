package com.clenzy.controller;

import com.clenzy.service.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/prospect-inquiries")
@PreAuthorize("isAuthenticated() and (hasAnyRole('SUPER_ADMIN','SUPER_MANAGER') or (hasPermission(null, 'baitly-crm:view')))")
public class BaitlyManagementInquiryController {
    private final BaitlyManagementInquiries inquiries;
    private final BaitlyCrmAccess access;
    private final BaitlyCrmPublication publication;
    public BaitlyManagementInquiryController(BaitlyManagementInquiries inquiries,BaitlyCrmAccess access,
        BaitlyCrmPublication publication) {
        this.inquiries=inquiries;this.access=access;this.publication=publication;
    }
    @GetMapping("/publication")
    public Map<String,Object> publication(@AuthenticationPrincipal Jwt jwt) {
        return publication.own(jwt.getSubject());
    }
    @PutMapping("/publication")
    @PreAuthorize("isAuthenticated() and (hasAnyRole('SUPER_ADMIN','SUPER_MANAGER') or (hasPermission(null, 'baitly-crm:view') and hasPermission(null, 'baitly-crm:manage')))")
    public Map<String,Object> publish(@jakarta.validation.Valid @RequestBody com.clenzy.marketplace.service.BaitlyPublicProfiles.Publish command,@AuthenticationPrincipal Jwt jwt) {
        return publication.publish(command,jwt.getSubject());
    }
    @GetMapping
    public Map<String,Object> list(@RequestParam(required=false) Long contactId,@RequestParam(defaultValue="0") int page,@AuthenticationPrincipal Jwt jwt) {
        access.require(jwt.getSubject()); return inquiries.list(contactId,page);
    }
    public record Status(String status) {}
    @PatchMapping("/{id}")
    @PreAuthorize("isAuthenticated() and (hasAnyRole('SUPER_ADMIN','SUPER_MANAGER') or (hasPermission(null, 'baitly-crm:view') and hasPermission(null, 'baitly-crm:manage')))")
    public void status(@PathVariable Long id,@RequestBody Status body,@AuthenticationPrincipal Jwt jwt) {
        access.require(jwt.getSubject()); inquiries.status(id,body.status());
    }
}
