package org.mission1.crew.domain;

import java.time.*;
import java.util.Optional;

/** Versioned, bounded temporal provenance in the existing immutable evidence-method field. */
public record CrewOperationalTime(
    LocalDateTime local, String sourceClock, String sourceZone, String zone, String dateBasis) {
  public static final String METHOD = "NasaOperationalPostParser/1.1.0";

  public String method() {
    String value =
        String.join(
            "|", METHOD, "MINUTE", local.toString(), sourceClock, sourceZone, zone, dateBasis);
    if (value.length() > 150) throw new IllegalArgumentException("Temporal provenance bound");
    return value;
  }

  public String precision() {
    return "MINUTE";
  }

  public Instant instant() {
    var value = local.atZone(ZoneId.of(zone));
    if (sourceZone.equals("EST")) value = value.withLaterOffsetAtOverlap();
    return value.toInstant();
  }

  public static Optional<CrewOperationalTime> read(String method) {
    if (!method.startsWith(METHOD + "|") && !method.startsWith("NasaOperationalPostParser/1.2.0|MINUTE|")) return Optional.empty();
    String[] fields = method.split("\\|", -1);
    if (fields.length != 7 || !fields[1].equals("MINUTE"))
      throw new IllegalArgumentException("Invalid temporal provenance");
    return Optional.of(
        new CrewOperationalTime(
            LocalDateTime.parse(fields[2]), fields[3], fields[4], fields[5], fields[6]));
  }
}
