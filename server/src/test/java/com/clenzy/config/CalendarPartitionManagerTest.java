package com.clenzy.config;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CalendarPartitionManagerTest {

    @Mock private JdbcTemplate jdbcTemplate;

    @InjectMocks
    private CalendarPartitionManager manager;

    @Test
    void createFuturePartitions_allPartitionsAlreadyExist_executesNothing() {
        when(jdbcTemplate.queryForObject(anyString(), eq(Boolean.class), any(Object[].class)))
            .thenReturn(Boolean.TRUE);

        manager.createFuturePartitions();

        // 6 checks via queryForObject, no execute since all exist
        verify(jdbcTemplate, times(6))
            .queryForObject(anyString(), eq(Boolean.class), any(Object[].class));
        verify(jdbcTemplate, never()).execute(anyString());
    }

    @Test
    void createFuturePartitions_partitionMissing_createsViaExecute() {
        when(jdbcTemplate.queryForObject(anyString(), eq(Boolean.class), any(Object[].class)))
            .thenReturn(Boolean.FALSE);

        manager.createFuturePartitions();

        // 6 future months → 6 creates
        verify(jdbcTemplate, times(6)).execute(anyString());

        ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
        verify(jdbcTemplate, times(6)).execute(sqlCaptor.capture());
        for (String sql : sqlCaptor.getAllValues()) {
            assertTrue(sql.startsWith("CREATE TABLE calendar_days_"));
            assertTrue(sql.contains("PARTITION OF calendar_days FOR VALUES FROM"));
        }
    }

    @Test
    void createFuturePartitions_nullExistsResult_treatedAsCreate() {
        when(jdbcTemplate.queryForObject(anyString(), eq(Boolean.class), any(Object[].class)))
            .thenReturn(null);

        manager.createFuturePartitions();

        verify(jdbcTemplate, times(6)).execute(anyString());
    }

    @Test
    void createFuturePartitions_executeFails_continuesWithNextMonth() {
        when(jdbcTemplate.queryForObject(anyString(), eq(Boolean.class), any(Object[].class)))
            .thenReturn(Boolean.FALSE);
        doThrow(new RuntimeException("permission denied"))
            .when(jdbcTemplate).execute(anyString());

        // Should not propagate exception
        assertDoesNotThrow(() -> manager.createFuturePartitions());

        // 6 attempts even though all fail
        verify(jdbcTemplate, times(6)).execute(anyString());
    }

    @Test
    void createFuturePartitions_queryFails_swallowedPerIteration() {
        when(jdbcTemplate.queryForObject(anyString(), eq(Boolean.class), any(Object[].class)))
            .thenThrow(new RuntimeException("DB down"));

        assertDoesNotThrow(() -> manager.createFuturePartitions());

        verify(jdbcTemplate, never()).execute(anyString());
    }
}
