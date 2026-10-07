package com.clenzy.service;

import com.clenzy.model.*;
import jakarta.persistence.EntityManager;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.junit.jupiter.api.*;
import org.springframework.aop.framework.ProxyFactory;
import org.springframework.orm.jpa.JpaTransactionManager;
import org.springframework.orm.jpa.SharedEntityManagerCreator;
import org.springframework.transaction.annotation.AnnotationTransactionAttributeSource;
import org.springframework.transaction.interceptor.TransactionInterceptor;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Régression : les réponses restent lisibles après fermeture de la session Hibernate. */
class BaitlyExpenseViewsTest {
    SessionFactory factory;
    ProviderExpenseService service;
    EntityManager em;
    BaitlyExpenseViews views;
    TransactionTemplate tx;

    @BeforeEach void setup() {
        var xml = new StringBuilder("<entity-mappings xmlns=\"https://jakarta.ee/xml/ns/persistence/orm\" version=\"3.1\">");
        RefundCreditNotePersistenceTest.mapping(xml, User.class, Set.of("firstName", "lastName"));
        RefundCreditNotePersistenceTest.mapping(xml, Property.class, Set.of("name"));
        RefundCreditNotePersistenceTest.mapping(xml, ProviderExpense.class, Set.of("status", "description", "amountTtc"));
        xml.append("</entity-mappings>");
        var orm = xml.toString().replace("<transient name=\"provider\"/>", "<many-to-one name=\"provider\" fetch=\"LAZY\"/>")
                .replace("<transient name=\"property\"/>", "<many-to-one name=\"property\" fetch=\"LAZY\"/>");
        factory = new Configuration().addPackage("com.clenzy.model")
                .addInputStream(new ByteArrayInputStream(orm.getBytes(StandardCharsets.UTF_8)))
                .setProperty("hibernate.connection.url", "jdbc:h2:mem:expenseViews;MODE=PostgreSQL;NON_KEYWORDS=USER")
                .setProperty("hibernate.hbm2ddl.auto", "create-drop").setProperty("jakarta.persistence.validation.mode", "none")
                .buildSessionFactory();
        var manager = new JpaTransactionManager(factory);
        tx = new TransactionTemplate(manager);
        em = SharedEntityManagerCreator.createSharedEntityManager(factory);
        tx.execute(s -> {
            var user = new User(); user.setId(3L); user.setFirstName("Jean"); user.setLastName("Martin"); em.persist(user);
            var property = new Property(); property.setId(84L); property.setName("Logement test"); em.persist(property);
            var expense = new ProviderExpense(); expense.setId(1L); expense.setProvider(user); expense.setProperty(property);
            expense.setStatus(ExpenseStatus.DRAFT); em.persist(expense); return null;
        });
        service = mock(ProviderExpenseService.class);
        when(service.getVisible("admin", 2L, null, null, null, false)).thenAnswer(c -> List.of(em.find(ProviderExpense.class, 1L)));
        when(service.getReadable(1L, 2L, "admin")).thenAnswer(c -> em.find(ProviderExpense.class, 1L));
        var proxy = new ProxyFactory(new BaitlyExpenseViews(service));
        proxy.addAdvice(new TransactionInterceptor(manager, new AnnotationTransactionAttributeSource()));
        views = (BaitlyExpenseViews) proxy.getProxy();
    }
    @AfterEach void stop() { if (factory != null) factory.close(); }

    @Test void listAndDetailResolveLazyNamesWithinTheirTransaction() {
        var list = views.visible("admin", 2L, null, null, null, false);
        var detail = views.readable(1L, 2L, "admin");
        assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
        assertThat(list.getFirst().providerName()).isEqualTo("Jean Martin");
        assertThat(detail.propertyName()).isEqualTo("Logement test");
        verify(service).getVisible("admin", 2L, null, null, null, false);
        verify(service).getReadable(1L, 2L, "admin");
    }
    @Test void approvalCommitsAndItsResponseResolvesNamesBeforeSessionClosure() {
        when(service.approve(1L, 2L)).thenAnswer(c -> {
            assertThat(TransactionSynchronizationManager.isCurrentTransactionReadOnly()).isFalse();
            var expense = em.find(ProviderExpense.class, 1L); expense.setStatus(ExpenseStatus.APPROVED); return expense;
        });
        var response = views.approve(1L, 2L);
        assertThat(response.providerName()).isEqualTo("Jean Martin");
        assertThat(response.status()).isEqualTo(ExpenseStatus.APPROVED);
        ExpenseStatus persisted = tx.execute(s -> em.find(ProviderExpense.class, 1L).getStatus());
        assertThat(persisted).isEqualTo(ExpenseStatus.APPROVED);
    }
}
