package com.clenzy.controller;

import java.util.Map;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

/** Les contraintes documentaires retournent un conflit exploitable, sans exposer le SQL. */
@RestControllerAdvice(assignableTypes={BaitlyOtaSettlementController.class,BaitlySupplierPurchaseController.class})
@Order(Ordered.HIGHEST_PRECEDENCE)
public class BaitlyFinancialDocumentAdvice {
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String,Object>> invalid(IllegalArgumentException exception) {
        return ResponseEntity.badRequest().body(Map.of("status",400,"code","INVALID_FINANCIAL_DOCUMENT","message",exception.getMessage()));
    }
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String,Object>> conflict(DataIntegrityViolationException exception) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("status",409,"code","FINANCIAL_DOCUMENT_CONFLICT",
            "message","Cette facture ou ce justificatif est déjà utilisé, ou sa répartition a changé. Actualisez le dossier avant de reprendre."));
    }
}
