package com.clenzy.booking.controller;

import com.clenzy.model.User;
import com.clenzy.model.UserRole;
import com.clenzy.service.UserService;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.concurrent.TimeUnit;

/**
 * Public read-only endpoint that streams a host's profile picture so the embedded Booking
 * Engine widget (running on conciergerie / propriétaire websites without any auth token)
 * can display it next to a property.
 *
 * <h2>Privacy</h2>
 * Only users whose {@link UserRole} is {@code HOST} are exposed here. Technicians, housekeepers
 * and other PMS-internal users keep their avatar private (the authenticated
 * {@code /api/users/{id}/profile-picture} endpoint stays the only way to fetch theirs).
 *
 * <h2>Caching</h2>
 * 5-min public cache header — small images, low risk of staleness because the
 * {@code BookingEngineChannelAdapter} flushes the property cache on profile change anyway.
 */
@RestController
@RequestMapping("/api/public/host-avatar")
public class PublicHostAvatarController {

    private final UserService userService;

    public PublicHostAvatarController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/{id}")
    public ResponseEntity<Resource> getHostAvatar(@PathVariable Long id) {
        User user = userService.findById(id).orElse(null);
        if (user == null || user.getRole() != UserRole.HOST) {
            // 404 on non-hosts so we don't leak the existence of internal accounts.
            return ResponseEntity.notFound().build();
        }
        Object[] payload = userService.streamProfilePicture(id);
        if (payload == null) {
            return ResponseEntity.notFound().build();
        }
        Resource resource = (Resource) payload[0];
        String contentType = (String) payload[1];
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .cacheControl(CacheControl.maxAge(5, TimeUnit.MINUTES).cachePublic())
                .body(resource);
    }
}
