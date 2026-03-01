package com.clenzy.controller;

import com.clenzy.dto.OnlineCheckInSubmission;
import com.clenzy.dto.PublicCheckInDataDto;
import com.clenzy.model.OnlineCheckIn;
import com.clenzy.service.OnlineCheckInService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/public/checkin")
public class PublicCheckInController {

    private final OnlineCheckInService checkInService;

    public PublicCheckInController(OnlineCheckInService checkInService) {
        this.checkInService = checkInService;
    }

    @GetMapping("/{token}")
    public ResponseEntity<PublicCheckInDataDto> getCheckInData(@PathVariable UUID token) {
        return checkInService.getByToken(token)
            .map(PublicCheckInDataDto::from)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{token}/start")
    public ResponseEntity<Map<String, String>> startCheckIn(@PathVariable UUID token) {
        checkInService.startCheckIn(token);
        return ResponseEntity.ok(Map.of("status", "STARTED"));
    }

    @PostMapping("/{token}/submit")
    public ResponseEntity<Map<String, String>> submitCheckIn(
            @PathVariable UUID token,
            @Valid @RequestBody OnlineCheckInSubmission submission) {
        checkInService.completeCheckIn(token,
            submission.firstName(), submission.lastName(),
            submission.email(), submission.phone(),
            submission.idDocumentNumber(), submission.idDocumentType(),
            submission.estimatedArrivalTime(), submission.specialRequests(),
            submission.numberOfGuests(), submission.additionalGuests());
        return ResponseEntity.ok(Map.of("status", "COMPLETED"));
    }
}
