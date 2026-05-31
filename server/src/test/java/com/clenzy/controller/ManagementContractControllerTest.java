package com.clenzy.controller;

import com.clenzy.dto.CreateManagementContractRequest;
import com.clenzy.dto.ManagementContractDto;
import com.clenzy.model.ManagementContract.ContractStatus;
import com.clenzy.model.ManagementContract.ContractType;
import com.clenzy.service.ManagementContractService;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ManagementContractControllerTest {

    @Mock private ManagementContractService contractService;
    @Mock private TenantContext tenantContext;

    private ManagementContractController controller;

    @BeforeEach
    void setUp() {
        controller = new ManagementContractController(contractService, tenantContext);
        lenient().when(tenantContext.getOrganizationId()).thenReturn(1L);
    }

    private ManagementContractDto buildDto(Long id) {
        return new ManagementContractDto(
            id, 1L, 2L, "C-" + id, ContractType.FULL_MANAGEMENT,
            ContractStatus.ACTIVE, LocalDate.now(), LocalDate.now().plusYears(1),
            new BigDecimal("0.20"), 2, true, 30, false, false,
            "notes", Instant.now(), null, null, Instant.now());
    }

    @Test
    void getAll_noFilters_returnsAllContracts() {
        List<ManagementContractDto> list = List.of(buildDto(1L));
        when(contractService.getAllContracts(1L)).thenReturn(list);

        assertEquals(list, controller.getAll(null, null, null));
    }

    @Test
    void getAll_byPropertyId() {
        List<ManagementContractDto> list = List.of(buildDto(1L));
        when(contractService.getByProperty(5L, 1L)).thenReturn(list);

        assertEquals(list, controller.getAll(5L, null, null));
        verify(contractService).getByProperty(5L, 1L);
    }

    @Test
    void getAll_byOwnerId() {
        List<ManagementContractDto> list = List.of(buildDto(1L));
        when(contractService.getByOwner(7L, 1L)).thenReturn(list);

        assertEquals(list, controller.getAll(null, 7L, null));
    }

    @Test
    void getAll_byStatus() {
        List<ManagementContractDto> list = List.of();
        when(contractService.getByStatus(ContractStatus.ACTIVE, 1L)).thenReturn(list);

        assertEquals(list, controller.getAll(null, null, ContractStatus.ACTIVE));
    }

    @Test
    void getById_delegatesToService() {
        ManagementContractDto dto = buildDto(10L);
        when(contractService.getById(10L, 1L)).thenReturn(dto);

        assertEquals(dto, controller.getById(10L));
    }

    @Test
    void create_delegatesToService() {
        CreateManagementContractRequest req = mock(CreateManagementContractRequest.class);
        ManagementContractDto dto = buildDto(1L);
        when(contractService.createContract(req, 1L)).thenReturn(dto);

        assertEquals(dto, controller.create(req));
    }

    @Test
    void update_delegatesToService() {
        CreateManagementContractRequest req = mock(CreateManagementContractRequest.class);
        ManagementContractDto dto = buildDto(10L);
        when(contractService.updateContract(10L, 1L, req)).thenReturn(dto);

        assertEquals(dto, controller.update(10L, req));
    }

    @Test
    void activate_delegatesToService() {
        ManagementContractDto dto = buildDto(10L);
        when(contractService.activateContract(10L, 1L)).thenReturn(dto);

        assertEquals(dto, controller.activate(10L));
    }

    @Test
    void suspend_delegatesToService() {
        ManagementContractDto dto = buildDto(10L);
        when(contractService.suspendContract(10L, 1L)).thenReturn(dto);

        assertEquals(dto, controller.suspend(10L));
    }

    @Test
    void terminate_withReason_delegatesToService() {
        ManagementContractDto dto = buildDto(10L);
        when(contractService.terminateContract(eq(10L), eq(1L), eq("breach"))).thenReturn(dto);

        assertEquals(dto, controller.terminate(10L, Map.of("reason", "breach")));
    }

    @Test
    void terminate_withoutReason_usesDefault() {
        ManagementContractDto dto = buildDto(10L);
        when(contractService.terminateContract(eq(10L), eq(1L), eq("Terminated by manager"))).thenReturn(dto);

        assertEquals(dto, controller.terminate(10L, Map.of()));
    }

    @Test
    void expireContracts_returnsCountMap() {
        when(contractService.expireContracts(1L)).thenReturn(5);

        Map<String, Integer> result = controller.expireContracts();

        assertEquals(5, result.get("expired"));
    }
}
