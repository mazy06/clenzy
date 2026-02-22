package com.clenzy.service;

import com.clenzy.dto.HostBalanceSummaryDto;
import com.clenzy.dto.HostBalanceSummaryDto.PropertyBalanceDto;
import com.clenzy.dto.HostBalanceSummaryDto.UnpaidInterventionDto;
import com.clenzy.model.Intervention;
import com.clenzy.model.InterventionStatus;
import com.clenzy.model.PaymentStatus;
import com.clenzy.model.Property;
import com.clenzy.model.User;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Field;
import java.math.BigDecimal;
import java.time.LocalDateTime;
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
    void setUp() throws Exception {
        tenantContext = new TenantContext();
        tenantContext.setOrganizationId(ORG_ID);
        service = new DeferredPaymentService(interventionRepository, userRepository, tenantContext);

        setField(service, "stripeSecretKey", "sk_test_dummy");
        setField(service, "currency", "EUR");
        setField(service, "successUrl", "http://localhost:3000/payment/success");
        setField(service, "cancelUrl", "http://localhost:3000/payment/cancel");
    }

    private void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }

    private User buildHost(Long id, String firstName, String lastName, String email) {
        User host = new User();
        host.setId(id);
        host.setFirstName(firstName);
        host.setLastName(lastName);
        host.setEmail(email);
        return host;
    }

    private Intervention buildIntervention(Long id, String title, BigDecimal cost,
                                            Property property, PaymentStatus paymentStatus) {
        Intervention intervention = new Intervention();
        intervention.setId(id);
        intervention.setTitle(title);
        intervention.setEstimatedCost(cost);
        intervention.setProperty(property);
        intervention.setPaymentStatus(paymentStatus);
        intervention.setStartTime(LocalDateTime.of(2026, 2, 22, 10, 0));
        intervention.setStatus(InterventionStatus.COMPLETED);
        return intervention;
    }

    private Property buildProperty(Long id, String name) {
        Property property = new Property();
        property.setId(id);
        property.setName(name);
        return property;
    }

    // ===== GET HOST BALANCE =====

    @Nested
    @DisplayName("getHostBalance")
    class GetHostBalance {

        @Test
        @DisplayName("when host has unpaid interventions then returns grouped summary")
        void whenHostHasUnpaidInterventions_thenReturnsSummary() {
            // Arrange
            User host = buildHost(1L, "Jean", "Dupont", "jean@test.com");
            when(userRepository.findById(1L)).thenReturn(Optional.of(host));

            Property property = buildProperty(10L, "Appart Paris");
            Intervention i1 = buildIntervention(100L, "Menage", BigDecimal.valueOf(80), property, PaymentStatus.PENDING);
            Intervention i2 = buildIntervention(101L, "Reparation", BigDecimal.valueOf(55), property, PaymentStatus.PENDING);

            when(interventionRepository.findUnpaidByHostId(1L, ORG_ID)).thenReturn(List.of(i1, i2));
            when(interventionRepository.sumUnpaidByHostId(1L, ORG_ID)).thenReturn(BigDecimal.valueOf(135));

            // Act
            HostBalanceSummaryDto result = service.getHostBalance(1L);

            // Assert
            assertThat(result.getHostId()).isEqualTo(1L);
            assertThat(result.getTotalUnpaid()).isEqualByComparingTo("135");
            assertThat(result.getTotalInterventions()).isEqualTo(2);
            assertThat(result.getProperties()).hasSize(1);

            PropertyBalanceDto propertyBalance = result.getProperties().get(0);
            assertThat(propertyBalance.getPropertyId()).isEqualTo(10L);
            assertThat(propertyBalance.getPropertyName()).isEqualTo("Appart Paris");
            assertThat(propertyBalance.getInterventionCount()).isEqualTo(2);
            assertThat(propertyBalance.getUnpaidAmount()).isEqualByComparingTo("135");
            assertThat(propertyBalance.getInterventions()).hasSize(2);
        }

        @Test
        @DisplayName("when host has interventions across multiple properties then groups correctly")
        void whenMultipleProperties_thenGroupsCorrectly() {
            // Arrange
            User host = buildHost(1L, "Jean", "Dupont", "jean@test.com");
            when(userRepository.findById(1L)).thenReturn(Optional.of(host));

            Property prop1 = buildProperty(10L, "Appart Paris");
            Property prop2 = buildProperty(20L, "Maison Lyon");

            Intervention i1 = buildIntervention(100L, "Menage Paris", BigDecimal.valueOf(80), prop1, PaymentStatus.PENDING);
            Intervention i2 = buildIntervention(101L, "Menage Lyon", BigDecimal.valueOf(55), prop2, PaymentStatus.PENDING);

            when(interventionRepository.findUnpaidByHostId(1L, ORG_ID)).thenReturn(List.of(i1, i2));
            when(interventionRepository.sumUnpaidByHostId(1L, ORG_ID)).thenReturn(BigDecimal.valueOf(135));

            // Act
            HostBalanceSummaryDto result = service.getHostBalance(1L);

            // Assert
            assertThat(result.getProperties()).hasSize(2);
            assertThat(result.getProperties().get(0).getPropertyName()).isEqualTo("Appart Paris");
            assertThat(result.getProperties().get(1).getPropertyName()).isEqualTo("Maison Lyon");
        }

        @Test
        @DisplayName("when host not found then throws RuntimeException")
        void whenHostNotFound_thenThrows() {
            // Arrange
            when(userRepository.findById(99L)).thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> service.getHostBalance(99L))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Host non trouve");
        }

        @Test
        @DisplayName("when no unpaid interventions then returns empty properties")
        void whenNoUnpaidInterventions_thenReturnsEmptyProperties() {
            // Arrange
            User host = buildHost(1L, "Jean", "Dupont", "jean@test.com");
            when(userRepository.findById(1L)).thenReturn(Optional.of(host));
            when(interventionRepository.findUnpaidByHostId(1L, ORG_ID)).thenReturn(List.of());
            when(interventionRepository.sumUnpaidByHostId(1L, ORG_ID)).thenReturn(BigDecimal.ZERO);

            // Act
            HostBalanceSummaryDto result = service.getHostBalance(1L);

            // Assert
            assertThat(result.getProperties()).isEmpty();
            assertThat(result.getTotalInterventions()).isEqualTo(0);
            assertThat(result.getTotalUnpaid()).isEqualByComparingTo("0");
        }

        @Test
        @DisplayName("when intervention has null property then groups under property ID 0")
        void whenNullProperty_thenGroupsUnderZero() {
            // Arrange
            User host = buildHost(1L, "Jean", "Dupont", "jean@test.com");
            when(userRepository.findById(1L)).thenReturn(Optional.of(host));

            Intervention i1 = buildIntervention(100L, "Sans Propriete", BigDecimal.valueOf(50), null, PaymentStatus.PENDING);

            when(interventionRepository.findUnpaidByHostId(1L, ORG_ID)).thenReturn(List.of(i1));
            when(interventionRepository.sumUnpaidByHostId(1L, ORG_ID)).thenReturn(BigDecimal.valueOf(50));

            // Act
            HostBalanceSummaryDto result = service.getHostBalance(1L);

            // Assert
            assertThat(result.getProperties()).hasSize(1);
            assertThat(result.getProperties().get(0).getPropertyId()).isEqualTo(0L);
            assertThat(result.getProperties().get(0).getPropertyName()).isEqualTo("Propriete inconnue");
        }

        @Test
        @DisplayName("then sets host name and email from User entity")
        void thenSetsHostNameAndEmail() {
            // Arrange
            User host = buildHost(1L, "Marie", "Martin", "marie@test.com");
            when(userRepository.findById(1L)).thenReturn(Optional.of(host));
            when(interventionRepository.findUnpaidByHostId(1L, ORG_ID)).thenReturn(List.of());
            when(interventionRepository.sumUnpaidByHostId(1L, ORG_ID)).thenReturn(BigDecimal.ZERO);

            // Act
            HostBalanceSummaryDto result = service.getHostBalance(1L);

            // Assert
            assertThat(result.getHostName()).isNotNull();
            assertThat(result.getHostEmail()).isEqualTo("marie@test.com");
        }

        @Test
        @DisplayName("then intervention DTOs contain correct fields")
        void thenInterventionDtosContainCorrectFields() {
            // Arrange
            User host = buildHost(1L, "Jean", "Dupont", "jean@test.com");
            when(userRepository.findById(1L)).thenReturn(Optional.of(host));

            Property property = buildProperty(10L, "Appart");
            Intervention intervention = buildIntervention(100L, "Deep Clean",
                    BigDecimal.valueOf(120.50), property, PaymentStatus.PENDING);
            intervention.setStatus(InterventionStatus.COMPLETED);

            when(interventionRepository.findUnpaidByHostId(1L, ORG_ID)).thenReturn(List.of(intervention));
            when(interventionRepository.sumUnpaidByHostId(1L, ORG_ID)).thenReturn(BigDecimal.valueOf(120.50));

            // Act
            HostBalanceSummaryDto result = service.getHostBalance(1L);

            // Assert
            UnpaidInterventionDto dto = result.getProperties().get(0).getInterventions().get(0);
            assertThat(dto.getId()).isEqualTo(100L);
            assertThat(dto.getTitle()).isEqualTo("Deep Clean");
            assertThat(dto.getEstimatedCost()).isEqualByComparingTo("120.50");
            assertThat(dto.getStatus()).isEqualTo("COMPLETED");
            assertThat(dto.getPaymentStatus()).isEqualTo("PENDING");
        }
    }

    // ===== CREATE GROUPED PAYMENT SESSION =====

    @Nested
    @DisplayName("createGroupedPaymentSession")
    class CreateGroupedPaymentSession {

        @Test
        @DisplayName("when no unpaid interventions then throws RuntimeException")
        void whenNoUnpaidInterventions_thenThrows() {
            // Arrange
            User host = buildHost(1L, "Jean", "Dupont", "jean@test.com");
            when(userRepository.findById(1L)).thenReturn(Optional.of(host));
            when(interventionRepository.findUnpaidByHostId(1L, ORG_ID)).thenReturn(List.of());

            // Act & Assert
            assertThatThrownBy(() -> service.createGroupedPaymentSession(1L))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Aucune intervention impayee");
        }

        @Test
        @DisplayName("when host not found then throws RuntimeException")
        void whenHostNotFound_thenThrows() {
            // Arrange
            when(userRepository.findById(99L)).thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> service.createGroupedPaymentSession(99L))
                    .isInstanceOf(RuntimeException.class);
        }

        // Note: Testing the full Stripe flow is not possible in unit tests since
        // Session.create() calls the Stripe API directly. The validation and error
        // paths above cover the testable business logic. Full Stripe integration
        // would require an integration test with WireMock or similar.
    }
}
