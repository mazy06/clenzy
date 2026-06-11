package com.clenzy.controller;

import com.clenzy.dto.WaitlistSignupAdminDto;
import com.clenzy.service.WaitlistService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Consultation / export de la waitlist — réservé aux SUPER_ADMIN / SUPER_MANAGER.
 *
 * GET /api/admin/waitlist       → liste ordonnée par date d'arrivée
 * GET /api/admin/waitlist/stats → total + places fondateur restantes
 */
@RestController
@RequestMapping("/api/admin/waitlist")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
public class WaitlistAdminController {

    private final WaitlistService waitlistService;

    public WaitlistAdminController(WaitlistService waitlistService) {
        this.waitlistService = waitlistService;
    }

    @GetMapping
    public ResponseEntity<List<WaitlistSignupAdminDto>> list() {
        return ResponseEntity.ok(
            waitlistService.listAll().stream()
                .map(WaitlistSignupAdminDto::from)
                .toList());
    }

    @GetMapping("/stats")
    public ResponseEntity<WaitlistService.WaitlistStats> stats() {
        return ResponseEntity.ok(waitlistService.stats());
    }
}
