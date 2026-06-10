package com.clenzy.controller;

import com.clenzy.dto.CreateManagementContractRequest;
import com.clenzy.dto.ManagementContractDto;
import com.clenzy.model.ManagementContract.ContractStatus;
import com.clenzy.service.ManagementContractService;
import com.clenzy.service.signature.ContractSignatureService;
import com.clenzy.tenant.TenantContext;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

/**
 * Management contract CRUD — la plateforme (SUPER_ADMIN/SUPER_MANAGER) et les gestionnaires
 * de l'organisation (HOST) créent/gèrent les contrats, avec un taux de commission par propriété
 * qui pilote le moteur de répartition. L'accès est borné à l'organisation (TenantContext) et la
 * propriété ciblée est validée comme appartenant à l'org (ownership) côté service.
 */
@RestController
@RequestMapping("/api/management-contracts")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER','HOST')")
public class ManagementContractController {

    private final ManagementContractService contractService;
    private final ContractSignatureService contractSignatureService;
    private final TenantContext tenantContext;

    public ManagementContractController(ManagementContractService contractService,
                                         ContractSignatureService contractSignatureService,
                                         TenantContext tenantContext) {
        this.contractService = contractService;
        this.contractSignatureService = contractSignatureService;
        this.tenantContext = tenantContext;
    }

    @GetMapping
    public List<ManagementContractDto> getAll(
            @RequestParam(required = false) Long propertyId,
            @RequestParam(required = false) Long ownerId,
            @RequestParam(required = false) ContractStatus status) {
        Long orgId = tenantContext.getOrganizationId();
        if (propertyId != null) return contractService.getByProperty(propertyId, orgId);
        if (ownerId != null) return contractService.getByOwner(ownerId, orgId);
        if (status != null) return contractService.getByStatus(status, orgId);
        return contractService.getAllContracts(orgId);
    }

    @GetMapping("/{id}")
    public ManagementContractDto getById(@PathVariable Long id) {
        return contractService.getById(id, tenantContext.getOrganizationId());
    }

    @PostMapping
    public ManagementContractDto create(@Valid @RequestBody CreateManagementContractRequest request) {
        return contractService.createContract(request, tenantContext.getOrganizationId());
    }

    @PutMapping("/{id}")
    public ManagementContractDto update(@PathVariable Long id,
                                         @Valid @RequestBody CreateManagementContractRequest request) {
        return contractService.updateContract(id, tenantContext.getOrganizationId(), request);
    }

    @PutMapping("/{id}/activate")
    public ManagementContractDto activate(@PathVariable Long id) {
        return contractService.activateContract(id, tenantContext.getOrganizationId());
    }

    @PutMapping("/{id}/suspend")
    public ManagementContractDto suspend(@PathVariable Long id) {
        return contractService.suspendContract(id, tenantContext.getOrganizationId());
    }

    @PutMapping("/{id}/terminate")
    public ManagementContractDto terminate(@PathVariable Long id,
                                            @RequestBody Map<String, String> body) {
        String reason = body.getOrDefault("reason", "Terminated by manager");
        return contractService.terminateContract(id, tenantContext.getOrganizationId(), reason);
    }

    @PostMapping("/expire")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    public Map<String, Integer> expireContracts() {
        int count = contractService.expireContracts(tenantContext.getOrganizationId());
        return Map.of("expired", count);
    }

    /** Renvoie le lien de signature au propriétaire (contrats DRAFT uniquement). */
    @PostMapping("/{id}/signature/resend")
    public ManagementContractDto resendSignature(@PathVariable Long id) {
        Long orgId = tenantContext.getOrganizationId();
        contractSignatureService.resend(id, orgId);
        return contractService.getById(id, orgId);
    }

    /** Mandat PDF du contrat : version signée (avec certificat) si elle existe, sinon l'original. */
    @GetMapping("/{id}/mandate")
    public ResponseEntity<byte[]> downloadMandate(@PathVariable Long id) {
        var payload = contractSignatureService.getMandateForContract(id, tenantContext.getOrganizationId());
        String encodedFilename = URLEncoder.encode(payload.fileName(), StandardCharsets.UTF_8).replace("+", "%20");
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header("Content-Disposition", "inline; filename=\"" + payload.fileName() + "\"; "
                        + "filename*=UTF-8''" + encodedFilename)
                .header("Cache-Control", "private, no-store")
                .body(payload.bytes());
    }
}
