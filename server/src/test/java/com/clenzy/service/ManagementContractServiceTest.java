package com.clenzy.service;

import com.clenzy.dto.CreateManagementContractRequest;
import com.clenzy.dto.ManagementContractDto;
import com.clenzy.model.ManagementContract;
import com.clenzy.model.ManagementContract.ContractStatus;
import com.clenzy.model.ManagementContract.ContractType;
import com.clenzy.repository.ManagementContractRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ManagementContractServiceTest {

    @Mock private ManagementContractRepository contractRepository;
    @InjectMocks private ManagementContractService service;

    private static final Long ORG_ID = 1L;

    private ManagementContract createContract(ContractStatus status) {
        ManagementContract c = new ManagementContract();
        c.setId(1L);
        c.setOrganizationId(ORG_ID);
        c.setPropertyId(100L);
        c.setOwnerId(10L);
        c.setContractNumber("MC-001");
        c.setContractType(ContractType.FULL_MANAGEMENT);
        c.setStatus(status);
        c.setStartDate(LocalDate.of(2025, 1, 1));
        c.setEndDate(LocalDate.of(2025, 12, 31));
        c.setCommissionRate(new BigDecimal("0.2000"));
        c.setAutoRenew(false);
        c.setNoticePeriodDays(30);
        c.setCleaningFeeIncluded(true);
        c.setMaintenanceIncluded(true);
        return c;
    }

    @Test
    void createContract_success() {
        CreateManagementContractRequest request = new CreateManagementContractRequest(
            100L, 10L, ContractType.FULL_MANAGEMENT,
            LocalDate.of(2025, 1, 1), LocalDate.of(2025, 12, 31),
            new BigDecimal("0.2000"), null, false, 30, true, true, "Notes"
        );
        when(contractRepository.findActiveByPropertyId(100L, ORG_ID)).thenReturn(Optional.empty());
        when(contractRepository.save(any())).thenAnswer(inv -> {
            ManagementContract saved = inv.getArgument(0);
            saved.setId(1L);
            return saved;
        });

        ManagementContractDto result = service.createContract(request, ORG_ID);

        assertNotNull(result);
        assertEquals(100L, result.propertyId());
        assertEquals(10L, result.ownerId());
        assertEquals(ContractType.FULL_MANAGEMENT, result.contractType());
        assertEquals(ContractStatus.DRAFT, result.status());
        assertEquals(0, new BigDecimal("0.2000").compareTo(result.commissionRate()));
    }

    @Test
    void createContract_alreadyActiveContract_throws() {
        CreateManagementContractRequest request = new CreateManagementContractRequest(
            100L, 10L, ContractType.FULL_MANAGEMENT,
            LocalDate.of(2025, 1, 1), null,
            new BigDecimal("0.2000"), null, null, null, null, null, null
        );
        when(contractRepository.findActiveByPropertyId(100L, ORG_ID))
            .thenReturn(Optional.of(createContract(ContractStatus.ACTIVE)));

        assertThrows(IllegalStateException.class, () -> service.createContract(request, ORG_ID));
    }

    @Test
    void activateContract_fromDraft() {
        ManagementContract contract = createContract(ContractStatus.DRAFT);
        when(contractRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.of(contract));
        when(contractRepository.findActiveByPropertyId(100L, ORG_ID)).thenReturn(Optional.empty());
        when(contractRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        ManagementContractDto result = service.activateContract(1L, ORG_ID);

        assertEquals(ContractStatus.ACTIVE, result.status());
        assertNotNull(result.signedAt());
    }

    @Test
    void activateContract_fromActive_throws() {
        ManagementContract contract = createContract(ContractStatus.ACTIVE);
        when(contractRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.of(contract));

        assertThrows(IllegalStateException.class, () -> service.activateContract(1L, ORG_ID));
    }

    @Test
    void suspendContract_success() {
        ManagementContract contract = createContract(ContractStatus.ACTIVE);
        when(contractRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.of(contract));
        when(contractRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        ManagementContractDto result = service.suspendContract(1L, ORG_ID);

        assertEquals(ContractStatus.SUSPENDED, result.status());
    }

    @Test
    void suspendContract_notActive_throws() {
        ManagementContract contract = createContract(ContractStatus.DRAFT);
        when(contractRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.of(contract));

        assertThrows(IllegalStateException.class, () -> service.suspendContract(1L, ORG_ID));
    }

    @Test
    void terminateContract_success() {
        ManagementContract contract = createContract(ContractStatus.ACTIVE);
        when(contractRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.of(contract));
        when(contractRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        ManagementContractDto result = service.terminateContract(1L, ORG_ID, "Owner request");

        assertEquals(ContractStatus.TERMINATED, result.status());
        assertNotNull(result.terminatedAt());
        assertEquals("Owner request", result.terminationReason());
    }

    @Test
    void terminateContract_alreadyTerminated_throws() {
        ManagementContract contract = createContract(ContractStatus.TERMINATED);
        when(contractRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.of(contract));

        assertThrows(IllegalStateException.class, () -> service.terminateContract(1L, ORG_ID, "reason"));
    }

    @Test
    void expireContracts_withAutoRenew() {
        ManagementContract contract = createContract(ContractStatus.ACTIVE);
        contract.setAutoRenew(true);
        contract.setEndDate(LocalDate.now().minusDays(1));
        when(contractRepository.findExpiredContracts(any(), eq(ORG_ID))).thenReturn(List.of(contract));
        when(contractRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        int count = service.expireContracts(ORG_ID);

        assertEquals(1, count);
        // Verify 2 saves: 1 for new renewed contract + 1 for expired
        verify(contractRepository, times(2)).save(any());
        // Check the expired contract
        assertEquals(ContractStatus.EXPIRED, contract.getStatus());
    }

    @Test
    void expireContracts_withoutAutoRenew() {
        ManagementContract contract = createContract(ContractStatus.ACTIVE);
        contract.setAutoRenew(false);
        contract.setEndDate(LocalDate.now().minusDays(1));
        when(contractRepository.findExpiredContracts(any(), eq(ORG_ID))).thenReturn(List.of(contract));
        when(contractRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        int count = service.expireContracts(ORG_ID);

        assertEquals(1, count);
        verify(contractRepository, times(1)).save(any()); // Only the expired
        assertEquals(ContractStatus.EXPIRED, contract.getStatus());
    }

    @Test
    void updateContract_draftOnly() {
        ManagementContract contract = createContract(ContractStatus.DRAFT);
        when(contractRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.of(contract));
        when(contractRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        CreateManagementContractRequest request = new CreateManagementContractRequest(
            100L, 10L, ContractType.BOOKING_ONLY,
            LocalDate.of(2025, 6, 1), null,
            new BigDecimal("0.1500"), 2, true, 60, false, false, "Updated"
        );

        ManagementContractDto result = service.updateContract(1L, ORG_ID, request);

        assertEquals(ContractType.BOOKING_ONLY, result.contractType());
        assertEquals(0, new BigDecimal("0.1500").compareTo(result.commissionRate()));
    }

    @Test
    void updateContract_activeContract_throws() {
        ManagementContract contract = createContract(ContractStatus.ACTIVE);
        when(contractRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.of(contract));

        CreateManagementContractRequest request = new CreateManagementContractRequest(
            100L, 10L, ContractType.FULL_MANAGEMENT,
            LocalDate.of(2025, 1, 1), null,
            new BigDecimal("0.2000"), null, null, null, null, null, null
        );

        assertThrows(IllegalStateException.class, () -> service.updateContract(1L, ORG_ID, request));
    }

    @Test
    void getActiveContract_returnsContract() {
        ManagementContract contract = createContract(ContractStatus.ACTIVE);
        when(contractRepository.findActiveByPropertyId(100L, ORG_ID)).thenReturn(Optional.of(contract));

        Optional<ManagementContract> result = service.getActiveContract(100L, ORG_ID);

        assertTrue(result.isPresent());
        assertEquals(0, new BigDecimal("0.2000").compareTo(result.get().getCommissionRate()));
    }
}
