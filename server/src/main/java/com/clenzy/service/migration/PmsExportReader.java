package com.clenzy.service.migration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.commons.csv.CSVFormat;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.openxml4j.util.ZipSecureFile;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.*;
import java.nio.ByteBuffer;
import java.nio.charset.*;
import java.util.*;
import java.util.zip.ZipInputStream;

/** Bounded, inert readers. No macros, formula evaluation, remote URL or disk extraction. */
@Component
public class PmsExportReader {
    public static final int MAX_BYTES = 8 * 1024 * 1024;
    public static final int MAX_EXPANDED_BYTES = 24 * 1024 * 1024;
    public static final int MAX_ROWS = 5000;
    public static final int MAX_COLUMNS = 256;
    private final ObjectMapper json;

    public PmsExportReader(ObjectMapper json) { this.json = json; }

    public List<ImportDocument> read(List<MultipartFile> files, String encoding) throws IOException {
        if (files == null || files.isEmpty() || files.size() > 20) throw invalid("FILES_LIMIT");
        Charset charset = switch (encoding) {
            case "UTF-8" -> StandardCharsets.UTF_8;
            case "windows-1252" -> Charset.forName("windows-1252");
            case "UTF-16" -> StandardCharsets.UTF_16;
            default -> throw invalid("ENCODING");
        };
        List<ImportDocument> result = new ArrayList<>();
        int bytes = 0;
        int[] expandedBudget = {MAX_EXPANDED_BYTES};
        for (MultipartFile file : files) {
            bytes += Math.toIntExact(file.getSize());
            if (bytes > MAX_BYTES) throw invalid("FILES_TOO_LARGE");
            String name = file.getOriginalFilename();
            if (name == null) throw invalid("FILE_NAME");
            readFile(name, file.getBytes(), charset, result, false, expandedBudget);
        }
        if (result.isEmpty()) throw invalid("EMPTY_EXPORT");
        if (result.stream().mapToInt(d -> d.rows().size()).sum() > MAX_ROWS) throw invalid("ROWS_LIMIT");
        return result;
    }

    private void readFile(String name, byte[] bytes, Charset charset, List<ImportDocument> result,
                          boolean insideZip, int[] expandedBudget) throws IOException {
        String clean = name.replace('\\', '/');
        if (clean.startsWith("/") || clean.contains("../") || clean.contains(":") || clean.length() > 240)
            throw invalid("FILE_NAME");
        String ext = clean.substring(clean.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
        switch (ext) {
            case "csv", "tsv" -> csv(clean, decode(bytes, charset), ext, result);
            case "json" -> json(clean, bytes, result);
            case "xlsx", "xls" -> excel(clean, bytes, result, expandedBudget);
            case "zip" -> {
                if (insideZip) throw invalid("NESTED_ARCHIVE");
                try (var zip = new ZipInputStream(new ByteArrayInputStream(bytes))) {
                    int entries = 0;
                    for (var entry = zip.getNextEntry(); entry != null; entry = zip.getNextEntry()) {
                        if (++entries > 100) throw invalid("ARCHIVE_LIMIT");
                        if (entry.isDirectory()) continue;
                        byte[] data = zip.readNBytes(expandedBudget[0] + 1);
                        expandedBudget[0] -= data.length;
                        if (expandedBudget[0] < 0) throw invalid("ARCHIVE_LIMIT");
                        readFile(entry.getName(), data, charset, result, true, expandedBudget);
                    }
                }
            }
            default -> {
                // Preserved verbatim for retrieval, explicitly NOT promoted into business entities.
                result.add(new ImportDocument(UUID.randomUUID().toString(), clean,
                    List.of(), List.of(), Base64.getEncoder().encodeToString(bytes)));
            }
        }
        if (result.size() > 100 || result.stream().mapToInt(d -> d.rows().size()).sum() > MAX_ROWS)
            throw invalid("ROWS_LIMIT");
    }

    private String decode(byte[] bytes, Charset charset) throws CharacterCodingException {
        String text = charset.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
            .onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(bytes)).toString();
        return text.startsWith("\uFEFF") ? text.substring(1) : text;
    }

