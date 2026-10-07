package com.clenzy.controller;

import com.clenzy.service.*;
import com.clenzy.exception.KeycloakOperationException;
import com.clenzy.util.StringUtils;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.Duration;
import java.util.*;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController @PreAuthorize("isAuthenticated()")
public class BaitlySupplierRegistrationController {
    private final BaitlySupplierRegistration registration;
    private final LoginProtectionService protection;
    public BaitlySupplierRegistrationController(BaitlySupplierRegistration registration,LoginProtectionService protection) {
        this.registration=registration;this.protection=protection;
    }
    public record Registration(@NotBlank @Pattern(regexp="[a-f0-9-]{36}\\.[a-f0-9-]{36}") String token,
        @NotBlank @Email @Size(max=320) String email,@NotBlank @Size(max=100) String firstName,@NotBlank @Size(max=100) String lastName) {}
    // Chemin public déjà déclaré dans SecurityConfigProd ; variante explicite, sans élargir les règles globales.
    @PostMapping(value="/api/invitations/register",params="kind=supplier") @PreAuthorize("permitAll()")
    public ResponseEntity<Map<String,String>> register(@Valid @RequestBody Registration body,HttpServletRequest request) {
        String email=body.email().trim().toLowerCase(Locale.ROOT);
        if(!protection.tryAcquire("supplier-register:ip:"+request.getRemoteAddr(),10,Duration.ofHours(1))
            || !protection.tryAcquire("supplier-register:email:"+StringUtils.computeEmailHash(email),5,Duration.ofHours(1)))
            return ResponseEntity.status(429).body(Map.of("message","Veuillez patienter avant une nouvelle demande d'activation."));
        try {registration.register(body.token(),email,body.firstName(),body.lastName());}
        catch(KeycloakOperationException failure) {return ResponseEntity.status(503).body(Map.of("message","Activation non confirmée. Réessayez avec la même invitation ou connectez-vous si votre compte existe déjà."));}
        return ResponseEntity.accepted().body(Map.of("status","ACTIVATION_SENT"));
    }
}
