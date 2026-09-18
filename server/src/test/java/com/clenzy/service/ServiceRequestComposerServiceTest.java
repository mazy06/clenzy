package com.clenzy.service;

import com.clenzy.dto.ServiceRequestDto;
import com.clenzy.model.*;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.catalog.ServiceCatalogReference;
import com.clenzy.service.pricing.CleaningPricingEngine;
import com.clenzy.service.ServiceRequestComposerService.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.access.AccessDeniedException;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class ServiceRequestComposerServiceTest {
    ServiceCatalogReference catalog = mock(ServiceCatalogReference.class);
    PropertyService properties = mock(PropertyService.class);
    CleaningPricingEngine cleaning = mock(CleaningPricingEngine.class);
    ServiceRequestService requests = mock(ServiceRequestService.class);
    UserRepository users = mock(UserRepository.class);
    ServiceRequestComposerService service = new ServiceRequestComposerService(catalog, properties, cleaning, requests, users);
    UUID submission = UUID.randomUUID();
    LocalDateTime date = LocalDateTime.of(2026, 10, 20, 10, 0);
    Property property = new Property();

    ServiceCatalogReference.Item item(String code, String type, boolean requiresProperty) {
        return new ServiceCatalogReference.Item(code, code, code, type, requiresProperty ? "ON_SITE" : "REMOTE",
                requiresProperty, requiresProperty, "trade", "category", "OWNER");
    }
    Draft draft(Long propertyId, Selection... selections) {
        return new Draft(submission, propertyId, date, Priority.NORMAL, "Accès cour", List.of(selections));
    }
    Selection select(String code) { return new Selection(code, "Consigne " + code, null); }

    @BeforeEach void setup() {
        when(catalog.items()).thenReturn(List.of(item("cleaning", "CLEANING", true),
                item("plumbing", "PLUMBING_REPAIR", true), item("books", "OTHER", false)));
        property.setId(8L); property.setName("Loft"); property.setDefaultCurrency("EUR");
        when(properties.getSecuredPropertyEntity(8L)).thenReturn(property);
        var user = new User(); user.setId(42L);
        when(users.findByKeycloakId("subject")).thenReturn(Optional.of(user));
        when(cleaning.quote(eq(property), eq("CLEANING"), any())).thenReturn(
                new CleaningPricingEngine.CleaningQuote(90, new BigDecimal("60"), new BigDecimal("50"), new BigDecimal("70")));
    }
    @Test void onlySupportedServicesUseTheExistingEngine() {
        var result = service.estimate(draft(8L, select("cleaning"), select("plumbing")));
        assertThat(result.getFirst().source()).isEqualTo("PLATFORM_GUIDE");
        assertThat(result.getFirst().min()).isEqualByComparingTo("50");
        assertThat(result.getFirst().durationMinutes()).isEqualTo(90);
        assertThat(result.get(1).source()).isEqualTo("ON_QUOTE");
        assertThat(result.get(1).min()).isNull();
        verify(cleaning).quote(property, "CLEANING", date.toLocalDate());
        verifyNoMoreInteractions(cleaning);
        verifyNoInteractions(requests);
    }
    @Test void oneCanonicalRequestPerSelectionWithoutCopyingAnIndicativePrice() {
        service.create(draft(8L, select("cleaning"), new Selection("plumbing", "Robinet", 3)), "subject");
        var argument = ArgumentCaptor.forClass(ServiceRequestDto.class);
        verify(requests, times(2)).createComposedRequest(argument.capture(), eq(submission));
        var first = argument.getAllValues().getFirst();
        assertThat(first.serviceItemCode).isEqualTo("cleaning");
        assertThat(first.estimatedDurationHours).isEqualTo(2);
        assertThat(first.estimatedCost).isNull();
        assertThat(first.userId).isEqualTo(42);
        assertThat(first.propertyId).isEqualTo(8);
        assertThat(first.description).isEqualTo("Accès cour\n\nConsigne cleaning");
        assertThat(first.status).isEqualTo(RequestStatus.PENDING);
        var second = argument.getAllValues().get(1);
        assertThat(second.serviceItemCode).isEqualTo("plumbing");
        assertThat(second.serviceType).isEqualTo(ServiceType.PLUMBING_REPAIR);
        assertThat(second.estimatedDurationHours).isEqualTo(3);
        assertThat(second.assignedToId).isNull();
    }
    @Test void allSelectionsAreValidatedBeforeAnyCreation() {
        assertThatThrownBy(() -> service.create(draft(8L, select("cleaning"), select("unknown")), "subject"))
                .isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(requests);
    }
    @Test void rejectsDuplicateServices() {
        assertThatThrownBy(() -> service.create(draft(8L, select("cleaning"), select("cleaning")), "subject"))
                .isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(requests);
    }
    @Test void noCrossOrganizationPropertyAccess() {
        when(properties.getSecuredPropertyEntity(99L)).thenThrow(new AccessDeniedException("outside organization"));
        assertThatThrownBy(() -> service.estimate(draft(99L, select("cleaning")))).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> service.create(draft(99L, select("cleaning")), "subject")).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(requests, cleaning);
    }
    @Test void remoteServiceNeedsNeitherPropertyNorInventedCleaningPrice() {
        var result = service.estimate(draft(null, select("books")));
        assertThat(result.getFirst().min()).isNull();
        service.create(draft(null, select("books")), "subject");
        var arg = ArgumentCaptor.forClass(ServiceRequestDto.class);
        verify(requests).createComposedRequest(arg.capture(), eq(submission));
        assertThat(arg.getValue().propertyId).isNull();
        verifyNoInteractions(cleaning, properties);
    }
    @Test void onSiteServiceRequiresProperty() {
        assertThatThrownBy(() -> service.create(draft(null, select("cleaning")), "subject"))
                .isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(requests);
    }
    @Test void rejectsMissingDateAndUnknownUserBeforeWriting() {
        assertThatThrownBy(() -> service.create(new Draft(submission, 8L, null, Priority.NORMAL, "", List.of(select("cleaning"))), "subject"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.create(draft(8L, select("cleaning")), "unknown"))
                .isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(requests);
    }
    @Test void rejectsNonPositiveDurationAndOversizedBatch() {
        assertThatThrownBy(() -> service.create(draft(8L, new Selection("cleaning", "", 0)), "subject"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.create(new Draft(submission, 8L, date, Priority.NORMAL, "",
                Collections.nCopies(21, select("cleaning"))), "subject")).isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(requests);
    }

    @Test void aFailureRollsBackEarlierRequestsInTheSameBatch() {
        var source = new org.springframework.jdbc.datasource.DriverManagerDataSource(
                "jdbc:h2:mem:composer_" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1", "sa", "");
        var db = new org.springframework.jdbc.core.JdbcTemplate(source);
        db.execute("CREATE TABLE created_requests(service_code varchar(60))");
        when(requests.createComposedRequest(any(), any())).thenAnswer(invocation -> {
            ServiceRequestDto dto = invocation.getArgument(0);
            db.update("INSERT INTO created_requests VALUES (?)", dto.serviceItemCode);
            if (dto.serviceItemCode.equals("plumbing")) throw new IllegalStateException("creation failed");
            return dto;
        });
        var proxyFactory = new org.springframework.aop.framework.ProxyFactory(service);
        proxyFactory.setProxyTargetClass(true);
        proxyFactory.addAdvice(new org.springframework.transaction.interceptor.TransactionInterceptor(
                new org.springframework.jdbc.datasource.DataSourceTransactionManager(source),
                new org.springframework.transaction.annotation.AnnotationTransactionAttributeSource()));
        var transactional = (ServiceRequestComposerService) proxyFactory.getProxy();
        assertThatThrownBy(() -> transactional.create(draft(8L, select("cleaning"), select("plumbing")), "subject"))
                .isInstanceOf(IllegalStateException.class);
        assertThat(db.queryForObject("SELECT count(*) FROM created_requests", Integer.class)).isZero();
        db.execute("SHUTDOWN");
    }
}
