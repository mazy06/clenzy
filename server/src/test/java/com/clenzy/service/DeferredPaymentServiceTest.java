package com.clenzy.service;

import com.clenzy.dto.HostBalanceSummaryDto;
import com.clenzy.model.Intervention;
import com.clenzy.model.InterventionStatus;
import com.clenzy.model.PaymentStatus;
import com.clenzy.model.Property;
import com.clenzy.model.User;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeferredPaymentServiceTest {

    @Mock private InterventionRepository interventionRepository;
    @Mock private UserRepository userRepository;

    private TenantContext tenantContext;
    private DeferredPaymentService service;
    private static final Long ORG_ID = 1L;

    @BeforeEach
    void setUp() {
        tenantContext = new TenantContext();
        tenantContext.setOrganizationId(ORG_ID);
        service = new DeferredPaymentService(interventionRepository, userRepository, tenantContext);
    }

    // ===== GET HOST BALANCE =====

    @Nested
    class GetHostBalance {

        @Test
        void whenHostHasUnpaidInterventions_thenReturnsSummary() {
            User host = new User();
            host.setId(1L);
            host.setFirstName("Jean");
            host.setLastName("Dupont");
            host.setEmail("jean@test.com");
            when(userRepository.findById(1L)).thenReturn(Optional.of(host));

            Property property = new Property();
            property.setId(10L);
            property.setName("Appart Paris");

            Intervention i1 = new Intervention();
            i1.setId(100L);
            i1.setTitle("Menage");
            i1.setEstimatedCost(BigDecimal.valueOf(80));
            i1.setProperty(property);
            i1.setPaymentStatus(PaymentStatus.PENDING);

            when(interventionRepository.findUnpaidByHostId(1L, ORG_ID)).thenReturn(List.of(i1));
            when(interventionRepository.sumUnpaidByHostId(1L, ORG_ID)).thenReturn(BigDecimal.valueOf(80));

            HostBalanceSummaryDto result = service.getHostBalance(1L);

            assertThat(result.getHostId()).isEqualTo(1L);
            assertThat(result.getTotalUnpaid()).isEqualByComparingTo("80");
            assertThat(result.getTotalInterventions()).isEqualTo(1);
            assertThat(result.getProperties()).hasSize(1);
        }

        @Test
        void whenHostNotFound_thenThrows() {
            when(userRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.getHostBalance(99L))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Host non trouve");
        }

        @Test
        void whenNoUnpaidInterventions_thenReturnsEmptyProperties() {
            User host = new User();
            host.setId(1L);
            host.setFirstName("Jean");
            host.setLastName("Dupont");
            when(userRepository.findById(1L)).thenReturn(Optional.of(host));
            when(interventionRepository.findUnpaidByHostId(1L, ORG_ID)).thenReturn(List.of());
            when(interventionRepository.sumUnpaidByHostId(1L, ORG_ID)).thenReturn(BigDecimal.ZERO);

            HostBalanceSummaryDto result = service.getHostBalance(1L);

            assertThat(result.getProperties()).isEmpty();
            assertThat(result.getTotalInterventions()).isEqualTo(0);
        }
    }

    // ===== CREATE GROUPED PAYMENT SESSION =====

    @Nested
    class CreateGroupedPaymentSession {

        @Test
        void whenNoUnpaidInterventions_thenThrows() {
            User host = new User();
            host.setId(1L);
            when(userRepository.findById(1L)).thenReturn(Optional.of(host));
            when(interventionRepository.findUnpaidByHostId(1L, ORG_ID)).thenReturn(List.of());

            assertThatThrownBy(() -> service.createGroupedPaymentSession(1L))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Aucune intervention impayee");
        }

        @Test
        void whenHostNotFound_thenThrows() {
            when(userRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.createGroupedPaymentSession(99L))
                    .isInstanceOf(RuntimeException.class);
        }
    }
}
