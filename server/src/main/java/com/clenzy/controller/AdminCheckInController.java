package com.clenzy.controller;

import com.clenzy.dto.OnlineCheckInDto;
import com.clenzy.model.OnlineCheckIn;
import com.clenzy.service.OnlineCheckInService;
import com.clenzy.tenant.TenantContext;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/checkins")
public class AdminCheckInController {

    private final OnlineCheckInService checkInService;
    private final TenantContext tenantContext;

    public AdminCheckInController(OnlineCheckInService checkInService, TenantContext tenantContext) {
        this.checkInService = checkInService;
        this.tenantContext = tenantContext;
    }

    @GetMapping
    public ResponseEntity<Page<OnlineCheckInDto>> getAll(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Long orgId = tenantContext.getOrganizationId();
        Page<OnlineCheckInDto> result = checkInService.getAll(orgId, PageRequest.of(page, size))
            .map(c -> OnlineCheckInDto.from(c, checkInService.generateCheckInLink(c)));
        return ResponseEntity.ok(result);
    }

    @GetMapping("/reservation/{reservationId}")
    public ResponseEntity<OnlineCheckInDto> getByReservation(@PathVariable Long reservationId) {
        Long orgId = tenantContext.getOrganizationId();
        return checkInService.getByReservation(reservationId, orgId)
            .map(c -> OnlineCheckInDto.from(c, checkInService.generateCheckInLink(c)))
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/generate/{reservationId}")
    public ResponseEntity<OnlineCheckInDto> generate(@PathVariable Long reservationId) {
        Long orgId = tenantContext.getOrganizationId();
        OnlineCheckIn checkIn = checkInService.createCheckIn(reservationId, orgId);
        String link = checkInService.generateCheckInLink(checkIn);
        return ResponseEntity.ok(OnlineCheckInDto.from(checkIn, link));
    }
}
