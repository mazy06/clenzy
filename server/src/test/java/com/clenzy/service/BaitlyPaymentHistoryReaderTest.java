package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.BaitlyPaymentHistoryRepository;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.Test;
import java.time.LocalDate;
import java.util.List;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;

class BaitlyPaymentHistoryReaderTest {
    final BaitlyPaymentHistoryRepository repository=mock(BaitlyPaymentHistoryRepository.class);
    final PaymentQueryService payments=mock(PaymentQueryService.class);
    final TenantContext tenant=mock(TenantContext.class);
    final BaitlyPaymentHistoryReader reader=new BaitlyPaymentHistoryReader(repository,payments,tenant);
    BaitlyPaymentHistoryReaderTest(){when(tenant.getRequiredOrganizationId()).thenReturn(7L);when(repository.prepare(any())).thenAnswer(call->call.getArgument(0));}
    User user(UserRole role){var user=new User();user.setId(42L);user.setRole(role);return user;}
    @Test void hostCannotBroadenItsScopeAndOnlyPageKeysAreHydrated() {
        var expected=new BaitlyPaymentHistoryRepository.Filter(7,42L,"PAID",null,null,"maison");
        var keys=List.of(new BaitlyPaymentHistoryRepository.Key("INTERVENTION",99));
        when(repository.count(expected)).thenReturn(10051L);when(repository.page(expected,1000,10)).thenReturn(keys);
        when(payments.hydrateBaitlyPaymentPage(keys)).thenReturn(List.of());
        var page=reader.page(user(UserRole.HOST),43L,PaymentStatus.PAID,null,null,"maison",1000,10,true);
        assertThat(page).containsEntry("totalElements",10051L).containsEntry("totalPages",1006L);
        verify(payments).hydrateBaitlyPaymentPage(keys);verify(repository).amounts(expected);
        verify(repository,never()).page(argThat(f->f.hostId()==null || f.hostId()==43),anyInt(),anyInt());
    }
    @Test void explicitBatchPagesDoNotRecalculateAmounts() {
        var filter=new BaitlyPaymentHistoryRepository.Filter(7,43L,null,null,null,null);
        when(repository.page(filter,0,500)).thenReturn(List.of());
        assertThat(reader.page(user(UserRole.SUPER_ADMIN),43L,null,null,null,null,0,500,false)).doesNotContainKey("amountGroups");
        verify(repository,never()).amounts(any());
    }
    @Test void rejectsInvalidPaginationOrDateIntervalsBeforeAnyDatabaseRead() {
        for (int size:List.of(0,-1,501,Integer.MAX_VALUE)) {
            assertThatIllegalArgumentException().isThrownBy(()->reader.page(user(UserRole.HOST),null,null,null,null,null,0,size,true));
        }
        assertThatIllegalArgumentException().isThrownBy(()->reader.page(user(UserRole.HOST),null,null,null,null,null,-1,10,true));
        assertThatIllegalArgumentException().isThrownBy(()->reader.page(user(UserRole.HOST),null,null,LocalDate.of(2026,10,11),LocalDate.of(2026,10,10),null,0,10,true));
        verifyNoInteractions(repository,payments,tenant);
    }
}
