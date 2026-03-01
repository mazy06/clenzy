package com.clenzy.service;

import com.clenzy.dto.CreateManagementContractRequest;
import com.clenzy.dto.ManagementContractDto;
import com.clenzy.model.ManagementContract;
import com.clenzy.model.ManagementContract.ContractStatus;
import com.clenzy.repository.ManagementContractRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Service
@Transactional(readOnly = true)
public class ManagementContractService {

    private static final Logger log = LoggerFactory.getLogger(ManagementContractService.class);

    private final ManagementContractRepository contractRepository;

    public ManagementContractService(ManagementContractRepository contractRepository) {
        this.contractRepository = contractRepository;
    }

    public List<ManagementContractDto> getAllContracts(Long orgId) {
        return contractRepository.findAllByOrgId(orgId).stream()
            .map(ManagementContractDto::from)
            .toList();
    }

    public List<ManagementContractDto> getByProperty(Long propertyId, Long orgId) {
        return contractRepository.findByPropertyId(propertyId, orgId).stream()
            .map(ManagementContractDto::from)
            .toList();
    }

    public List<ManagementContractDto> getByOwner(Long ownerId, Long orgId) {
        return contractRepository.findByOwnerId(ownerId, orgId).stream()
            .map(ManagementContractDto::from)
            .toList();
    }

    public List<ManagementContractDto> getByStatus(ContractStatus status, Long orgId) {
        return contractRepository.findByStatus(status, orgId).stream()
            .map(ManagementContractDto::from)
            .toList();
    }

    public ManagementContractDto getById(Long id, Long orgId) {
        return contractRepository.findByIdAndOrgId(id, orgId)
            .map(ManagementContractDto::from)
            .orElseThrow(() -> new IllegalArgumentException("Contract not found: " + id));
    }

    /**
     * Retourne le taux de commission du contrat actif pour une propriete.
     * Utilise par AccountingService pour calculer les payouts avec le bon taux.
     */
    public Optional<ManagementContract> getActiveContract(Long propertyId, Long orgId) {
        return contractRepository.findActiveByPropertyId(propertyId, orgId);
    }

    @Transactional
    public ManagementContractDto createContract(CreateManagementContractRequest request, Long orgId) {
        // Verifier qu'il n'y a pas de contrat actif pour cette propriete
        Optional<ManagementContract> existing = contractRepository.findActiveByPropertyId(request.propertyId(), orgId);
        if (existing.isPresent()) {
            throw new IllegalStateException(
                "Property " + request.propertyId() + " already has an active contract: " + existing.get().getContractNumber());
        }

        ManagementContract contract = new ManagementContract();
        contract.setOrganizationId(orgId);
        contract.setPropertyId(request.propertyId());
        contract.setOwnerId(request.ownerId());
        contract.setContractType(request.contractType());
        contract.setStartDate(request.startDate());
        contract.setEndDate(request.endDate());
        contract.setCommissionRate(request.commissionRate());
        contract.setMinimumStayNights(request.minimumStayNights());
        contract.setAutoRenew(request.autoRenew() != null ? request.autoRenew() : false);
        contract.setNoticePeriodDays(request.noticePeriodDays() != null ? request.noticePeriodDays() : 30);
        contract.setCleaningFeeIncluded(request.cleaningFeeIncluded() != null ? request.cleaningFeeIncluded() : true);
        contract.setMaintenanceIncluded(request.maintenanceIncluded() != null ? request.maintenanceIncluded() : true);
        contract.setNotes(request.notes());
        contract.setStatus(ContractStatus.DRAFT);

        ManagementContract saved = contractRepository.save(contract);
        log.info("Created management contract {} for property {}", saved.getContractNumber(), request.propertyId());
        return ManagementContractDto.from(saved);
    }

    @Transactional
    public ManagementContractDto activateContract(Long id, Long orgId) {
        ManagementContract contract = getEntity(id, orgId);

        if (contract.getStatus() != ContractStatus.DRAFT && contract.getStatus() != ContractStatus.SUSPENDED) {
            throw new IllegalStateException("Can only activate DRAFT or SUSPENDED contracts, current: " + contract.getStatus());
        }

        // Verifier qu'il n'y a pas d'autre contrat actif pour cette propriete
        Optional<ManagementContract> existing = contractRepository.findActiveByPropertyId(contract.getPropertyId(), orgId);
        if (existing.isPresent() && !existing.get().getId().equals(id)) {
            throw new IllegalStateException("Property already has an active contract: " + existing.get().getContractNumber());
        }

        contract.setStatus(ContractStatus.ACTIVE);
        contract.setSignedAt(Instant.now());
        ManagementContract saved = contractRepository.save(contract);
        log.info("Activated contract {} for property {}", saved.getContractNumber(), saved.getPropertyId());
        return ManagementContractDto.from(saved);
    }

