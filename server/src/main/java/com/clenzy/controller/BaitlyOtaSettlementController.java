package com.clenzy.controller;

import com.clenzy.service.BaitlyFinancialDocument;
import com.clenzy.service.BaitlyOtaSettlementService;
import java.util.*;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/finance/ota-settlements")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
public class BaitlyOtaSettlementController {
    @GetMapping("/candidates") public List<Map<String,Object>> candidates(@RequestParam long reservationId,@AuthenticationPrincipal Jwt jwt){return service.candidates(reservationId,jwt.getSubject());}
    private final BaitlyOtaSettlementService service;
    public BaitlyOtaSettlementController(BaitlyOtaSettlementService service) { this.service=service; }
    @GetMapping("/context") public Map<String,Object> context(@RequestParam long reservationId,@AuthenticationPrincipal Jwt jwt) {
        return service.context(reservationId,jwt.getSubject());
    }
    @GetMapping public List<Map<String,Object>> list(@RequestParam long reservationId,@AuthenticationPrincipal Jwt jwt) {
        return service.list(reservationId,jwt.getSubject());
    }
    @PostMapping(consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String,Long> record(@RequestPart BaitlyOtaSettlementService.Request request,@RequestPart MultipartFile statement,
            @RequestPart MultipartFile bankReceipt,@AuthenticationPrincipal Jwt jwt) {
        // Conserver une marge pour les en-têtes multipart sous la limite HTTP de 10 Mo.
        if (statement.getSize()+bankReceipt.getSize()>9*1024*1024)
            throw new IllegalArgumentException("Les deux justificatifs doivent totaliser 9 Mo maximum (5 Mo par fichier).");
        return Map.of("id",service.record(request,BaitlyFinancialDocument.read(statement),BaitlyFinancialDocument.read(bankReceipt),jwt.getSubject()));
    }
    public record Correction(String reason) {}
    @PostMapping("/{id}/void") public void voidRecord(@PathVariable long id,@RequestBody Correction correction,@AuthenticationPrincipal Jwt jwt) {
        service.voidRecord(id,correction.reason(),jwt.getSubject());
    }
    @GetMapping("/{id}/documents/{kind}") public ResponseEntity<byte[]> document(@PathVariable long id,@PathVariable String kind,@AuthenticationPrincipal Jwt jwt) {
        if(!Set.of("statement","bank").contains(kind)) throw new IllegalArgumentException("Type de justificatif inconnu.");
        var doc=service.document(id,"bank".equals(kind),jwt.getSubject());
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(doc.mime()))
                .header(HttpHeaders.CONTENT_DISPOSITION,"attachment; filename=\"justificatif-ota-"+id+(doc.mime().equals("application/pdf")?".pdf":doc.mime().equals("image/png")?".png":".jpg")+"\"")
                .header("X-Content-Type-Options","nosniff").body(doc.bytes());
    }
}
