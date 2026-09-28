package org.mission1;

import java.time.Clock;

import org.mission1.orbital.propagation.OrekitData;
import org.mission1.orbital.propagation.OrekitOrbitalPropagator;
import org.mission1.orbital.propagation.TleElementParser;
import org.mission1.orbital.application.OrbitalFreshnessPolicy;
import org.mission1.orbital.application.OrbitalQualityEvaluator;
import org.mission1.orbital.application.CurrentOrbitalStateService;
import org.mission1.orbital.application.OrbitalElementSetRepository;
import org.mission1.source.orbital.celestrak.CelesTrakOrbitalElementsSource;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Spring wires the boundaries; calculation and domain types stay framework independent. */
@Configuration
class OrbitalConfiguration {
    @Bean Clock utcClock() { return Clock.systemUTC(); }
    @Bean OrekitData orekitData() { return new OrekitData(); }
    @Bean TleElementParser tleElementParser(OrekitData data) { return new TleElementParser(data); }
    @Bean OrekitOrbitalPropagator orbitalPropagator(OrekitData data, TleElementParser parser) {
        return new OrekitOrbitalPropagator(data, parser);
    }
    @Bean OrbitalFreshnessPolicy orbitalFreshnessPolicy() {
        return OrbitalFreshnessPolicy.standardGpCurrent();
    }
    @Bean OrbitalQualityEvaluator orbitalQualityEvaluator(OrekitOrbitalPropagator propagator,
                                                         OrbitalFreshnessPolicy policy) {
        return new OrbitalQualityEvaluator(propagator, policy);
    }
    @Bean CurrentOrbitalStateService currentOrbitalStateService(OrbitalElementSetRepository repository,
                                                               OrbitalQualityEvaluator evaluator, Clock utcClock) {
        return new CurrentOrbitalStateService(repository, evaluator, utcClock);
    }
    @Bean CelesTrakOrbitalElementsSource celesTrakSource(Clock utcClock, TleElementParser parser) {
        return new CelesTrakOrbitalElementsSource(utcClock, parser);
    }
}
