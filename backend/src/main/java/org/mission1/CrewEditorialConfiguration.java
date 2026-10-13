package org.mission1;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.time.*;
import org.mission1.crew.application.*;
import org.mission1.source.crew.nasa.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.*;
import org.springframework.scheduling.annotation.Scheduled;

@Configuration
class CrewEditorialConfiguration {
  @Bean
  NasaRequestGate nasaRequestGate(CrewEditorialRepository repository, Clock utcClock) {
    return new NasaRequestGate(repository, utcClock);
  }

  @Bean
  NasaEditorialParser nasaEditorialParser(ObjectMapper json) {
    return new NasaEditorialParser(json);
  }

  @Bean
  NasaEditorialSource nasaEditorialSource(
      CrewEditorialRepository repository,
      NasaEditorialParser parser,
      Clock utcClock,
      NasaRequestGate gate,
      @Value("${mission1.crew.request-timeout:PT20S}") Duration timeout,
      @Value(
              "${mission1.crew.editorial.topic-url:https://www.nasa.gov/international-space-station/space-station-research-and-technology/latest-news-from-space-station-research/}")
          URI topic) {
    var client =
        HttpClient.newBuilder()
            .connectTimeout(timeout)
            .followRedirects(HttpClient.Redirect.NEVER)
            .build();
    return new NasaEditorialSource(
        new NasaEditorialHttp(client, utcClock, timeout, gate),
        repository,
        parser,
        utcClock,
        topic);
  }

  @Bean
  @ConditionalOnProperty(
      name = "mission1.crew.editorial.enabled",
      havingValue = "true",
      matchIfMissing = true)
  EditorialScheduler editorialScheduler(
      NasaEditorialSource source,
      CrewEditorialRepository repository,
      Clock utcClock,
      @Value("${mission1.crew.editorial.fixed-delay:PT2H}") Duration interval,
      @Value("${mission1.crew.editorial.initial-delay:PT15M}") Duration initial) {
    if (interval.compareTo(Duration.ofHours(2)) < 0
        || initial.compareTo(Duration.ofMinutes(10)) < 0)
      throw new IllegalArgumentException("Conservative editorial cadence required");
    return new EditorialScheduler(source, repository, utcClock, interval);
  }

  static final class EditorialScheduler {
    private static final System.Logger LOG = System.getLogger(EditorialScheduler.class.getName());
    private final NasaEditorialSource source;
    private final CrewEditorialRepository repository;
    private final Clock clock;
    private final Duration interval;

    EditorialScheduler(
        NasaEditorialSource source,
        CrewEditorialRepository repository,
        Clock clock,
        Duration interval) {
      this.source = source;
      this.repository = repository;
      this.clock = clock;
      this.interval = interval;
    }

    @Scheduled(
        fixedDelayString = "${mission1.crew.editorial.fixed-delay:PT2H}",
        initialDelayString = "${mission1.crew.editorial.initial-delay:PT15M}")
    void refresh() {
      try {
        if (repository.claimRefresh(clock.instant(), interval)) {
          var r = source.acquire();
          LOG.log(
              System.Logger.Level.INFO,
              "NASA Crew resource acquisition: outcome={0}, expedition={1}, slots={2}, requests={3}",
              r.outcome(),
              r.expedition(),
              r.members(),
              r.requests());
        }
      } catch (RuntimeException e) {
        LOG.log(
            System.Logger.Level.WARNING,
            "NASA editorial acquisition failed: {0}",
            e.getClass().getSimpleName());
      }
    }
  }
}
