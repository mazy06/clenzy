package com.baitly.iot;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import static com.baitly.iot.DeviceContracts.*;

@RestController
@Validated
@PreAuthorize("hasRole('ADMIN')")
@RequestMapping("/internal/v1/organizations/{organizationId}/devices")
public class DeviceManagementController {
    private final DeviceService service;

    public DeviceManagementController(DeviceService service) {
        this.service = service;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public DeviceCredentials register(@PathVariable @Positive long organizationId, @Valid @RequestBody RegisterDevice input) {
        return service.register(organizationId, input);
    }

    @GetMapping
    public List<DeviceView> list(@PathVariable @Positive long organizationId) {
        return service.list(organizationId);
    }

    @PutMapping("/simulators/{id}")
    public DeviceView ensureSimulator(@PathVariable @Positive long organizationId, @PathVariable UUID id,
                                      @Valid @RequestBody RegisterDevice input) {
        return service.ensureSimulator(id, organizationId, input);
    }

    @PutMapping("/physical/{id}")
    public DeviceView ensurePhysical(@PathVariable @Positive long organizationId, @PathVariable UUID id,
                                     @Valid @RequestBody RegisterDevice input) {
        return service.ensurePhysical(id, organizationId, input);
    }

    @PostMapping("/{id}/mqtt-identity")
    public MqttIdentity rotateMqttIdentity(@PathVariable long organizationId, @PathVariable UUID id) {
        return service.rotateMqttIdentity(id, organizationId);
    }

    @PostMapping("/{id}/erasure")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void requestErasure(@PathVariable long organizationId, @PathVariable UUID id) {
        service.requestErasure(id, organizationId);
    }

    @PostMapping("/{id}/credentials")
    public DeviceCredentials rotate(@PathVariable long organizationId, @PathVariable UUID id) {
        return service.rotate(id, organizationId);
    }

    @PostMapping("/{id}/simulate")
    public IngestionResult simulate(@PathVariable long organizationId, @PathVariable UUID id,
                                    @Valid @RequestBody NoiseMeasurement input) {
        return service.simulate(id, organizationId, input);
    }

    @GetMapping("/{id}")
    public DeviceView get(@PathVariable long organizationId, @PathVariable UUID id) {
        return service.get(id, organizationId);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void revoke(@PathVariable long organizationId, @PathVariable UUID id) {
        service.revoke(id, organizationId);
    }

    @GetMapping("/{id}/measurements")
    public List<MeasurementView> measurements(@PathVariable long organizationId, @PathVariable UUID id,
            @RequestParam Instant from, @RequestParam Instant to, @RequestParam(defaultValue = "1000") int limit,
            @RequestParam(required = false) @Positive Long propertyId) {
        return service.measurements(id, organizationId, propertyId, from, to, limit);
    }
}
