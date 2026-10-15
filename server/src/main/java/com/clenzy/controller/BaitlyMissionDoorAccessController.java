package com.clenzy.controller;
import com.clenzy.service.BaitlyMissionDoorAccessService;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import java.util.List;
@RestController @RequestMapping("/api/mobile/missions/{id}/door-access") @PreAuthorize("isAuthenticated()")
public class BaitlyMissionDoorAccessController {
    private final BaitlyMissionDoorAccessService service;
    public BaitlyMissionDoorAccessController(BaitlyMissionDoorAccessService service){this.service=service;}
    @GetMapping public List<BaitlyMissionDoorAccessService.Door> list(@PathVariable Long id,@AuthenticationPrincipal Jwt jwt){return service.list(id,jwt);}
    @PostMapping public List<BaitlyMissionDoorAccessService.Door> prepare(@PathVariable Long id,@AuthenticationPrincipal Jwt jwt){return service.prepare(id,jwt);}
}
