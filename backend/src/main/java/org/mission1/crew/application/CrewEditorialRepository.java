package org.mission1.crew.application;

import java.net.URI;
import java.time.*;
import java.util.*;
import org.mission1.crew.domain.CrewEditorial.*;

/**
 * New stream's only persistence port. No identities, operational evidence or public projection
 * writes.
 */
public interface CrewEditorialRepository {
  StoredCapture retain(
      Capture capture,
      Resource resource,
      Roster roster,
      TopicFacts facts,
      Outcome outcome,
      String reason);

  Optional<StoredCapture> latest(Stream stream, URI url, boolean goodOnly);

  Optional<StoredRoster> latestRoster(Instant capturedBy);

  void retainRelation(Relation relation);

  List<Health> health();

  boolean claimRefresh(Instant now, Duration interval);

  Instant reserveNasaRequest(Instant now);

  void nasaCooldown(Instant until);
}
