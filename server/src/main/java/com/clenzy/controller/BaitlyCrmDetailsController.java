package com.clenzy.controller;

import com.clenzy.service.BaitlyCrmDetails;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/prospect-details")
@PreAuthorize("isAuthenticated() and hasPermission(null, 'baitly-crm:view')")
public class BaitlyCrmDetailsController {
    private final BaitlyCrmDetails details;
    public BaitlyCrmDetailsController(BaitlyCrmDetails details){this.details=details;}
    @GetMapping public List<Map<String,Object>> list(@AuthenticationPrincipal Jwt jwt){return details.list(jwt.getSubject());}
    @GetMapping("/assignees") public List<BaitlyCrmDetails.Assignee> assignees(@AuthenticationPrincipal Jwt jwt){return details.assignees(jwt.getSubject());}
    @PutMapping("/{id}")
    @PreAuthorize("isAuthenticated() and hasPermission(null, 'baitly-crm:view') and hasPermission(null, 'baitly-crm:manage')")
    public void save(@AuthenticationPrincipal Jwt jwt,@PathVariable long id,@Valid @RequestBody BaitlyCrmDetails.Details command){details.save(jwt.getSubject(),id,command);}
    @PutMapping("/{id}/follow-up")
    @PreAuthorize("isAuthenticated() and hasPermission(null, 'baitly-crm:view') and hasPermission(null, 'baitly-crm:manage')")
    public void saveFollowUp(@AuthenticationPrincipal Jwt jwt,@PathVariable long id,@Valid @RequestBody BaitlyCrmDetails.FollowUp command){details.saveFollowUp(jwt.getSubject(),id,command);}
}
