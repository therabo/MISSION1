package org.mission1.api.crew;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;

import java.nio.file.*;

/**
 * Architectural read-path gate: future API edits cannot silently acquire providers or expose rows.
 */
class CrewRestArchitectureTest {
    @Test
    void apiReadPathCannotImportSourcesWritersOrJdbc() throws Exception {
        try (var paths = Files.walk(Path.of("src/main/java/org/mission1/api/crew"))) {
            for (var path : paths.filter(p -> p.toString().endsWith(".java")).toList()) {
                var code = Files.readString(path);
                for (var forbidden :
                        java.util.List.of(
                                "org.mission1.source.",
                                "java.net.http",
                                "org.springframework.jdbc",
                                "CrewIngestionService",
                                "NasaCrewVerificationIngestionService",
                                "CrewReconciliationService",
                                ".reconcile(",
                                ".resolve("))
                    assertFalse(code.contains(forbidden), path + ": " + forbidden);
            }
        }
    }

    @Test
    void publicDtosCannotReferenceDomainPersistenceOrProviderTypes() {
        for (var type : CrewResponses.class.getDeclaredClasses()) {
            assertTrue(type.isRecord(), type.getName());
            for (var component : type.getRecordComponents()) {
                var name = component.getGenericType().getTypeName();
                assertFalse(
                        name.contains("org.mission1.crew.")
                                || name.contains("org.mission1.source."),
                        name);
            }
        }
    }

    @Test
    void controllerDependsOnlyOnTheReadCompositionBoundary() {
        assertArrayEquals(
                new Class<?>[] {CrewRestQueryService.class},
                CrewController.class.getConstructors()[0].getParameterTypes());
    }
}
