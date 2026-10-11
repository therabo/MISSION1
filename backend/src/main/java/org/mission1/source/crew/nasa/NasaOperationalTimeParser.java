package org.mission1.source.crew.nasa;

import java.time.*;
import java.time.format.*;
import java.util.*;
import java.util.regex.*;
import org.mission1.crew.domain.*;

/** Explicit clock + dated article identity, never publication-as-event substitution. */
final class NasaOperationalTimeParser {
  static final String CLOCK = "([0-9]{1,2}):([0-9]{2}) (a\\.m\\.|p\\.m\\.) (EDT|EST)";
  private static final Pattern DATE =
      Pattern.compile("/blogs/[^/]+/([0-9]{4})/([0-9]{2})/([0-9]{2})/[^/]+/");
  private static final ZoneId EASTERN = ZoneId.of("America/New_York");

  static CrewOperationalTime parse(Matcher clock, String weekday, CrewSourceObservation source) {
    var date = DATE.matcher(source.sourceUrl().getPath());
    if (!date.matches() || source.sourcePublishedAt() == null)
      throw new IllegalArgumentException("Dated operational article required");
    LocalDate article =
        LocalDate.of(
            Integer.parseInt(date.group(1)),
            Integer.parseInt(date.group(2)),
            Integer.parseInt(date.group(3)));
    // The URL is explicit source date context. Publication only checks coherence/upper bound.
    if (!article.equals(source.sourcePublishedAt().atZone(EASTERN).toLocalDate()))
      throw new IllegalArgumentException("Article/publication date conflict");
    LocalDate event = article;
    String basis = "ARTICLE_DATE";
    if (weekday != null) {
      DayOfWeek day = DayOfWeek.valueOf(weekday.toUpperCase(Locale.ROOT));
      while (event.getDayOfWeek() != day) event = event.minusDays(1);
      basis = "BOUNDED_WEEKDAY"; // unique latest occurrence within [article-6d, article]
    }
    int hour = Integer.parseInt(clock.group(1)), minute = Integer.parseInt(clock.group(2));
    if (hour < 1 || hour > 12 || minute > 59) throw new IllegalArgumentException("Clock range");
    hour = hour % 12 + (clock.group(3).equals("p.m.") ? 12 : 0);
    LocalDateTime local = event.atTime(hour, minute);
    var offsets = EASTERN.getRules().getValidOffsets(local);
    // Explicit abbreviation disambiguates a fall-back minute; a spring gap is invalid.
    ZoneOffset expected = ZoneOffset.of(clock.group(4).equals("EDT") ? "-04:00" : "-05:00");
    if (!offsets.contains(expected))
      throw new IllegalArgumentException("Source zone/date conflict");
    // Explicit EDT/EST chooses the corresponding occurrence in a fall-back overlap.
    var value =
        new CrewOperationalTime(
            local,
            clock.group(1) + ":" + clock.group(2) + " " + clock.group(3),
            clock.group(4),
            EASTERN.getId(),
            basis);
    if (value.instant().isAfter(source.sourcePublishedAt()))
      throw new IllegalArgumentException("Completed event after publication");
    return value;
  }
}
