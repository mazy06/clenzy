package com.clenzy.controller;
import com.clenzy.service.BaitlyMobileDiscussionService;
import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/mobile/discussions") @PreAuthorize("isAuthenticated()")
public class BaitlyMobileDiscussionController {
    private final BaitlyMobileDiscussionService service;
    public BaitlyMobileDiscussionController(BaitlyMobileDiscussionService service){this.service=service;}
    @PostMapping("/{kind}/{id}/open") public Map<String,String> open(@PathVariable String kind,@PathVariable Long id,@AuthenticationPrincipal Jwt jwt){return service.open(kind,id,jwt);}
}
