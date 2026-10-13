package org.mission1.crew.application;

import java.util.List;
import org.mission1.crew.domain.*;
import org.mission1.crew.domain.CrewEditorial.*;
import org.springframework.transaction.annotation.*;

/** Internal stream ownership: editorial success cannot heal operational-feed failure. */
public class CrewResourceHealthDiagnostic {
  public record Report(
      CrewQueryService.Status nasaOperationalFeed, List<Health> editorialResources) {}

  private final CrewEditorialRepository editorial;
  private final CrewQueryService operational;

  public CrewResourceHealthDiagnostic(
      CrewEditorialRepository editorial, CrewQueryService operational) {
    this.editorial = editorial;
    this.operational = operational;
  }

  @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
  public Report read() {
    return new Report(
        operational.status(CrewSource.NASA_OFFICIAL, Station.ISS), editorial.health());
  }
}
