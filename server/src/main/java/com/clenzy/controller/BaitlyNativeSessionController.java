package com.clenzy.controller;

import com.clenzy.service.AuthSessionService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

/** Session native Baitly : le refresh token est conserve dans le coffre du telephone. */
@RestController
@RequestMapping("/api/public/baitly-session")
@PreAuthorize("permitAll()")
public class BaitlyNativeSessionController {
    private final AuthSessionService sessions;
    public BaitlyNativeSessionController(AuthSessionService sessions) { this.sessions = sessions; }
    public record RefreshRequest(@NotBlank @Size(max = 16384) String refreshToken) {}

    // /api/public/** est deja public dans les deux configurations de securite.
    // Le refresh token lui-meme authentifie l'echange, comme pour le flux cookie.
    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(@Valid @RequestBody RefreshRequest request) {
        return sessions.refresh(request.refreshToken())
            .<ResponseEntity<?>>map(tokens -> ResponseEntity.ok(Map.of(
                "access_token", tokens.accessToken(), "refresh_token", tokens.refreshToken())))
            .orElseGet(() -> ResponseEntity.status(401).body(Map.of("error", "session_expired")));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@Valid @RequestBody RefreshRequest request) {
        sessions.logout(request.refreshToken());
        return ResponseEntity.noContent().build();
    }
}
