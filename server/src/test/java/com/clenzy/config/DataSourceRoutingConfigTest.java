package com.clenzy.config;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.datasource.LazyConnectionDataSourceProxy;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import javax.sql.DataSource;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests for {@link DataSourceRoutingConfig} and {@link ReadWriteRoutingDataSource}.
 *
 * <p>Z1-BUGS-05 : le routing key est lu depuis le TransactionSynchronizationManager,
 * dont le flag readOnly n'est pose qu'APRES doBegin. Le bean @Primary doit donc
 * etre un {@link LazyConnectionDataSourceProxy} qui differe l'acquisition de la
 * connexion physique au premier statement.</p>
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("DataSourceRoutingConfig / ReadWriteRoutingDataSource")
class DataSourceRoutingConfigTest {

    @Mock private DataSource primaryDataSource;
    @Mock private DataSource replicaDataSource;

    private final DataSourceRoutingConfig config = new DataSourceRoutingConfig();

    @AfterEach
    void tearDown() {
        TransactionSynchronizationManager.setCurrentTransactionReadOnly(false);
    }

    @Nested
    @DisplayName("ReadWriteRoutingDataSource — lookup key")
    class RoutingLookup {

        @Test
        void whenTransactionReadOnly_thenRoutesToReplica() {
            ReadWriteRoutingDataSource routing = new ReadWriteRoutingDataSource();
            TransactionSynchronizationManager.setCurrentTransactionReadOnly(true);

            Object key = routing.determineCurrentLookupKey();

            assertThat(key).isEqualTo(DataSourceType.REPLICA);
        }

        @Test
        void whenTransactionNotReadOnly_thenRoutesToPrimary() {
            ReadWriteRoutingDataSource routing = new ReadWriteRoutingDataSource();

            Object key = routing.determineCurrentLookupKey();

            assertThat(key).isEqualTo(DataSourceType.PRIMARY);
        }
    }

    @Nested
    @DisplayName("Beans — proxy lazy @Primary devant le routing")
    class BeanWiring {

        @Test
        void whenPrimaryDataSourceBeanBuilt_thenWrapsRoutingInLazyProxy() {
            DataSource routing = config.routingDataSource(primaryDataSource, replicaDataSource);

            DataSource primaryBean = config.dataSource(routing);

            assertThat(primaryBean).isInstanceOf(LazyConnectionDataSourceProxy.class);
            assertThat(((LazyConnectionDataSourceProxy) primaryBean).getTargetDataSource())
                    .isSameAs(routing);
        }

        @Test
        void whenRoutingDataSourceBuilt_thenIsReadWriteRouting() {
            DataSource routing = config.routingDataSource(primaryDataSource, replicaDataSource);

            assertThat(routing).isInstanceOf(ReadWriteRoutingDataSource.class);
        }
    }
}
