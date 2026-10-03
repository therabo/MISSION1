import java.nio.file.*;
import java.time.*;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.mission1.api.*;
import org.mission1.orbital.application.*;
import org.mission1.orbital.propagation.*;
import org.mission1.orbital.persistence.*;
import org.mission1.orbital.oem.*;
import org.mission1.source.orbital.nasa.*;
class TrajectoryScreenshotCapture {
 public static void main(String[] args) throws Exception {
  var ds=new DriverManagerDataSource(System.getenv("MISSION1_CAPTURE_JDBC_URL"),System.getenv("MISSION1_CAPTURE_JDBC_USER"),System.getenv("MISSION1_CAPTURE_JDBC_PASSWORD")) {
   @Override public java.sql.Connection getConnection() throws java.sql.SQLException {
    var connection=super.getConnection();connection.setReadOnly(true);connection.setAutoCommit(false);return connection;
   }
  };
  var jdbc=new JdbcTemplate(ds);var data=new OrekitData();var parser=new TleElementParser(data);
  var repo=new JdbcOrbitalElementSetRepository(jdbc,parser);var prop=new OrekitOrbitalPropagator(data,parser);
  var clock=Clock.fixed(Instant.parse("2026-10-02T22:27:11Z"),ZoneOffset.UTC);
  var service=new OrbitalSampleWindowService(repo,prop,new OrbitalQualityEvaluator(prop,OrbitalFreshnessPolicy.standardGpCurrent()),new CelesTrakSourceHealthTracker(),clock);
  var stored=new JdbcNasaOemRepository(jdbc).latest();
  var snapshot=stored.orElseThrow(() -> new IllegalStateException("Persisted OEM required; capture never fetches"));
  if (!clock.instant().isBefore(snapshot.retrievedAt().plus(Duration.ofHours(2))))
   throw new IllegalStateException("Cached OEM is too old for a capture without fetching");
  new NasaOemXmlParser().parse(snapshot.xml());
  NasaOemRepository oemRepo=new NasaOemRepository(){public Optional<Stored> latest(){return stored;}public void store(NasaOemDocument d,byte[] x,Instant r,Instant m){throw new IllegalStateException("Read-only capture");}};
  var oem=new NasaOemTrajectoryService(oemRepo,new NasaOemSource(),new NasaOemXmlParser(),data,clock);
  var mapper=new ObjectMapper().registerModule(new JavaTimeModule()).disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
  Path out=Path.of(args[0]);Files.createDirectories(out);
  var shortWindow=OrbitalSamplesResponse.from(service.generate(new OrbitalSampleWindow(120,600,10)));
  mapper.writeValue(out.resolve("real-samples.json").toFile(),shortWindow);
  var full=service.generateFullOrbit();var comparison=OrbitalComparisonResponse.from(full,oem.comparison(full));
  mapper.writeValue(out.resolve("real-comparison.json").toFile(),comparison);
  System.out.println(shortWindow.currentGeodetic());System.out.println(shortWindow.source());System.out.println(comparison.oem().source());
 }
}
