package com.clenzy.marketplace.controller;
import com.clenzy.marketplace.service.BaitlyReels;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController @RequestMapping("/api/mobile/reels") @PreAuthorize("isAuthenticated()")
public class BaitlyReelsController {
    private final BaitlyReels reels;
    public BaitlyReelsController(BaitlyReels reels) { this.reels=reels; }
    @GetMapping("/settings") public org.springframework.http.ResponseEntity<BaitlyReels.SocialView> settings(@AuthenticationPrincipal Jwt jwt) {
        var settings=reels.settings(jwt.getSubject());
        return settings==null ? org.springframework.http.ResponseEntity.noContent().build() : org.springframework.http.ResponseEntity.ok(settings);
    }
    @PutMapping("/settings") public BaitlyReels.SocialView settings(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody BaitlyReels.SocialSettings body) { return reels.settings(jwt.getSubject(),body); }
    @GetMapping public List<BaitlyReels.ReelView> own(@AuthenticationPrincipal Jwt jwt) { return reels.ownVideos(jwt.getSubject()); }
    @PostMapping public BaitlyReels.ReelView share(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody BaitlyReels.ShareVideo body) { return reels.share(jwt.getSubject(),body); }
    @PutMapping("/selection") public List<BaitlyReels.ReelView> select(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody BaitlyReels.Selection body) { return reels.select(jwt.getSubject(),body); }
    @DeleteMapping("/{id}") public void delete(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id) { reels.delete(jwt.getSubject(),id); }
    @PostMapping("/instagram/connect") public Map<String,String> connect(@AuthenticationPrincipal Jwt jwt) { return reels.connect(jwt.getSubject()); }
    @DeleteMapping("/instagram") public void disconnect(@AuthenticationPrincipal Jwt jwt) { reels.disconnect(jwt.getSubject()); }
    @GetMapping("/instagram/videos") public BaitlyReels.VideoPage videos(@AuthenticationPrincipal Jwt jwt,@RequestParam(required=false) String after) { return reels.videos(jwt.getSubject(),after); }
}
