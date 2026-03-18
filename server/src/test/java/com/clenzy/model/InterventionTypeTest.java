package com.clenzy.model;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class InterventionTypeTest {

    @Nested
    @DisplayName("Category classification")
    class CategoryClassification {
        @Test
        void cleaningTypes_areClassifiedAsCleaning() {
            assertThat(InterventionType.CLEANING.isCleaning()).isTrue();
            assertThat(InterventionType.DEEP_CLEANING.isCleaning()).isTrue();
            assertThat(InterventionType.EXPRESS_CLEANING.isCleaning()).isTrue();
        }

        @Test
        void maintenanceTypes_areClassifiedAsMaintenance() {
            assertThat(InterventionType.PLUMBING_REPAIR.isMaintenance()).isTrue();
            assertThat(InterventionType.ELECTRICAL_REPAIR.isMaintenance()).isTrue();
            assertThat(InterventionType.EMERGENCY_REPAIR.isMaintenance()).isTrue();
        }

        @Test
        void specializedTypes_areClassifiedAsSpecialized() {
            assertThat(InterventionType.GARDENING.isSpecialized()).isTrue();
            assertThat(InterventionType.PEST_CONTROL.isSpecialized()).isTrue();
        }

        @Test
        void categoriesAreMutuallyExclusive() {
            for (InterventionType type : InterventionType.values()) {
                int count = 0;
                if (type.isCleaning()) count++;
                if (type.isMaintenance()) count++;
                if (type.isSpecialized()) count++;
                if (type == InterventionType.OTHER) {
                    assertThat(count).as("OTHER should not belong to any category").isZero();
                } else {
                    assertThat(count).as(type + " should belong to exactly one category").isEqualTo(1);
                }
            }
        }
    }

    @Nested
    @DisplayName("fromString conversion")
    class FromString {
        @Test
        void whenValidString_thenReturnsCorrectType() {
            assertThat(InterventionType.fromString("CLEANING")).isEqualTo(InterventionType.CLEANING);
        }

        @Test
        void whenLowercaseString_thenReturnsCorrectType() {
            assertThat(InterventionType.fromString("deep_cleaning")).isEqualTo(InterventionType.DEEP_CLEANING);
        }

        @Test
        void whenInvalidString_thenReturnsOther() {
            assertThat(InterventionType.fromString("NONEXISTENT")).isEqualTo(InterventionType.OTHER);
        }

        @Test
        void whenNull_thenReturnsNull() {
            assertThat(InterventionType.fromString(null)).isNull();
        }
    }

    @Nested
    @DisplayName("getCategory")
    class GetCategory {
        @Test
        void cleaningTypesReturnCleaningCategory() {
            assertThat(InterventionType.CLEANING.getCategory()).isEqualTo("cleaning");
        }

        @Test
        void maintenanceTypesReturnMaintenanceCategory() {
            assertThat(InterventionType.PLUMBING_REPAIR.getCategory()).isEqualTo("maintenance");
        }

        @Test
        void specializedTypesReturnSpecializedCategory() {
            assertThat(InterventionType.GARDENING.getCategory()).isEqualTo("specialized");
        }

        @Test
        void otherReturnsOtherCategory() {
            assertThat(InterventionType.OTHER.getCategory()).isEqualTo("other");
        }
    }
}
