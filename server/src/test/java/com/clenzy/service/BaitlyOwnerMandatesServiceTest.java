package com.clenzy.service;

import com.clenzy.model.ContractSignatureRequest;
import com.clenzy.model.ManagementContract;
import com.clenzy.model.User;
import com.clenzy.repository.ContractSignatureRequestRepository;
import com.clenzy.repository.ManagementContractRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BaitlyOwnerMandatesServiceTest {
    @Mock UserRepository users;
    @Mock ManagementContractRepository contracts;
    @Mock ContractSignatureRequestRepository signatures;
    private final TenantContext tenant = new TenantContext();
    private BaitlyOwnerMandatesService service() { return new BaitlyOwnerMandatesService(users, contracts, signatures, tenant); }
    @AfterEach void cleanup() { tenant.clear(); }

    @Test void refusesMissingTenantBeforeReadingContracts() {
        assertThrows(AccessDeniedException.class, () -> service().list("owner"));
        verifyNoInteractions(users, contracts, signatures);
    }
    @Test void refusesAnUnknownIdentity() {
        tenant.setOrganizationId(7L);
        when(users.findByKeycloakId("unknown")).thenReturn(Optional.empty());
        assertThrows(AccessDeniedException.class, () -> service().list("unknown"));
        verifyNoInteractions(contracts, signatures);
    }
    private void owner() {
        tenant.setOrganizationId(7L);
        User user = new User(); user.setId(10L);
        when(users.findByKeycloakId("owner")).thenReturn(Optional.of(user));
    }
    private ManagementContract contract(long id, long owner, long org) {
        var c = new ManagementContract(); c.setId(id); c.setOwnerId(owner); c.setOrganizationId(org);
        c.setContractNumber("MC-" + id); c.setPropertyId(100L);
        return c;
    }
    private ContractSignatureRequest signature(long id, long org, long contract) {
        var s = new ContractSignatureRequest(); s.setId(id); s.setOrganizationId(org); s.setContractId(contract);
        s.setExpiresAt(LocalDateTime.now().plusDays(3)); return s;
    }
    @Test void onlyReturnsOwnedContractsAndNeverLeaksAForeignSignatureToken() {
        owner();
        when(contracts.findByOwnerId(10L, 7L)).thenReturn(List.of(contract(1,10,7), contract(2,20,7), contract(3,10,8)));
        when(signatures.findByContractIdIn(List.of(1L,2L,3L))).thenReturn(List.of(signature(5,8,1)));
        var result = service().list("owner");
        assertEquals(1, result.size()); assertEquals(1L, result.getFirst().id());
        assertNull(result.getFirst().signatureToken());
    }
    @Test void exposesOnlyTheLatestRequestAndItsExpiration() {
        owner(); var old = signature(4,7,1); var latest = signature(5,7,1);
        latest.setExpiresAt(LocalDateTime.now().minusDays(1));
        when(contracts.findByOwnerId(10L,7L)).thenReturn(List.of(contract(1,10,7)));
        when(signatures.findByContractIdIn(List.of(1L))).thenReturn(List.of(latest,old));
        var result = service().list("owner").getFirst();
        assertEquals(latest.getToken(), result.signatureToken()); assertEquals("EXPIRED",result.signatureStatus());
    }
    @Test void anEmptyPortfolioDoesNotReadAnySignatureTokens() {
        owner(); when(contracts.findByOwnerId(10L,7L)).thenReturn(List.of());
        assertTrue(service().list("owner").isEmpty()); verifyNoInteractions(signatures);
    }
}
