package com.clenzy.controller;

import com.clenzy.integration.baitlyiot.BaitlyIotClient;
import com.clenzy.integration.baitlyiot.BaitlyIotSensorService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/baitly-iot")
@PreAuthorize("hasAnyRole('HOST', 'ADMIN', 'SUPER_ADMIN')")
public class BaitlyIotController {
    private final BaitlyIotSensorService service;
    private final BaitlyIotClient client;

    public BaitlyIotController(BaitlyIotSensorService service, BaitlyIotClient client) {
        this.service = service;
        this.client = client;
    }

    public record Configuration(boolean configured, boolean simulatorsEnabled, String ingestionUrl) {}

    @GetMapping("/configuration")
    public Configuration configuration() {
        String ingestionUrl = client.ingestionUrl();
        return new Configuration(client.configured(), client.configured() && client.simulatorsEnabled(),
                ingestionUrl == null || ingestionUrl.isBlank() ? null : ingestionUrl);
    }

    @PostMapping("/noise-devices/register")
    @ResponseStatus(HttpStatus.CREATED)
    public BaitlyIotSensorService.Provisioned register(@AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody BaitlyIotSensorService.Register input) {
        return service.register(input, jwt.getSubject());
    }

    @PostMapping("/noise-devices/{id}/mqtt-identity")
    public BaitlyIotSensorService.MqttIdentity mqttIdentity(@AuthenticationPrincipal Jwt jwt, @PathVariable long id) {
        return service.mqttIdentity(id, jwt.getSubject());
    }

    @PostMapping("/noise-devices")
    @ResponseStatus(HttpStatus.CREATED)
    public BaitlyIotSensorService.Created create(@AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody BaitlyIotSensorService.Create input) {
        return service.create(input, jwt.getSubject());
    }

    @GetMapping("/noise-devices/{id}")
    public BaitlyIotSensorService.State state(@AuthenticationPrincipal Jwt jwt, @PathVariable long id) {
        return service.state(id, jwt.getSubject());
    }

    @PostMapping("/noise-devices/attach")
    @ResponseStatus(HttpStatus.CREATED)
    public BaitlyIotSensorService.Created attach(@AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody BaitlyIotSensorService.Attach input) {
        return service.attach(input, jwt.getSubject());
    }

    @PostMapping("/noise-devices/{id}/simulate")
    public BaitlyIotClient.IngestionResult simulate(@AuthenticationPrincipal Jwt jwt, @PathVariable long id,
            @Valid @RequestBody BaitlyIotSensorService.Simulate input) {
        return service.simulate(id, input, jwt.getSubject());
    }

    @PostMapping("/noise-devices/{id}/credentials")
    public BaitlyIotSensorService.Secret credentials(@AuthenticationPrincipal Jwt jwt, @PathVariable long id) {
        return service.credentials(id, jwt.getSubject());
    }

    @PostMapping("/noise-devices/{id}/revoke")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void revoke(@AuthenticationPrincipal Jwt jwt, @PathVariable long id) { service.revoke(id, jwt.getSubject()); }

    @DeleteMapping("/noise-devices/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable long id) { service.delete(id, jwt.getSubject()); }
}
