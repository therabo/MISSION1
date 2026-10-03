package org.mission1.crew;

import static org.junit.jupiter.api.Assertions.*;
import java.nio.file.*;
import org.junit.jupiter.api.Test;

class CrewArchitectureTest {
    @Test void crewAndOrbitRemainIndependentAndCrewDomainHasNoInfrastructureImports() throws Exception {
        var root = Path.of("src/main/java/org/mission1");
        try (var paths = Files.walk(root)) {
            for (var p : paths.filter(p -> p.toString().endsWith(".java")).toList()) {
                String code = Files.readString(p); String relative = root.relativize(p).toString();
                if (relative.startsWith("crew/") || relative.startsWith("source/crew/")) {
                    assertFalse(code.contains("import org.mission1.orbital"), relative);
                    assertFalse(code.contains("import org.mission1.source.orbital"), relative);
                    assertFalse(code.contains("org.orekit"), relative);
                    assertFalse(code.contains("@Scheduled") || code.contains("@PostConstruct")
                            || code.contains("@RestController") || code.contains("@Entity"), relative);
                }
                if (relative.startsWith("orbital/") || relative.startsWith("source/orbital/"))
                    assertFalse(code.contains("org.mission1.crew") || code.contains("org.mission1.source.crew"), relative);
                if (relative.startsWith("crew/domain/")) {
                    assertFalse(code.contains("import org.springframework") || code.contains("import com.fasterxml")
                            || code.contains("import java.net.http") || code.contains("import java.sql"), relative);
                }
            }
        }
    }
}
