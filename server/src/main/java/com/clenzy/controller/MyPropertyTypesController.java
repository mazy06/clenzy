package com.clenzy.controller;

import com.clenzy.model.PropertyType;
import com.clenzy.service.ProviderPropertyEligibility;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import java.util.List;

@RestController
@RequestMapping("/api/my-property-types")
@PreAuthorize("isAuthenticated()")
public class MyPropertyTypesController {
    private final ProviderPropertyEligibility eligibility;
    public MyPropertyTypesController(ProviderPropertyEligibility eligibility) { this.eligibility=eligibility; }
    @GetMapping public List<String> mine(@AuthenticationPrincipal Jwt jwt) {
        return eligibility.mine(jwt.getSubject()).stream().map(Enum::name).toList();
    }
    @PutMapping public List<String> replace(@RequestBody List<String> types,@AuthenticationPrincipal Jwt jwt) {
        if(types==null || types.stream().anyMatch(java.util.Objects::isNull))
            throw new IllegalArgumentException("Types requis");
        return eligibility.replace(jwt.getSubject(),types.stream().map(PropertyType::valueOf).toList()).stream().map(Enum::name).toList();
    }
}
