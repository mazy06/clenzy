package com.clenzy.controller;

import com.clenzy.service.PersonalTeamService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import java.util.Set;

/** L'identité provient exclusivement du JWT ; aucun identifiant utilisateur n'est accepté. */
@RestController
@RequestMapping("/api/my-service-capabilities")
@PreAuthorize("isAuthenticated()")
public class PersonalServiceCapabilityController {
    private final PersonalTeamService teams;
    public PersonalServiceCapabilityController(PersonalTeamService teams) { this.teams=teams; }

    @GetMapping
    public Set<String> get(@AuthenticationPrincipal Jwt jwt) {
        return teams.capabilities(jwt.getSubject());
    }

    @PutMapping
    public Set<String> replace(@AuthenticationPrincipal Jwt jwt, @RequestBody Set<String> codes) {
        return teams.replaceCapabilities(jwt.getSubject(), codes);
    }
}
