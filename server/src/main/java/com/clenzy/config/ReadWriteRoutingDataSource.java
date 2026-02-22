package com.clenzy.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.datasource.lookup.AbstractRoutingDataSource;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * DataSource routing : dirige les @Transactional(readOnly = true) vers la REPLICA,
 * et toutes les autres transactions vers PRIMARY.
 *
 * Niveau 8 — Scalabilite : separation read/write.
 */
public class ReadWriteRoutingDataSource extends AbstractRoutingDataSource {

    private static final Logger log = LoggerFactory.getLogger(ReadWriteRoutingDataSource.class);

    @Override
    protected Object determineCurrentLookupKey() {
        boolean isReadOnly = TransactionSynchronizationManager.isCurrentTransactionReadOnly();
        DataSourceType type = isReadOnly ? DataSourceType.REPLICA : DataSourceType.PRIMARY;
        if (log.isTraceEnabled()) {
            log.trace("Routing to {} datasource (readOnly={})", type, isReadOnly);
        }
        return type;
    }
}