    @Transactional
    public ManagementContractDto suspendContract(Long id, Long orgId) {
        ManagementContract contract = getEntity(id, orgId);

        if (contract.getStatus() != ContractStatus.ACTIVE) {
            throw new IllegalStateException("Can only suspend ACTIVE contracts, current: " + contract.getStatus());
        }

        contract.setStatus(ContractStatus.SUSPENDED);
        ManagementContract saved = contractRepository.save(contract);
        log.info("Suspended contract {} for property {}", saved.getContractNumber(), saved.getPropertyId());
        return ManagementContractDto.from(saved);
    }

    @Transactional
    public ManagementContractDto terminateContract(Long id, Long orgId, String reason) {
        ManagementContract contract = getEntity(id, orgId);

        if (contract.getStatus() == ContractStatus.TERMINATED || contract.getStatus() == ContractStatus.EXPIRED) {
            throw new IllegalStateException("Contract is already terminated or expired");
        }

        contract.setStatus(ContractStatus.TERMINATED);
        contract.setTerminatedAt(Instant.now());
        contract.setTerminationReason(reason);
        ManagementContract saved = contractRepository.save(contract);
        log.info("Terminated contract {} for property {}: {}", saved.getContractNumber(), saved.getPropertyId(), reason);
        return ManagementContractDto.from(saved);
    }

    /**
     * Expire les contrats dont la date de fin est depassee.
     * Pour les contrats auto-renew, renouvelle avec un nouveau contrat.
     */
    @Transactional
    public int expireContracts(Long orgId) {
        List<ManagementContract> expired = contractRepository.findExpiredContracts(LocalDate.now(), orgId);
        int count = 0;

        for (ManagementContract contract : expired) {
            if (Boolean.TRUE.equals(contract.getAutoRenew())) {
                // Auto-renew: creer un nouveau contrat
                ManagementContract renewed = new ManagementContract();
                renewed.setOrganizationId(orgId);
                renewed.setPropertyId(contract.getPropertyId());
                renewed.setOwnerId(contract.getOwnerId());
                renewed.setContractType(contract.getContractType());
                renewed.setStartDate(contract.getEndDate().plusDays(1));
                renewed.setEndDate(contract.getEndDate().plusYears(1));
                renewed.setCommissionRate(contract.getCommissionRate());
                renewed.setMinimumStayNights(contract.getMinimumStayNights());
                renewed.setAutoRenew(true);
                renewed.setNoticePeriodDays(contract.getNoticePeriodDays());
                renewed.setCleaningFeeIncluded(contract.getCleaningFeeIncluded());
                renewed.setMaintenanceIncluded(contract.getMaintenanceIncluded());
                renewed.setStatus(ContractStatus.ACTIVE);
                renewed.setSignedAt(Instant.now());
                contractRepository.save(renewed);
                log.info("Auto-renewed contract {} -> {}", contract.getContractNumber(), renewed.getContractNumber());
            }

            contract.setStatus(ContractStatus.EXPIRED);
            contractRepository.save(contract);
            count++;
        }

        return count;
    }

    @Transactional
    public ManagementContractDto updateContract(Long id, Long orgId, CreateManagementContractRequest request) {
        ManagementContract contract = getEntity(id, orgId);

        if (contract.getStatus() != ContractStatus.DRAFT) {
            throw new IllegalStateException("Can only update DRAFT contracts, current: " + contract.getStatus());
        }

        contract.setPropertyId(request.propertyId());
        contract.setOwnerId(request.ownerId());
        contract.setContractType(request.contractType());
        contract.setStartDate(request.startDate());
        contract.setEndDate(request.endDate());
        contract.setCommissionRate(request.commissionRate());
        contract.setMinimumStayNights(request.minimumStayNights());
        if (request.autoRenew() != null) contract.setAutoRenew(request.autoRenew());
        if (request.noticePeriodDays() != null) contract.setNoticePeriodDays(request.noticePeriodDays());
        if (request.cleaningFeeIncluded() != null) contract.setCleaningFeeIncluded(request.cleaningFeeIncluded());
        if (request.maintenanceIncluded() != null) contract.setMaintenanceIncluded(request.maintenanceIncluded());
        contract.setNotes(request.notes());

        ManagementContract saved = contractRepository.save(contract);
        return ManagementContractDto.from(saved);
    }

    private ManagementContract getEntity(Long id, Long orgId) {
        return contractRepository.findByIdAndOrgId(id, orgId)
            .orElseThrow(() -> new IllegalArgumentException("Contract not found: " + id));
    }
}
