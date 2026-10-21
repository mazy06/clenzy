package com.clenzy.controller;

import com.clenzy.service.BaitlyRecruitment;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/prospect-inquiries/recruitment")
@PreAuthorize("isAuthenticated() and (hasAnyRole('SUPER_ADMIN','SUPER_MANAGER') or (hasPermission(null, 'baitly-crm:view')))")
public class BaitlyRecruitmentController {
    private final BaitlyRecruitment recruitment;
    public BaitlyRecruitmentController(BaitlyRecruitment recruitment){this.recruitment=recruitment;}
    @GetMapping public Map<String,Object> own(@AuthenticationPrincipal Jwt jwt){return recruitment.own(jwt.getSubject());}
    @PutMapping
    @PreAuthorize("isAuthenticated() and (hasAnyRole('SUPER_ADMIN','SUPER_MANAGER') or (hasPermission(null, 'baitly-crm:view') and hasPermission(null, 'baitly-crm:manage')))")
    public BaitlyRecruitment.Page save(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody BaitlyRecruitment.Publication command){return recruitment.save(jwt.getSubject(),command);}
}
