package org.mission1.source.crew.nasa;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Element;
import org.mission1.crew.domain.*;

import java.net.*;
import java.util.*;
import java.util.regex.Pattern;

/**
 * Narrow paragraph grammar, never whole-page or language-model extraction. All live coverage is
 * partial.
 */
public final class NasaOperationalPostParser {
    public static final String NAME = "NasaOperationalPostParser", VERSION = "1.0.0";
    private static final Pattern AGENCY =
            Pattern.compile(
                    "(?:NASA astronauts?|ESA \\(European Space Agency\\) astronauts?|CSA"
                        + " \\(Canadian Space Agency\\) astronauts?|Roscosmos cosmonauts?) ");
    private static final Pattern PERSON = Pattern.compile("[\\p{L}]+(?:[ .’'\\-][\\p{L}]+){1,5}");
    private static final Pattern COUNT =
            Pattern.compile(
                    "bring the number of people living aboard the (?:International Space"
                        + " Station|orbital outpost) to ([0-9]{1,2})[.!]?");

    public List<CrewVerificationEvidence> parse(
            String title, String html, CrewSourceObservation observation) {
        var body = Jsoup.parseBodyFragment(html).body();
        var result = new ArrayList<CrewVerificationEvidence>();
        for (var p : body.select("p")) {
            String text = normalize(p.text());
            // Announcement clauses are deliberately not completed assertions.
            if (text.matches(
                    ".*\\b(?:will|scheduled|planned|expected|prepares|preparing|targeting)\\b.*"))
                continue;
            String marker = " have entered the International Space Station";
            int at = text.indexOf(marker);
            if (at > 0) {
                result.add(
                        named(
                                CrewVerificationEvidence.Type.PERSON_ENTERED_STATION,
                                people(text.substring(0, at), p),
                                text,
                                observation,
                                CrewVerificationEvidence.Assertion.COMPLETED));
                if (text.contains("following Dragon’s hatch opening at "))
                    result.add(
                            new CrewVerificationEvidence(
                                    CrewVerificationEvidence.Type.HATCH_OPENED,
                                    Station.ISS,
                                    List.of(),
                                    null,
                                    NasaSourceType.NASA_ISS_OPERATIONAL_POST,
                                    observation,
                                    text,
                                    NAME + "/" + VERSION,
                                    CrewVerificationEvidence.Completeness.EVENT_ONLY,
                                    CrewVerificationEvidence.Assertion.COMPLETED));
            }
            marker = " already aboard the orbiting laboratory";
            at = text.indexOf(marker);
            int includes = text.indexOf("crew, which includes ");
            if (at > 0 && includes >= 0)
                result.add(
                        named(
                                CrewVerificationEvidence.Type.PERSON_CURRENTLY_ABOARD,
                                people(
                                        text.substring(
                                                includes + "crew, which includes ".length(), at),
                                        p),
                                text,
                                observation,
                                CrewVerificationEvidence.Assertion.OBSERVED));
            marker = " have departed the International Space Station";
            at = text.indexOf(marker);
            if (at > 0)
                result.add(
                        named(
                                CrewVerificationEvidence.Type.PERSON_DEPARTED_STATION,
                                people(text.substring(0, at), p),
                                text,
                                observation,
                                CrewVerificationEvidence.Assertion.COMPLETED));
            // A crew-vehicle departure without named subjects cannot update individual presence
            // safely.
            if (text.contains("mission undocked from the International Space Station")
                    || (title.toLowerCase(Locale.ROOT).contains("undock")
                            && text.matches(
                                    ".*(?:Crew-[0-9]+|crew members|astronauts|cosmonauts).*")))
                throw new IllegalArgumentException(
                        "Crew undocking requires explicit person-departure subjects");
            var count = COUNT.matcher(text);
            if (count.find())
                result.add(
                        new CrewVerificationEvidence(
                                CrewVerificationEvidence.Type.CREW_COUNT_ABOARD,
                                Station.ISS,
                                List.of(),
                                Integer.valueOf(count.group(1)),
                                NasaSourceType.NASA_ISS_OPERATIONAL_POST,
                                observation,
                                text,
                                NAME + "/" + VERSION,
                                CrewVerificationEvidence.Completeness.COUNT_ONLY,
                                CrewVerificationEvidence.Assertion.OBSERVED));
        }
        // Unknown operational transition wording cannot silently leave old occupancy confirmed.
        String lower = title.toLowerCase(Locale.ROOT);
        boolean candidate =
                lower.matches(
                                ".*(?:enter station|enters station|entered"
                                    + " station|depart.*station|leave.*station|crew expands).*")
                        && !lower.matches(
                                ".*(?:prepares|preparing|scheduled|coverage|will |target).*");
        if ((candidate && result.isEmpty())
                || (lower.contains("enter station")
                        && result.stream()
                                .noneMatch(
                                        e ->
                                                e.type()
                                                        == CrewVerificationEvidence.Type
                                                                .PERSON_ENTERED_STATION)))
            throw new IllegalArgumentException("Required operational assertion anchor absent");
        return List.copyOf(result);
    }

