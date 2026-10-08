package com.clenzy.controller;

import com.clenzy.service.paymentconnect.PaymentConnectAccess.Scope;
import com.clenzy.service.paymentconnect.PaymentConnectService;
import com.clenzy.service.paymentconnect.PaymentConnectService.Intent;
import com.clenzy.service.paymentconnect.PaymentConnectService.Status;
import com.stripe.exception.StripeException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping({"/api/payment-connections", "/api/me/payment-connections"})
@PreAuthorize("isAuthenticated()")
public class PaymentConnectController {
    private final PaymentConnectService service;
    public PaymentConnectController(PaymentConnectService service) { this.service = service; }
    public record Start(@NotNull Scope scope, @NotNull @Pattern(regexp = "FR|MA|SA") String country, @NotNull Intent intent) {}
    public record Complete(@NotNull Scope scope, @NotNull @Size(max = 36) String state, @NotNull @Size(max = 2048) String code) {}
    public record Link(String url) {}

    @GetMapping("/me")
    public Status status(@AuthenticationPrincipal Jwt jwt, @RequestParam(defaultValue = "PERSONAL") Scope scope) {
        return service.status(jwt.getSubject(), scope);
    }
    @PostMapping("/stripe/start")
    public Link start(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody Start request) throws StripeException {
        return new Link(service.start(jwt.getSubject(), request.scope(), request.country(), request.intent()));
    }
    @PostMapping("/stripe/complete")
    public Status complete(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody Complete request) throws StripeException {
        return service.complete(jwt.getSubject(), request.scope(), request.state(), request.code());
    }
    @PostMapping("/stripe/refresh")
    public Status refresh(@AuthenticationPrincipal Jwt jwt, @RequestParam(defaultValue = "PERSONAL") Scope scope) throws StripeException {
        return service.refresh(jwt.getSubject(), scope);
    }
    @ExceptionHandler(StripeException.class)
    public void stripeUnavailable() {
        // Never return SDK responses containing financial details or credentials to the browser.
        throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Payment provider unavailable");
    }
}
