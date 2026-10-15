package com.clenzy.marketplace.controller;
import com.clenzy.marketplace.service.BaitlyManagementContacts;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController @RequestMapping("/api/mobile/management-contacts") @PreAuthorize("isAuthenticated()")
public class BaitlyManagementContactController {
    private final BaitlyManagementContacts service;
    public BaitlyManagementContactController(BaitlyManagementContacts service) { this.service=service; }
    public record Command(@NotNull UUID profileId, @NotBlank @Size(max=1500) String message) {}
    @PostMapping public Map<String,Object> create(@Valid @RequestBody Command command, @AuthenticationPrincipal Jwt jwt) {
        return service.create(command.profileId(),command.message(),jwt.getSubject());
    }
    @GetMapping public List<Map<String,Object>> own(@AuthenticationPrincipal Jwt jwt) { return service.own(jwt.getSubject()); }
}
