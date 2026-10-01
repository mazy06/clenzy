package com.clenzy.service;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import java.sql.DriverManager;
import static org.assertj.core.api.Assertions.assertThat;

/** Vérifie les noms et la compatibilité des données historiques, sans toucher la BDD de développement. */
class PropertyStockMigrationTest {
    @Test void addsOptionalVisualsToTheExistingStockSchema() throws Exception {
        try (var connection = DriverManager.getConnection("jdbc:h2:mem:stock_visual_migration;MODE=PostgreSQL")) {
            ScriptUtils.executeSqlScript(connection, new ClassPathResource(
                    "db/changelog/changes/0386__create_property_stock_items.sql"));
            try (var statement = connection.createStatement()) {
                statement.executeUpdate("INSERT INTO property_stock_items (organization_id, property_id, name) VALUES (1, 7, 'Café')");
            }
            ScriptUtils.executeSqlScript(connection, new ClassPathResource(
                    "db/changelog/changes/0482__stock_item_visuals.sql"));
            try (var statement = connection.createStatement();
                 var row = statement.executeQuery("SELECT name, catalog_key, photo_url FROM property_stock_items")) {
                assertThat(row.next()).isTrue();
                assertThat(row.getString("name")).isEqualTo("Café");
                assertThat(row.getString("catalog_key")).isNull();
                assertThat(row.getString("photo_url")).isNull();
            }
            try (var statement = connection.createStatement()) {
                assertThat(statement.executeUpdate("UPDATE property_stock_items SET catalog_key = 'coffee-capsules', photo_url = 'sample' WHERE id = 1")).isEqualTo(1);
            }
        }
    }
}
