package com.clenzy.service.migration;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.zip.*;
import static org.assertj.core.api.Assertions.*;

class PmsExportReaderTest {
    private final PmsExportReader reader = new PmsExportReader(new ObjectMapper());
    private List<ImportDocument> read(String name, String text) throws Exception {
        return reader.read(List.of(new MockMultipartFile("files", name, "application/octet-stream", text.getBytes(StandardCharsets.UTF_8))), "UTF-8");
    }
    @Test void quotedMultilineSemicolonBomAndLeadingZerosRemainIntact() throws Exception {
        var doc = read("contacts.csv", "\uFEFFid;first name;last name;notes\r\n000123;Salma;Alaoui;\"Arrivée tardive\r\nCode \"\"AB\"\"\"\r\n").getFirst();
        assertThat(doc.rows().getFirst()).containsEntry("id", "000123")
            .containsEntry("notes", "Arrivée tardive\r\nCode \"AB\"");
        assertThat(PmsImportSchema.suggest(doc).kind()).isEqualTo(ImportPlan.Kind.GUEST);
    }
    @Test void duplicateHeadersAndExtraCellsAreRejected() {
        assertThatThrownBy(() -> read("x.csv", "id,id\n1,2")).hasMessage("DUPLICATE_OR_EMPTY_HEADERS");
        assertThatThrownBy(() -> read("x.csv", "id,name\n1,2,3")).hasMessageStartingWith("COLUMN_COUNT");
    }
    @Test void jsonPreservesLargeIdsUnknownNestedFieldsAndEnvelope() throws Exception {
        var docs = read("export.json", "{\"account\":\"hotel\",\"guests\":[{\"id\":90071992547409931234,\"guest\":{\"email\":\"x@example.com\"},\"tags\":[\"vip\"]}]}");
        assertThat(docs.getFirst().rows().getFirst()).containsEntry("id", "90071992547409931234")
            .containsEntry("guest.email", "x@example.com").containsEntry("tags", "[\"vip\"]");
        assertThat(docs.getLast().attachmentBase64()).isNotBlank();
    }
    @Test void ambiguousJsonPathsAreRejected() {
        assertThatThrownBy(() -> read("export.json", "[{\"guest.id\":1}]")).hasMessage("JSON_AMBIGUOUS_KEY");
    }
    @Test void invalidEncodingIsNotSilentlyReplaced() {
        assertThatThrownBy(() -> reader.read(List.of(new MockMultipartFile("files", "x.csv", "text/csv",
            new byte[]{(byte)0xff})), "UTF-8")).isInstanceOf(java.nio.charset.CharacterCodingException.class);
    }
    @Test void excelReadsAllSheetsAndNeverExecutesFormulas() throws Exception {
        try (var book = new XSSFWorkbook(); var out = new ByteArrayOutputStream()) {
            var sheet = book.createSheet("Guests");
            sheet.createRow(0).createCell(0).setCellValue("id");
            sheet.createRow(1).createCell(0).setCellValue("00045");
            var second = book.createSheet("Properties");
            second.createRow(0).createCell(0).setCellValue("name");
            second.createRow(1).createCell(0).setCellValue("Riad Nour");
            book.write(out);
            var docs = reader.read(List.of(new MockMultipartFile("files", "pms.xlsx", "", out.toByteArray())), "UTF-8");
            assertThat(docs).hasSize(2);
            assertThat(docs.getFirst().rows().getFirst()).containsEntry("id", "00045");
            sheet.getRow(1).getCell(0).setCellFormula("1+1");
            out.reset(); book.write(out);
            assertThatThrownBy(() -> reader.read(List.of(new MockMultipartFile("files", "x.xlsx", "", out.toByteArray())), "UTF-8"))
                .hasMessage("EXCEL_FORMULA_EXPORT_VALUES");
        }
    }
    @Test void zipTraversalNestedArchivesAndBombsAreRejected() throws Exception {
        assertThatThrownBy(() -> zipRead("../guests.csv", "id\n1".getBytes())).hasMessage("FILE_NAME");
        assertThatThrownBy(() -> zipRead("inner.zip", new byte[0])).hasMessage("NESTED_ARCHIVE");
        assertThatThrownBy(() -> zipRead("huge.txt", new byte[PmsExportReader.MAX_EXPANDED_BYTES + 1])).hasMessage("ARCHIVE_LIMIT");
    }
    @Test void attachmentIsArchivedWithoutExecutingOrFetchingIt() throws Exception {
        var doc = read("statements.xml", "<!DOCTYPE x SYSTEM 'https://example.com/secret'><x/>").getFirst();
        assertThat(doc.rows()).isEmpty();
        assertThat(doc.attachmentBase64()).isNotBlank();
        assertThat(PmsImportSchema.suggest(doc).kind()).isEqualTo(ImportPlan.Kind.ARCHIVE);
        assertThat(read("proprietary.pms", "vendor-data").getFirst().attachmentBase64()).isNotBlank();
        assertThat(read("README.txt", "first line\nsecond, longer line").getFirst().attachmentBase64()).isNotBlank();
    }
    private List<ImportDocument> zipRead(String path, byte[] bytes) throws Exception {
        var out = new ByteArrayOutputStream();
        try (var zip = new ZipOutputStream(out)) { zip.putNextEntry(new ZipEntry(path)); zip.write(bytes); zip.closeEntry(); }
        return reader.read(List.of(new MockMultipartFile("files", "export.zip", "", out.toByteArray())), "UTF-8");
    }
}
