package com.clenzy.service;

import com.clenzy.repository.UserRepository;
import com.clenzy.model.User;
import java.util.*;
import org.junit.jupiter.api.*;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;

class BaitlySupplierRegistrationTest {
    BaitlySupplierPurchaseService purchases;KeycloakService identities;UserRepository users;BaitlySupplierRegistration service;
    String operation=UUID.randomUUID().toString();
    @BeforeEach void setup(){purchases=mock(BaitlySupplierPurchaseService.class);identities=mock(KeycloakService.class);users=mock(UserRepository.class);service=new BaitlySupplierRegistration(purchases,identities,users);}
    @Test void retriesReuseTheRemoteIdentityAndNeverCreateALocalMembershipOrPassword() {
        when(purchases.registrationOperation("token","supplier@test.invalid")).thenReturn(operation);
        when(identities.createMarketplaceUser(any(),eq(operation))).thenReturn("subject");
        for(int n=0;n<2;n++)service.register("token"," SUPPLIER@test.invalid "," Jean "," Martin ");
        verify(identities,times(2)).createMarketplaceUser(argThat(u->"supplier@test.invalid".equals(u.getEmail()) && "HOST".equals(u.getRole()) && u.getPassword()==null && "Jean".equals(u.getFirstName())),eq(operation));
        verify(identities,times(2)).sendSupplierActivation("subject");verify(users,never()).save(any());
    }
    @Test void invalidInvitationCannotCreateAnIdentityOrSendActivation() {
        when(purchases.registrationOperation(any(),any())).thenThrow(new IllegalArgumentException("Invitation invalide"));
        assertThatThrownBy(()->service.register("bad","supplier@test.invalid","Jean","Martin")).hasMessageContaining("invalide");
        verifyNoInteractions(identities,users);
    }
    @Test void existingAccountRequiresLoginWithoutChangingRolesOrResettingPassword() {
        when(purchases.registrationOperation("token","supplier@test.invalid")).thenReturn(operation);
        when(users.findByEmailHash(any())).thenReturn(Optional.of(new User()));
        assertThatThrownBy(()->service.register("token","supplier@test.invalid","Jean","Martin"))
            .isInstanceOf(org.springframework.web.server.ResponseStatusException.class).hasMessageContaining("Connectez-vous");
        verifyNoInteractions(identities);
    }
    @Test void lostEmailResponseCanRetryTheSameProvisioningOperation() {
        when(purchases.registrationOperation("token","supplier@test.invalid")).thenReturn(operation);
        when(identities.createMarketplaceUser(any(),eq(operation))).thenReturn("subject");
        doThrow(new com.clenzy.exception.KeycloakOperationException("timeout")).doNothing().when(identities).sendSupplierActivation("subject");
        assertThatThrownBy(()->service.register("token","supplier@test.invalid","Jean","Martin")).hasMessageContaining("timeout");
        service.register("token","supplier@test.invalid","Jean","Martin");
        verify(identities,times(2)).createMarketplaceUser(any(),eq(operation));verify(users,never()).save(any());
    }
}
