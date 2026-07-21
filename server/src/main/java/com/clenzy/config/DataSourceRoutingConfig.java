package com.clenzy.config;

import com.zaxxer.hikari.HikariDataSource;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.jdbc.DataSourceProperties;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.datasource.LazyConnectionDataSourceProxy;

import javax.sql.DataSource;
import java.sql.Connection;
import java.util.HashMap;
import java.util.Map;

/**
 * Configuration DataSource dual : PRIMARY (ecriture) + REPLICA (lecture).
 * Active uniquement en profil prod — en dev, Spring Boot auto-configure un seul datasource.
 *
 * Si SPRING_DATASOURCE_REPLICA_URL n'est pas defini, les deux pointent
 * vers la meme base (fallback gracieux).
 *
 * <p><b>LazyConnectionDataSourceProxy obligatoire (Z1-BUGS-05)</b> : avec
 * JpaTransactionManager, la connexion JDBC d'une transaction est acquise pendant
 * {@code doBegin} (pour {@code Connection.setReadOnly}), AVANT que le flag
 * readOnly soit publie dans le TransactionSynchronizationManager par
 * {@code prepareSynchronization}. Sans le proxy lazy, le lookup de
 * {@link ReadWriteRoutingDataSource} voyait donc toujours {@code readOnly=false}
 * et TOUTES les transactions partaient sur PRIMARY (replica jamais utilisee).
 * Le proxy differe l'acquisition de la connexion physique au premier statement,
 * une fois le flag readOnly pose : le routage devient effectif.</p>
 *
 * Niveau 8 — Scalabilite : read replica routing.
 */
@Configuration
@Profile("prod")
public class DataSourceRoutingConfig {

    @Bean
    @ConfigurationProperties("spring.datasource.primary")
    public DataSourceProperties primaryDataSourceProperties() {
        return new DataSourceProperties();
    }

    @Bean
    @ConfigurationProperties("spring.datasource.replica")
    public DataSourceProperties replicaDataSourceProperties() {
        return new DataSourceProperties();
    }

    /**
     * Le type {@link HikariDataSource} + {@code @ConfigurationProperties} sur le bean
     * permettent de binder le bloc {@code spring.datasource.primary.hikari.*}
     * (pool-size, timeouts, leak-detection, reWriteBatchedInserts). Sans cela,
     * {@code DataSourceProperties} ne binde que url/username/password et le pool
     * tourne avec les defauts Hikari (max 10, timeout 30 s).
     */
    @Bean("primaryDataSource")
    @ConfigurationProperties("spring.datasource.primary.hikari")
    public HikariDataSource primaryDataSource() {
        return primaryDataSourceProperties()
                .initializeDataSourceBuilder()
                .type(HikariDataSource.class)
                .build();
    }

    @Bean("replicaDataSource")
    @ConfigurationProperties("spring.datasource.replica.hikari")
    public HikariDataSource replicaDataSource() {
        return replicaDataSourceProperties()
                .initializeDataSourceBuilder()
                .type(HikariDataSource.class)
                .build();
    }

    @Bean("routingDataSource")
    public DataSource routingDataSource(
            @Qualifier("primaryDataSource") DataSource primaryDataSource,
            @Qualifier("replicaDataSource") DataSource replicaDataSource) {

        ReadWriteRoutingDataSource routingDataSource = new ReadWriteRoutingDataSource();

        Map<Object, Object> dataSourceMap = new HashMap<>();
        dataSourceMap.put(DataSourceType.PRIMARY, primaryDataSource);
        dataSourceMap.put(DataSourceType.REPLICA, replicaDataSource);

        routingDataSource.setTargetDataSources(dataSourceMap);
        routingDataSource.setDefaultTargetDataSource(primaryDataSource);

        return routingDataSource;
    }

    /**
     * DataSource expose a JPA/Liquibase : proxy lazy devant le routing datasource,
     * pour que le choix PRIMARY/REPLICA se fasse au premier statement (flag
     * readOnly deja pose) et non a l'ouverture de la transaction.
     *
     * <p>Les defauts auto-commit / isolation sont fixes explicitement
     * (defauts Hikari + PostgreSQL) : sans eux, le proxy ouvrirait une connexion
     * eager des sa construction pour les decouvrir — exactement ce que le proxy
     * lazy doit eviter sur un routing datasource.</p>
     */
    @Bean
    @Primary
    public DataSource dataSource(@Qualifier("routingDataSource") DataSource routingDataSource) {
        LazyConnectionDataSourceProxy proxy = new LazyConnectionDataSourceProxy();
        proxy.setTargetDataSource(routingDataSource);
        proxy.setDefaultAutoCommit(true);
        proxy.setDefaultTransactionIsolation(Connection.TRANSACTION_READ_COMMITTED);
        return proxy;
    }
}
