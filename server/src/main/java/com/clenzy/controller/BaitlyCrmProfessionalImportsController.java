package com.clenzy.controller;

import com.clenzy.service.BaitlyCrmProfessionalImports;
import com.clenzy.marketplace.service.BaitlyProfessionalDirectory.*;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/prospects/professional-imports")
@PreAuthorize("isAuthenticated() and hasPermission(null, 'baitly-crm:view') and hasPermission(null, 'baitly-crm:manage')")
public class BaitlyCrmProfessionalImportsController {
    private final BaitlyCrmProfessionalImports imports;
    public BaitlyCrmProfessionalImportsController(BaitlyCrmProfessionalImports imports){this.imports=imports;}
    @GetMapping("/cities")
    public com.fasterxml.jackson.databind.JsonNode cities(@AuthenticationPrincipal Jwt jwt,@RequestParam String name){return imports.cities(jwt.getSubject(),name);}
    @PostMapping("/search")
    public Preview search(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody Search input){return imports.search(jwt.getSubject(),input);}
    @PostMapping("/confirm-batch")
    public List<ImportResult> confirm(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody BulkChoices input){return imports.importSelection(jwt.getSubject(),input);}
    @PostMapping("/references/{id}")
    public ImportResult reference(@AuthenticationPrincipal Jwt jwt,@PathVariable long id){return imports.importReference(jwt.getSubject(),id);}
    @PostMapping("/references/confirm-batch")
    public List<ImportResult> references(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody BaitlyCrmProfessionalImports.References input){return imports.importReferences(jwt.getSubject(),input);}
    @ExceptionHandler(IllegalArgumentException.class) @ResponseStatus(org.springframework.http.HttpStatus.BAD_REQUEST)
    public Map<String,String> invalid(IllegalArgumentException e){return Map.of("message",e.getMessage());}
}
