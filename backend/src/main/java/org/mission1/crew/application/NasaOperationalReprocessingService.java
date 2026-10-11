package org.mission1.crew.application;

import java.util.*;
import org.mission1.crew.domain.*;
import org.mission1.source.crew.nasa.NasaOperationalFeedParser;

/**
 * Explicit application write command. No HTTP, identity resolution, scheduling or GET dependency.
 */
public final class NasaOperationalReprocessingService {
  public record Result(
      long sourceDocument,
      String bodyHash,
      CrewSourceState state,
      CrewVerificationRepository.Stored stored,
      double parseMillis) {}

  private final CrewVerificationRepository repository;
  private final NasaOperationalFeedParser parser;

  public NasaOperationalReprocessingService(
      CrewVerificationRepository repository, NasaOperationalFeedParser parser) {
    this.repository = repository;
    this.parser = parser;
  }

  public List<Result> reprocess(int limit) {
    if (limit < 1 || limit > 32) throw new IllegalArgumentException("Reprocessing batch bound");
    var results = new ArrayList<Result>();
    for (var source : repository.retainedOperationalDocuments(limit)) {
      long start = System.nanoTime();
      var interpreted = parser.verify(source.source());
      double millis = (System.nanoTime() - start) / 1_000_000.0;
      boolean accepted = interpreted.state() == CrewSourceState.AVAILABLE;
      var stored =
          repository.storeInterpretation(
              source,
              NasaOperationalFeedParser.NAME,
              NasaOperationalFeedParser.VERSION,
              accepted ? interpreted.value() : List.of(),
              accepted);
      results.add(
          new Result(
              source.id(),
              source.source().observation().contentHash(),
              interpreted.state(),
              stored,
              millis));
    }
    return List.copyOf(results);
  }
}
