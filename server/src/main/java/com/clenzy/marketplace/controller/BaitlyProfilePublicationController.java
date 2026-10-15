package com.clenzy.marketplace.controller;
import com.clenzy.marketplace.service.BaitlyPublicProfiles;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController @RequestMapping("/api/mobile/public-profile") @PreAuthorize("isAuthenticated()")
public class BaitlyProfilePublicationController {
    private final BaitlyPublicProfiles profiles;
    public BaitlyProfilePublicationController(BaitlyPublicProfiles profiles) { this.profiles=profiles; }
    @PutMapping("/reviews/{id}/identity") public void reviewIdentity(@PathVariable Long id,@Valid @RequestBody BaitlyPublicProfiles.ReviewIdentity command,@AuthenticationPrincipal Jwt jwt){profiles.reviewIdentity(id,command,jwt.getSubject());}
    @GetMapping("/reviews/{id}/identity") public Map<String,Object> reviewIdentity(@PathVariable Long id,@AuthenticationPrincipal Jwt jwt){return profiles.ownReviewIdentity(id,jwt.getSubject());}
    @GetMapping public Map<String,Object> own(@AuthenticationPrincipal Jwt jwt) {
        return profiles.own(jwt.getSubject()).orElseGet(Map::of);
    }
    @DeleteMapping public void withdraw(@AuthenticationPrincipal Jwt jwt) { profiles.withdraw(jwt.getSubject()); }
    @PutMapping public Map<String,Object> publish(@Valid @RequestBody BaitlyPublicProfiles.Publish command, @AuthenticationPrincipal Jwt jwt) {
        return profiles.publish(command,jwt.getSubject());
    }
}
