package com.clenzy.controller;

import com.clenzy.service.BaitlySupplierPurchaseService;
import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/me/supplier-invitations") @PreAuthorize("isAuthenticated()")
public class BaitlySupplierInvitationController {
    private final BaitlySupplierPurchaseService service;
    public BaitlySupplierInvitationController(BaitlySupplierPurchaseService service){this.service=service;}
    public record Invitation(String token){}
    @PostMapping("/accept") public Map<String,Object> accept(@RequestBody Invitation invitation,@AuthenticationPrincipal Jwt jwt){
        return service.claim(invitation.token(),jwt.getSubject());
    }
}