    private void csv(String name, String text, String ext, List<ImportDocument> result) throws IOException {
        char separator = ext.equals("tsv") ? '\t' : delimiter(text);
        var format = CSVFormat.RFC4180.builder().setDelimiter(separator).setIgnoreEmptyLines(true).get();
        try (var parser = format.parse(new StringReader(text))) {
            Iterator<org.apache.commons.csv.CSVRecord> records = parser.iterator();
            if (!records.hasNext()) throw invalid("EMPTY_EXPORT");
            List<String> columns = new ArrayList<>(records.next().toList());
            validateColumns(columns);
            List<Map<String, String>> rows = new ArrayList<>();
            while (records.hasNext()) {
                var record = records.next();
                if (record.size() != columns.size()) throw invalid("COLUMN_COUNT: " + record.getRecordNumber());
                Map<String, String> row = new LinkedHashMap<>();
                for (int i = 0; i < columns.size(); i++) row.put(columns.get(i), cell(record.get(i)));
                rows.add(row);
                if (rows.size() > MAX_ROWS) throw invalid("ROWS_LIMIT");
            }
            add(name, columns, rows, result);
        }
    }

    static char delimiter(String text) {
        Map<Character, Integer> counts = new LinkedHashMap<>();
        counts.put(',', 0); counts.put(';', 0); counts.put('\t', 0); counts.put('|', 0);
        boolean quoted = false;
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            if (c == '"') quoted = !quoted;
            if (!quoted && (c == '\r' || c == '\n')) break;
            if (!quoted && counts.containsKey(c)) counts.put(c, counts.get(c) + 1);
        }
        return counts.entrySet().stream().max(Map.Entry.comparingByValue()).orElseThrow().getKey();
    }

    private void json(String name, byte[] bytes, List<ImportDocument> result) throws IOException {
        // Jackson keeps integral IDs exact; decimal nodes must not pass through double.
        JsonNode root = json.reader().with(com.fasterxml.jackson.databind.DeserializationFeature.USE_BIG_DECIMAL_FOR_FLOATS)
            .readTree(bytes);
        if (root == null) throw invalid("EMPTY_EXPORT");
        if (root.isArray()) jsonRows(name, root, result);
        else if (root.isObject()) {
            boolean arrays = false;
            var fields = root.fields();
            while (fields.hasNext()) {
                var field = fields.next();
                if (field.getValue().isArray() && !field.getValue().isEmpty()
                    && field.getValue().get(0).isObject()) {
                    jsonRows(name + " / " + field.getKey(), field.getValue(), result);
                    arrays = true;
                }
            }
            // Keep envelope metadata and nested fields too, never silently discard them.
            if (!arrays) jsonRows(name, json.createArrayNode().add(root), result);
            else result.add(new ImportDocument(UUID.randomUUID().toString(), name + " (original)",
                List.of(), List.of(), Base64.getEncoder().encodeToString(bytes)));
        } else throw invalid("JSON_OBJECTS_REQUIRED");
    }

    private void jsonRows(String name, JsonNode array, List<ImportDocument> result) {
        if (array.size() > MAX_ROWS) throw invalid("ROWS_LIMIT");
        Set<String> columns = new LinkedHashSet<>();
        List<Map<String, String>> rows = new ArrayList<>();
        for (JsonNode node : array) {
            if (!node.isObject()) throw invalid("JSON_OBJECTS_REQUIRED");
            Map<String, String> row = new LinkedHashMap<>();
            flatten("", node, row, 0);
            columns.addAll(row.keySet()); rows.add(row);
        }
        validateColumns(new ArrayList<>(columns));
        add(name, new ArrayList<>(columns), rows, result);
    }

    private void flatten(String prefix, JsonNode node, Map<String, String> row, int depth) {
        if (depth > 12) throw invalid("JSON_DEPTH");
        var fields = node.fields();
        while (fields.hasNext()) {
            var field = fields.next();
            String key = prefix + field.getKey();
            if (field.getKey().contains(".")) throw invalid("JSON_AMBIGUOUS_KEY");
            if (field.getValue().isObject()) flatten(key + ".", field.getValue(), row, depth + 1);
            else row.put(key, cell(field.getValue().isNull() ? "" :
                field.getValue().isValueNode() ? field.getValue().asText() : field.getValue().toString()));
            if (row.size() > MAX_COLUMNS) throw invalid("COLUMNS_LIMIT");
        }
    }

    private void excel(String name, byte[] bytes, List<ImportDocument> result, int[] expandedBudget) throws IOException {
        // Bound all XML parts together BEFORE POI materializes them, including nested XLSX in ZIP.
        if (name.toLowerCase(Locale.ROOT).endsWith(".xlsx")) {
            try (var zip = new ZipInputStream(new ByteArrayInputStream(bytes))) {
                byte[] buffer = new byte[8192];
                int entries = 0;
                for (var entry = zip.getNextEntry(); entry != null; entry = zip.getNextEntry()) {
                    if (++entries > 500) throw invalid("ARCHIVE_LIMIT");
                    int count;
                    while ((count = zip.read(buffer)) != -1) {
                        expandedBudget[0] -= count;
                        if (expandedBudget[0] < 0) throw invalid("ARCHIVE_LIMIT");
                    }
                }
            }
        }
        // POI's ratio, entry-size and entry-count guards apply before workbook allocation.
        ZipSecureFile.setMaxEntrySize(MAX_EXPANDED_BYTES);
        ZipSecureFile.setMaxFileCount(500);
        try (Workbook workbook = WorkbookFactory.create(new ByteArrayInputStream(bytes))) {
            if (workbook.getNumberOfSheets() > 30) throw invalid("SHEETS_LIMIT");
            for (Sheet sheet : workbook) {
                if (sheet.getPhysicalNumberOfRows() == 0) continue;
                if (sheet.getLastRowNum() > MAX_ROWS) throw invalid("ROWS_LIMIT");
                Row header = sheet.getRow(sheet.getFirstRowNum());
                if (header.getLastCellNum() > MAX_COLUMNS) throw invalid("COLUMNS_LIMIT");
                List<String> columns = new ArrayList<>();
                for (int c = 0; c < header.getLastCellNum(); c++) columns.add(excelCell(header.getCell(c)));
                validateColumns(columns);
                List<Map<String, String>> rows = new ArrayList<>();
                for (int r = header.getRowNum() + 1; r <= sheet.getLastRowNum(); r++) {
                    Row source = sheet.getRow(r);
                    if (source == null) continue;
                    if (source.getLastCellNum() > columns.size()) throw invalid("COLUMN_COUNT: " + (r + 1));
                    Map<String, String> row = new LinkedHashMap<>();
                    for (int c = 0; c < columns.size(); c++) row.put(columns.get(c), excelCell(source.getCell(c)));
                    if (row.values().stream().anyMatch(v -> !v.isBlank())) rows.add(row);
                }
                add(name + " / " + sheet.getSheetName(), columns, rows, result);
            }
        }
    }

    private String excelCell(Cell value) {
        if (value == null) return "";
        // Refuse formulas instead of executing or trusting a stale cached result.
        if (value.getCellType() == CellType.FORMULA) throw invalid("EXCEL_FORMULA_EXPORT_VALUES");
        if (value.getCellType() == CellType.NUMERIC) {
            if (DateUtil.isCellDateFormatted(value)) return value.getLocalDateTimeCellValue().toLocalDate().toString();
            return java.math.BigDecimal.valueOf(value.getNumericCellValue()).stripTrailingZeros().toPlainString();
        }
        if (value.getCellType() == CellType.ERROR) throw invalid("EXCEL_CELL_ERROR");
        return cell(new DataFormatter(Locale.ROOT).formatCellValue(value));
    }

    private static void validateColumns(List<String> columns) {
        if (columns.isEmpty() || columns.size() > MAX_COLUMNS) throw invalid("COLUMNS_LIMIT");
        if (columns.stream().anyMatch(c -> c.isBlank() || c.length() > 200)
            || new HashSet<>(columns).size() != columns.size()) throw invalid("DUPLICATE_OR_EMPTY_HEADERS");
    }

    private static String cell(String value) {
        if (value.length() > 16000) throw invalid("CELL_TOO_LARGE");
        return value;
    }

    private static void add(String name, List<String> columns, List<Map<String, String>> rows,
                            List<ImportDocument> result) {
        result.add(new ImportDocument(UUID.randomUUID().toString(), name, columns, rows, null));
    }

    static IllegalArgumentException invalid(String code) { return new IllegalArgumentException(code); }
}
