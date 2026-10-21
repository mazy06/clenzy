package com.clenzy.controller;

import com.clenzy.service.BaitlyCrmLocations;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/prospect-locations")
@PreAuthorize("isAuthenticated() and hasPermission(null, 'baitly-crm:view')")
public class BaitlyCrmLocationController {
    private final BaitlyCrmLocations locations;
    public BaitlyCrmLocationController(BaitlyCrmLocations locations){this.locations=locations;}
    @GetMapping public List<Map<String,Object>> list(@AuthenticationPrincipal Jwt jwt){return locations.list(jwt.getSubject());}
    @PutMapping("/{id}")
    @PreAuthorize("isAuthenticated() and hasPermission(null, 'baitly-crm:view') and hasPermission(null, 'baitly-crm:manage')")
    public void save(@AuthenticationPrincipal Jwt jwt,@PathVariable long id,@Valid @RequestBody BaitlyCrmLocations.Location location){locations.save(jwt.getSubject(),id,location);}
    @DeleteMapping("/{id}")
    @PreAuthorize("isAuthenticated() and hasPermission(null, 'baitly-crm:view') and hasPermission(null, 'baitly-crm:manage')")
    public void remove(@AuthenticationPrincipal Jwt jwt,@PathVariable long id){locations.remove(jwt.getSubject(),id);}
}
