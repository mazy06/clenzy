package com.clenzy.controller;

import com.clenzy.dto.UserPresenceDto;
import com.clenzy.service.PresenceService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Read-only access to user presence (online status + lastSeen).
 *
 * <p>Lives under {@code /api/presence/**}. Authentication is required; we don't expose presence
 * to anonymous callers. Bulk endpoint is capped to avoid abusive lookups.</p>
 */
@RestController
@RequestMapping("/api/presence")
@PreAuthorize("isAuthenticated()")
public class PresenceController {

    /** Hard cap on bulk presence queries to keep request size bounded. */
    private static final int MAX_BULK_IDS = 200;

    private final PresenceService presenceService;

    public PresenceController(PresenceService presenceService) {
        this.presenceService = presenceService;
    }

    @GetMapping("/{userId}")
    public ResponseEntity<UserPresenceDto> getPresence(@PathVariable String userId) {
        return ResponseEntity.ok(presenceService.getPresence(userId));
    }

    @PostMapping("/bulk")
    public ResponseEntity<List<UserPresenceDto>> getBulkPresence(
            @Valid @RequestBody BulkPresenceRequest request) {
        return ResponseEntity.ok(presenceService.getBulkPresence(request.userIds()));
    }

    /** Request body for bulk presence lookups. */
    public record BulkPresenceRequest(
            @NotEmpty
            @Size(max = MAX_BULK_IDS, message = "userIds must contain at most " + MAX_BULK_IDS + " ids")
            List<String> userIds
    ) {
    }
}
