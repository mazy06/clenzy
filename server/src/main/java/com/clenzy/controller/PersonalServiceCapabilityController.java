package com.clenzy.controller;

import com.clenzy.service.PersonalTeamService;
import com.clenzy.service.catalog.ServiceCatalogReference;
import com.clenzy.repository.ServiceRequestRepository;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.util.Set;

/** L'identité provient exclusivement du JWT ; aucun identifiant utilisateur n'est accepté. */
@RestController
@RequestMapping("/api/my-service-capabilities")
@PreAuthorize("isAuthenticated()")
public class PersonalServiceCapabilityController {
    private final PersonalTeamService teams;
    private final ServiceCatalogReference catalog;
    private final ServiceRequestRepository assignments;
    public PersonalServiceCapabilityController(PersonalTeamService teams, ServiceCatalogReference catalog,
            ServiceRequestRepository assignments) {
        this.teams=teams; this.catalog=catalog; this.assignments=assignments;
    }
    @GetMapping
    @Transactional(readOnly=true)
    public Set<String> get(@AuthenticationPrincipal Jwt jwt) {
        return teams.findCanonicalByKeycloakId(jwt.getSubject())
            .map(t -> Set.copyOf(t.getServiceItemCodes())).orElse(Set.of());
    }
    @PutMapping
    @Transactional
    public Set<String> replace(@AuthenticationPrincipal Jwt jwt, @RequestBody Set<String> codes) {
        var own = teams.getOrCreateCanonicalByKeycloakId(jwt.getSubject());
        var team = assignments.findTeamForCompositionMutation(own.getId()).orElseThrow();
        if (!codes.containsAll(team.getServiceItemCodes()) && assignments.teamHasActiveAssignments(team.getId()))
            throw new com.clenzy.exception.TeamCompositionConflictException();
        var valid = new java.util.LinkedHashSet<String>();
        for (String code : codes) valid.add(catalog.resolve(code,"OTHER",team.getServiceItemCodes().contains(code) ? code : null,"OTHER"));
        team.setServiceItemCodes(valid);
        return Set.copyOf(valid);
    }
}
