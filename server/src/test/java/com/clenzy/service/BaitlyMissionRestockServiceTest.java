package com.clenzy.service;
import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.oauth2.jwt.Jwt;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;

@ExtendWith(MockitoExtension.class)
class BaitlyMissionRestockServiceTest {
    @Mock InterventionRepository missions; @Mock InterventionAccessPolicy access; @Mock PropertyStockItemRepository stocks;
    @Mock BaitlyRestockLedgerRepository ledger; @Mock ProviderExpenseRepository expenses; @Mock UserService users;
    BaitlyMissionRestockService service; PropertyStockItem item; Intervention mission; BaitlyRestockLedger saved;
    UUID key=UUID.randomUUID(); Jwt jwt=Jwt.withTokenValue("test").header("alg","none").subject("provider").build();
    @BeforeEach void setup() {
        service=new BaitlyMissionRestockService(missions,access,stocks,ledger,expenses,users,new ObjectMapper().findAndRegisterModules(),Clock.fixed(Instant.parse("2026-10-13T08:00:00Z"),ZoneOffset.UTC));
        var property=new Property();property.setId(10L);property.setOrganizationId(1L);property.setDefaultCurrency("MAD");
        mission=new Intervention();mission.setId(5L);mission.setOrganizationId(1L);mission.setProperty(property);mission.setStatus(InterventionStatus.IN_PROGRESS);
        item=new PropertyStockItem();item.setId(20L);item.setPropertyId(10L);item.setOrganizationId(1L);item.setName("Savon");item.setQuantity(3);
        when(missions.findById(5L)).thenReturn(Optional.of(mission));when(missions.findForReview(5L,1L)).thenReturn(Optional.of(mission));
        when(ledger.findByRequestKey(key.toString())).thenAnswer(call -> Optional.ofNullable(saved));
    }
    private void writable() {
        var provider=new User();provider.setId(30L);when(users.findByKeycloakId("provider")).thenReturn(provider);
        when(stocks.lockForRestock(20L,1L)).thenReturn(Optional.of(item));
    }
    @Test void recordsQuantitiesCreatesDraftExpenseAndNeverDoubleBillsOnRetry() {
        writable();when(expenses.save(any())).thenAnswer(call -> { ProviderExpense value=call.getArgument(0);value.setId(88L);return value; });
        when(ledger.save(any())).thenAnswer(call -> saved=call.getArgument(0));
        var request=new BaitlyMissionRestockService.Request(key,List.of(new BaitlyMissionRestockService.Line(20L,3,2,4,new BigDecimal("2.50"))));
        var receipt=service.record(5L,request,jwt); var replay=service.record(5L,request,jwt);
        assertThat(item.getQuantity()).isEqualTo(6);assertThat(receipt.entries().getFirst().before()).isEqualTo(3);
        assertThat(receipt.entries().getFirst().observed()).isEqualTo(2);assertThat(receipt.entries().getFirst().amount()).isEqualByComparingTo("10.00");
        assertThat(replay).isEqualTo(receipt);verify(expenses,times(1)).save(argThat(value -> value.getStatus()==ExpenseStatus.DRAFT && value.getIntervention()==mission && value.getCurrency().equals("MAD")));
        verify(access,times(4)).requireAssignee(mission,jwt);verify(ledger,times(1)).save(any());
    }
    @Test void rejectsAConcurrentStockChangeBeforeCreatingAnExpense() {
        writable();
        var request=new BaitlyMissionRestockService.Request(key,List.of(new BaitlyMissionRestockService.Line(20L,2,2,4,new BigDecimal("2.50"))));
        assertThatThrownBy(() -> service.record(5L,request,jwt)).hasMessageContaining("stock a changé");
        verifyNoInteractions(expenses);verify(ledger,never()).save(any());assertThat(item.getQuantity()).isEqualTo(3);
    }
    @Test void cannotRestockItemsBelongingToAnotherProperty() {
        writable();item.setPropertyId(11L);
        var request=new BaitlyMissionRestockService.Request(key,List.of(new BaitlyMissionRestockService.Line(20L,3,3,1,BigDecimal.ONE)));
        assertThatThrownBy(() -> service.record(5L,request,jwt)).isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        verifyNoInteractions(expenses);verify(ledger,never()).save(any());
    }
}
