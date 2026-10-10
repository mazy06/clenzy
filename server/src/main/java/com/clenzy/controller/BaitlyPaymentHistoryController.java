package com.clenzy.controller;

import com.clenzy.model.PaymentStatus;
import com.clenzy.service.BaitlyPaymentHistoryReader;
import com.clenzy.service.PaymentQueryService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.util.Map;

/** Lecture Baitly des paiements sans mutation ni appel PSP. */
@RestController
@RequestMapping("/api/payments/history-page")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER','HOST')")
public class BaitlyPaymentHistoryController {
    private final BaitlyPaymentHistoryReader reader;
    private final PaymentQueryService payments;
    public BaitlyPaymentHistoryController(BaitlyPaymentHistoryReader reader, PaymentQueryService payments) {
        this.reader=reader;this.payments=payments;
    }

    @GetMapping
    public ResponseEntity<?> page(@AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue="0") int page, @RequestParam(defaultValue="10") int size,
            @RequestParam(required=false) String status, @RequestParam(required=false) Long hostId,
            @RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate dateFrom,
            @RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate dateTo,
            @RequestParam(required=false) String search, @RequestParam(defaultValue="true") boolean includeAmounts) {
        var user=payments.resolveCurrentUser(jwt.getSubject(),jwt.getClaimAsString("email"));
        if(user==null)return ResponseEntity.status(401).body(Map.of("error","Utilisateur inconnu"));
        try {
            var paymentStatus=status==null || status.isBlank()?null:PaymentStatus.fromString(status);
            return ResponseEntity.ok(reader.page(user,hostId,paymentStatus,dateFrom,dateTo,search,page,size,includeAmounts));
        } catch (IllegalArgumentException exception) {
            return ResponseEntity.badRequest().body(Map.of("error","Filtres de paiement invalides"));
        }
    }
}
