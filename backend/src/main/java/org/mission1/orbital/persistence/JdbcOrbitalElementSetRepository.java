package org.mission1.orbital.persistence;

import java.net.URI;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

import org.mission1.orbital.application.OrbitalElementSetRepository;
import org.mission1.orbital.domain.DataClassification;
import org.mission1.orbital.domain.OrbitalElementSet;
import org.mission1.orbital.propagation.TleElementParser;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

/** PostgreSQL adapter; the orbital domain has no SQL or Spring dependency. */
@Repository
public class JdbcOrbitalElementSetRepository implements OrbitalElementSetRepository {
    private static final String SELECT_WITH_LATEST_OBSERVATION = """
            SELECT s.id, s.catalog_number, s.source_format, s.line1, s.line2,
                   s.element_epoch, s.provider, s.upstream_origin, s.source_uri,
                   s.published_at, s.sha256, s.classification, o.retrieved_at
            FROM orbital_element_sets s
            JOIN LATERAL (
                SELECT retrieved_at FROM orbital_element_observations
                WHERE element_set_id = s.id
            """;
    private static final String OBSERVATION_END = """
                ORDER BY retrieved_at DESC LIMIT 1
            ) o ON true
            """;

    private final JdbcTemplate jdbc;
    private final TleElementParser parser;

    public JdbcOrbitalElementSetRepository(JdbcTemplate jdbc, TleElementParser parser) {
        this.jdbc = Objects.requireNonNull(jdbc);
        this.parser = Objects.requireNonNull(parser);
    }

    @Override
    @Transactional
    public StoreResult storeIfNew(OrbitalElementSet elements) {
        validate(elements);
        List<Long> inserted = jdbc.query("""
                INSERT INTO orbital_element_sets
                    (catalog_number, source_format, line1, line2, element_epoch,
                     provider, upstream_origin, source_uri, published_at, sha256, classification)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (provider, catalog_number, sha256) DO NOTHING
                RETURNING id
                """, (rs, row) -> rs.getLong(1),
                elements.catalogNumber(), elements.sourceFormat(), elements.line1(), elements.line2(),
                utc(elements.elementEpoch()), elements.provider(), elements.upstreamOrigin(),
                elements.sourceUri().toString(), utc(elements.publishedAt()), elements.sha256(),
                elements.classification().name());

        boolean newElement = !inserted.isEmpty();
        long id;
        if (newElement) {
            id = inserted.getFirst();
        } else {
            Stored existing = findByIdentity(elements.provider(), elements.catalogNumber(), elements.sha256())
                    .orElseThrow(() -> new IllegalStateException("Conflicting element set was not readable"));
            OrbitalElementSet stored = existing.elements();
            OrbitalElementSet atExistingReceipt = new OrbitalElementSet(elements.catalogNumber(),
                    elements.sourceFormat(), elements.line1(), elements.line2(), elements.elementEpoch(),
                    elements.provider(), elements.upstreamOrigin(), elements.sourceUri(), stored.retrievedAt(),
                    elements.publishedAt(), elements.sha256(), elements.classification());
            if (!stored.equals(atExistingReceipt)) {
                throw new IllegalStateException("Element identity conflicts with immutable source metadata");
            }
            id = existing.id();
        }

        List<Instant> observations = jdbc.query("""
                INSERT INTO orbital_element_observations (element_set_id, retrieved_at)
                VALUES (?, ?)
                ON CONFLICT (element_set_id, retrieved_at) DO NOTHING
                RETURNING retrieved_at
                """, (rs, row) -> rs.getObject(1, OffsetDateTime.class).toInstant(),
                id, utc(elements.retrievedAt()));
        return new StoreResult(id, newElement, !observations.isEmpty());
    }

    @Override
    public Optional<Stored> findById(long id) {
        return one(SELECT_WITH_LATEST_OBSERVATION + OBSERVATION_END + "WHERE s.id = ?",
                id);
    }

    @Override
    public Optional<Stored> latestUsable(Instant asOf) {
        Objects.requireNonNull(asOf);
        return one(SELECT_WITH_LATEST_OBSERVATION + "AND retrieved_at <= ?\n"
                + OBSERVATION_END + "WHERE s.element_epoch <= ?\n"
                + "ORDER BY s.element_epoch DESC, o.retrieved_at DESC, s.provider ASC, s.sha256 ASC LIMIT 1",
                utc(asOf), utc(asOf));
    }

    @Override
    public List<Stored> recent(int limit) {
        if (limit < 1 || limit > 100) throw new IllegalArgumentException("History limit must be 1..100");
        return jdbc.query(SELECT_WITH_LATEST_OBSERVATION + OBSERVATION_END
                + "ORDER BY s.element_epoch DESC, o.retrieved_at DESC, s.provider ASC, s.sha256 ASC LIMIT ?",
                this::mapStored, limit);
    }

    private Optional<Stored> findByIdentity(String provider, int catalog, String hash) {
        return one(SELECT_WITH_LATEST_OBSERVATION + OBSERVATION_END
                + "WHERE s.provider = ? AND s.catalog_number = ? AND s.sha256 = ?",
                provider, catalog, hash);
    }

    private Optional<Stored> one(String sql, Object... args) {
        List<Stored> rows = jdbc.query(sql, this::mapStored, args);
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.getFirst());
    }

    private Stored mapStored(ResultSet rs, int row) throws SQLException {
        Instant publishedAt = instantOrNull(rs, "published_at");
        OrbitalElementSet elements = new OrbitalElementSet(
                rs.getInt("catalog_number"), rs.getString("source_format"),
                rs.getString("line1"), rs.getString("line2"), instant(rs, "element_epoch"),
                rs.getString("provider"), rs.getString("upstream_origin"),
                URI.create(rs.getString("source_uri")), instant(rs, "retrieved_at"),
                publishedAt, rs.getString("sha256"),
                DataClassification.valueOf(rs.getString("classification")));
        validate(elements);
        return new Stored(rs.getLong("id"), elements);
    }

    private void validate(OrbitalElementSet elements) {
        Objects.requireNonNull(elements);
        requireMicroseconds(elements.elementEpoch());
        requireMicroseconds(elements.retrievedAt());
        if (elements.publishedAt() != null) requireMicroseconds(elements.publishedAt());
        OrbitalElementSet parsed = parser.parse(elements.line1(), elements.line2(), elements.retrievedAt(),
                elements.provider(), elements.upstreamOrigin(), elements.sourceUri());
        if (parsed.catalogNumber() != elements.catalogNumber()
                || !parsed.sourceFormat().equals(elements.sourceFormat())
                || !parsed.elementEpoch().equals(elements.elementEpoch())
                || !parsed.sha256().equals(elements.sha256())
                || parsed.classification() != elements.classification()) {
            throw new IllegalArgumentException("Orbital element metadata differs from validated TLE");
        }
    }

    private static void requireMicroseconds(Instant time) {
        if (time.getNano() % 1_000 != 0) {
            throw new IllegalArgumentException("PostgreSQL timestamptz requires microsecond-aligned instants");
        }
    }

    private static OffsetDateTime utc(Instant instant) {
        return instant == null ? null : OffsetDateTime.ofInstant(instant, ZoneOffset.UTC);
    }

    private static Instant instant(ResultSet rs, String column) throws SQLException {
        return rs.getObject(column, OffsetDateTime.class).toInstant();
    }

    private static Instant instantOrNull(ResultSet rs, String column) throws SQLException {
        OffsetDateTime value = rs.getObject(column, OffsetDateTime.class);
        return value == null ? null : value.toInstant();
    }
}
