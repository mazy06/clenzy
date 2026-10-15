package com.clenzy.controller;
import com.clenzy.service.BaitlyMissionSafetyService;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
@RestController @RequestMapping("/api/mobile/missions/{id}") @PreAuthorize("isAuthenticated()")
public class BaitlyMissionSafetyController {
    private final BaitlyMissionSafetyService service;
    public BaitlyMissionSafetyController(BaitlyMissionSafetyService service){this.service=service;}
    @GetMapping("/safety") public BaitlyMissionSafetyService.State state(@PathVariable Long id,@AuthenticationPrincipal Jwt jwt){return service.state(id,jwt);}
    @PostMapping("/pause") public BaitlyMissionSafetyService.State pause(@PathVariable Long id,@AuthenticationPrincipal Jwt jwt){return service.pause(id,jwt,false);}
    @PostMapping("/resume") public BaitlyMissionSafetyService.State resume(@PathVariable Long id,@AuthenticationPrincipal Jwt jwt){return service.pause(id,jwt,true);}
    @PostMapping("/damage") public BaitlyMissionSafetyService.State damage(@PathVariable Long id,@RequestBody BaitlyMissionSafetyService.Damage body,@AuthenticationPrincipal Jwt jwt){return service.damage(id,body,jwt);}
}