    private CrewVerificationEvidence named(
            CrewVerificationEvidence.Type type,
            List<PersonReference> people,
            String text,
            CrewSourceObservation o,
            CrewVerificationEvidence.Assertion assertion) {
        return new CrewVerificationEvidence(
                type,
                Station.ISS,
                people,
                null,
                NasaSourceType.NASA_ISS_OPERATIONAL_POST,
                o,
                text,
                NAME + "/" + VERSION,
                CrewVerificationEvidence.Completeness.PARTIAL,
                assertion);
    }

    private List<PersonReference> people(String clause, Element paragraph) {
        if (!AGENCY.matcher(clause).find())
            throw new IllegalArgumentException("Agency/person semantic anchor required");
        String stripped = AGENCY.matcher(clause).replaceAll("");
        var people = new ArrayList<PersonReference>();
        for (String part : stripped.split(",| and ")) {
            String name = part.trim();
            if (name.isEmpty()) continue;
            if (!PERSON.matcher(name).matches())
                throw new IllegalArgumentException("Unrecognized person-list grammar");
            URI profile = null;
            for (var a : paragraph.select("a[href]")) {
                if (!normalize(a.text()).equals(name)) continue;
                URI candidate = officialProfile(a.attr("href"));
                if (candidate != null) {
                    if (profile != null && !profile.equals(candidate))
                        throw new IllegalArgumentException("Ambiguous profile link");
                    profile = candidate;
                }
            }
            people.add(new PersonReference(null, name, List.of(), profile));
        }
        if (people.isEmpty()
                || people.stream().map(PersonReference::displayName).distinct().count()
                        != people.size())
            throw new IllegalArgumentException("Missing or duplicate subjects");
        return List.copyOf(people);
    }

    public static URI officialProfile(String href) {
        try {
            URI uri = URI.create(href);
            // Decode the observed Safe Links wrapper locally; never request Microsoft or follow it.
            if ("gcc02.safelinks.protection.outlook.com".equals(uri.getHost())) {
                String target =
                        Arrays.stream(uri.getRawQuery().split("&"))
                                .filter(x -> x.startsWith("url="))
                                .map(
                                        x ->
                                                URLDecoder.decode(
                                                        x.substring(4),
                                                        java.nio.charset.StandardCharsets.UTF_8))
                                .findFirst()
                                .orElse("");
                uri = URI.create(target);
            }
            if ("https".equals(uri.getScheme())
                    && "www.nasa.gov".equals(uri.getHost())
                    && uri.getUserInfo() == null
                    && uri.getPort() == -1
                    && uri.getQuery() == null
                    && uri.getFragment() == null
                    && uri.getPath().matches("/people/[a-z0-9-]+/")) return uri;
        } catch (IllegalArgumentException | NullPointerException ignored) {
        }
        return null;
    }

    static String normalize(String text) {
        return text.replaceAll("[\\s\\p{Z}]+", " ").trim();
    }
}
