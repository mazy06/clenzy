package com.clenzy.controller;

import com.clenzy.service.*;
import java.util.*;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController @RequestMapping("/api/finance/supplier-purchases")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
public class BaitlySupplierPurchaseController {
    private final BaitlySupplierPurchaseService service;
    public BaitlySupplierPurchaseController(BaitlySupplierPurchaseService service){this.service=service;}
    @GetMapping public List<Map<String,Object>> list(@AuthenticationPrincipal Jwt jwt){return service.list(jwt.getSubject());}
    @PostMapping(consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String,Long> create(@RequestPart BaitlySupplierPurchaseService.Request request,@RequestPart MultipartFile invoice,@AuthenticationPrincipal Jwt jwt){
        return Map.of("id",service.create(request,BaitlyFinancialDocument.read(invoice),jwt.getSubject()));
    }
    @PostMapping("/{id}/invitation") public Map<String,String> invite(@PathVariable long id,@AuthenticationPrincipal Jwt jwt){
        return Map.of("path",service.invite(id,jwt.getSubject()));
    }
    @PostMapping("/{id}/expense") public Map<String,Long> expense(@PathVariable long id,@AuthenticationPrincipal Jwt jwt){
        return Map.of("expenseId",service.prepareExpense(id,jwt.getSubject()));
    }
    public record SupplierSite(String url){}
    @PostMapping("/{id}/external") public void external(@PathVariable long id,@RequestBody SupplierSite site,@AuthenticationPrincipal Jwt jwt){service.chooseExternal(id,site.url(),jwt.getSubject());}
    @PostMapping(value="/{id}/external-receipt",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    public void receipt(@PathVariable long id,@RequestPart BaitlySupplierPurchaseService.ExternalReceipt request,@RequestPart MultipartFile receipt,@AuthenticationPrincipal Jwt jwt){
        service.recordExternal(id,request,BaitlyFinancialDocument.read(receipt),jwt.getSubject());
    }
    @GetMapping("/{id}/documents/{kind}") public ResponseEntity<byte[]> document(@PathVariable long id,@PathVariable String kind,@AuthenticationPrincipal Jwt jwt){
        if(!Set.of("invoice","receipt").contains(kind))throw new IllegalArgumentException("Type de justificatif inconnu.");
        var doc=service.document(id,"receipt".equals(kind),jwt.getSubject());
        String extension=doc.mime().equals("application/pdf")?"pdf":doc.mime().equals("image/png")?"png":"jpg";
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(doc.mime())).header("X-Content-Type-Options","nosniff")
            .header(HttpHeaders.CONTENT_DISPOSITION,"attachment; filename=\"baitly-fournisseur-"+id+"-"+kind+"."+extension+"\"").body(doc.bytes());
    }
}
