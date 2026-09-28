package org.mission1;

import java.time.Clock;

import org.mission1.orbital.propagation.OrekitData;
import org.mission1.orbital.propagation.OrekitOrbitalPropagator;
import org.mission1.orbital.propagation.TleElementParser;
import org.mission1.source.orbital.celestrak.CelesTrakOrbitalElementsSource;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Spring wires the boundaries; calculation and domain types stay framework independent. */
@Configuration
class OrbitalConfiguration {
    @Bean OrekitData orekitData() { return new OrekitData(); }
    @Bean TleElementParser tleElementParser(OrekitData data) { return new TleElementParser(data); }
    @Bean OrekitOrbitalPropagator orbitalPropagator(OrekitData data, TleElementParser parser) {
        return new OrekitOrbitalPropagator(data, parser);
    }
    @Bean CelesTrakOrbitalElementsSource celesTrakSource(TleElementParser parser) {
        return new CelesTrakOrbitalElementsSource(Clock.systemUTC(), parser);
    }
}
