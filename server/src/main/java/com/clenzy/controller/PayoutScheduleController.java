package com.clenzy.controller;

import com.clenzy.dto.PayoutScheduleConfigDto;
import com.clenzy.service.PayoutScheduleService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/settings/payout-schedule")
@PreAuthorize("isAuthenticated()")
public class PayoutScheduleController {

    private final PayoutScheduleService payoutScheduleService;

    public PayoutScheduleController(PayoutScheduleService payoutScheduleService) {
        this.payoutScheduleService = payoutScheduleService;
    }

    @GetMapping
    public ResponseEntity<PayoutScheduleConfigDto> getScheduleConfig() {
        return payoutScheduleService.getScheduleConfig()
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping
    @PreAuthorize("hasAnyRole('SUPER_ADMIN')")
    public PayoutScheduleConfigDto updateScheduleConfig(@RequestBody UpdatePayoutScheduleRequest request) {
        return payoutScheduleService.updateScheduleConfig(
                request.payoutDaysOfMonth(), request.gracePeriodDays(), request.autoGenerateEnabled());
    }

    public record UpdatePayoutScheduleRequest(
        List<Integer> payoutDaysOfMonth,
        Integer gracePeriodDays,
        Boolean autoGenerateEnabled
    ) {}
}
