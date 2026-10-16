package com.baitly.iot;

import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import static com.baitly.iot.DeviceContracts.*;

@RestController
@PreAuthorize("hasRole('DEVICE')")
public class MeasurementController {
    private final DeviceService service;

    public MeasurementController(DeviceService service) {
        this.service = service;
    }

    @PostMapping("/api/v1/measurements")
    public IngestionResult ingest(@AuthenticationPrincipal DeviceIdentity identity, @Valid @RequestBody NoiseMeasurement input) {
        return service.ingest(identity, input);
    }
}
