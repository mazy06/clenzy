package com.clenzy.controller;

import com.clenzy.dto.BackupInfoDto;
import com.clenzy.service.DatabaseAdminService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DatabaseAdminControllerTest {

    @Mock private DatabaseAdminService databaseAdminService;

    private DatabaseAdminController controller;

    @BeforeEach
    void setUp() {
        controller = new DatabaseAdminController(databaseAdminService);
    }

    @Test
    void listBackups_success_returnsList() throws Exception {
        BackupInfoDto info = new BackupInfoDto("backup1.sql.gz", 1024L, Instant.now());
        when(databaseAdminService.listBackups()).thenReturn(List.of(info));

        ResponseEntity<?> resp = controller.listBackups();

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        @SuppressWarnings("unchecked")
        List<BackupInfoDto> body = (List<BackupInfoDto>) resp.getBody();
        assertThat(body).hasSize(1);
    }

    @Test
    void listBackups_error_returns500() throws Exception {
        when(databaseAdminService.listBackups()).thenThrow(new IOException("disk full"));

        ResponseEntity<?> resp = controller.listBackups();

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        @SuppressWarnings("unchecked")
        Map<String, String> body = (Map<String, String>) resp.getBody();
        assertThat(body.get("error")).contains("disk full");
    }

    @Test
    void createBackup_success_returnsOk() throws Exception {
        BackupInfoDto info = new BackupInfoDto("backup2.sql.gz", 2048L, Instant.now());
        when(databaseAdminService.createBackup()).thenReturn(info);

        ResponseEntity<?> resp = controller.createBackup();

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(((BackupInfoDto) resp.getBody()).filename()).isEqualTo("backup2.sql.gz");
    }

    @Test
    void createBackup_error_returns500() throws Exception {
        when(databaseAdminService.createBackup()).thenThrow(new IOException("write fail"));

        ResponseEntity<?> resp = controller.createBackup();

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
    }

    @Test
    void downloadBackup_gz_returnsGzipContentType() {
        Resource res = new ByteArrayResource(new byte[]{1, 2, 3});
        when(databaseAdminService.downloadBackup("dump.sql.gz")).thenReturn(res);

        ResponseEntity<?> resp = controller.downloadBackup("dump.sql.gz");

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getHeaders().getContentType()).isEqualTo(MediaType.parseMediaType("application/gzip"));
        assertThat(resp.getHeaders().get(HttpHeaders.CONTENT_DISPOSITION).get(0)).contains("dump.sql.gz");
    }

    @Test
    void downloadBackup_sql_returnsSqlContentType() {
        Resource res = new ByteArrayResource(new byte[]{1});
        when(databaseAdminService.downloadBackup("dump.sql")).thenReturn(res);

        ResponseEntity<?> resp = controller.downloadBackup("dump.sql");

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getHeaders().getContentType()).isEqualTo(MediaType.parseMediaType("application/sql"));
    }

    @Test
    void downloadBackup_securityException_returns400() {
        when(databaseAdminService.downloadBackup("../etc/passwd"))
                .thenThrow(new SecurityException("path traversal"));

        ResponseEntity<?> resp = controller.downloadBackup("../etc/passwd");

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void downloadBackup_notFound_returns404() {
        when(databaseAdminService.downloadBackup("missing.sql"))
                .thenThrow(new IllegalArgumentException("not found"));

        ResponseEntity<?> resp = controller.downloadBackup("missing.sql");

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void downloadBackup_genericError_returns500() {
        when(databaseAdminService.downloadBackup("x"))
                .thenThrow(new RuntimeException("boom"));

        ResponseEntity<?> resp = controller.downloadBackup("x");

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
    }

    @Test
    void deleteBackup_success_returnsOk() throws Exception {
        doNothing().when(databaseAdminService).deleteBackup("dump.sql");

        ResponseEntity<?> resp = controller.deleteBackup("dump.sql");

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        @SuppressWarnings("unchecked")
        Map<String, String> body = (Map<String, String>) resp.getBody();
        assertThat(body.get("message")).contains("dump.sql");
    }

    @Test
    void deleteBackup_securityException_returns400() throws Exception {
        doThrow(new SecurityException("forbidden")).when(databaseAdminService).deleteBackup("evil.sql");

        ResponseEntity<?> resp = controller.deleteBackup("evil.sql");

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void deleteBackup_notFound_returns404() throws Exception {
        doThrow(new IllegalArgumentException("not found")).when(databaseAdminService).deleteBackup("missing.sql");

        ResponseEntity<?> resp = controller.deleteBackup("missing.sql");

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void deleteBackup_genericError_returns500() throws Exception {
        doThrow(new IOException("boom")).when(databaseAdminService).deleteBackup("x");

        ResponseEntity<?> resp = controller.deleteBackup("x");

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
    }
}
