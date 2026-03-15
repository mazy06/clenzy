package com.clenzy.controller;

import com.clenzy.dto.PayoutScheduleConfigDto;
import com.clenzy.model.PayoutScheduleConfig;
import com.clenzy.repository.PayoutScheduleConfigRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/settings/payout-schedule")
@PreAuthorize("isAuthenticated()")
public class PayoutScheduleController {

    private final PayoutScheduleConfigRepository repository;

    public PayoutScheduleController(PayoutScheduleConfigRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    public ResponseEntity<PayoutScheduleConfigDto> getScheduleConfig() {
        return repository.findAll().stream()
                .findFirst()
                .map(config -> ResponseEntity.ok(PayoutScheduleConfigDto.from(config)))
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping
    @PreAuthorize("hasAnyRole('SUPER_ADMIN')")
    public PayoutScheduleConfigDto updateScheduleConfig(@RequestBody UpdatePayoutScheduleRequest request) {
        PayoutScheduleConfig config = repository.findAll().stream()
                .findFirst()
                .orElseGet(PayoutScheduleConfig::new);

        if (request.payoutDaysOfMonth() != null) {
            // Valider que les jours sont entre 1 et 28
            List<Integer> validDays = request.payoutDaysOfMonth().stream()
                    .filter(d -> d >= 1 && d <= 28)
                    .distinct()
                    .sorted()
                    .toList();
            config.setPayoutDaysOfMonth(validDays);
        }

        if (request.gracePeriodDays() != null) {
            config.setGracePeriodDays(Math.max(0, Math.min(request.gracePeriodDays(), 30)));
        }

        if (request.autoGenerateEnabled() != null) {
            config.setAutoGenerateEnabled(request.autoGenerateEnabled());
        }

        config = repository.save(config);
        return PayoutScheduleConfigDto.from(config);
    }

    public record UpdatePayoutScheduleRequest(
        List<Integer> payoutDaysOfMonth,
        Integer gracePeriodDays,
        Boolean autoGenerateEnabled
    ) {}
}
