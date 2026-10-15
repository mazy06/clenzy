package com.clenzy.controller;
import com.clenzy.service.BaitlyMissionDamagePhotosService;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.multipart.MultipartFile;
import java.util.List;
@RestController @RequestMapping("/api/mobile/missions/{id}/damage/{issueId}/photos") @PreAuthorize("isAuthenticated()")
public class BaitlyMissionDamagePhotosController {
    private final BaitlyMissionDamagePhotosService service;
    public BaitlyMissionDamagePhotosController(BaitlyMissionDamagePhotosService service){this.service=service;}
    @PostMapping(consumes="multipart/form-data") public void upload(@PathVariable Long id,@PathVariable Long issueId,@RequestParam("photos") List<MultipartFile> photos,@AuthenticationPrincipal Jwt jwt){service.upload(id,issueId,photos,jwt);}
    @GetMapping public List<String> photos(@PathVariable Long id,@PathVariable Long issueId,@AuthenticationPrincipal Jwt jwt){return service.list(id,issueId,jwt);}
}
