package org.mission1;

import java.time.Clock;
import java.time.Duration;

import org.mission1.orbital.propagation.OrekitData;
import org.mission1.orbital.propagation.OrekitOrbitalPropagator;
import org.mission1.orbital.propagation.TleElementParser;
import org.mission1.orbital.application.OrbitalFreshnessPolicy;
import org.mission1.orbital.application.OrbitalQualityEvaluator;
import org.mission1.orbital.application.CurrentOrbitalStateService;
import org.mission1.orbital.application.OrbitalElementSetRepository;
import org.mission1.orbital.application.CelesTrakRefreshPolicy;
import org.mission1.orbital.application.CelesTrakRefreshService;
import org.mission1.orbital.application.CelesTrakRequestStore;
import org.mission1.orbital.application.CelesTrakSourceHealthTracker;
import org.mission1.orbital.application.OrbitalSampleWindowService;
import org.mission1.source.orbital.celestrak.CelesTrakOrbitalElementsSource;
import org.mission1.orbital.oem.NasaOemRepository;
import org.mission1.orbital.oem.NasaOemTrajectoryService;
import org.mission1.source.orbital.nasa.NasaOemSource;
import org.mission1.source.orbital.nasa.NasaOemXmlParser;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.TaskScheduler;

/** Spring wires the boundaries; calculation and domain types stay framework independent. */
@Configuration
@EnableScheduling
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
                                                               OrbitalQualityEvaluator evaluator, Clock utcClock,
                                                               CelesTrakSourceHealthTracker health) {
        return new CurrentOrbitalStateService(repository, evaluator, utcClock, health);
    }
    @Bean CelesTrakOrbitalElementsSource celesTrakSource(Clock utcClock, TleElementParser parser) {
        return new CelesTrakOrbitalElementsSource(utcClock, parser);
    }
    @Bean OrbitalSampleWindowService orbitalSampleWindowService(OrbitalElementSetRepository repository,
            OrekitOrbitalPropagator propagator, OrbitalQualityEvaluator evaluator,
            CelesTrakSourceHealthTracker health, Clock utcClock) {
        return new OrbitalSampleWindowService(repository, propagator, evaluator, health, utcClock);
    }
    @Bean CelesTrakSourceHealthTracker celesTrakSourceHealthTracker() {
        return new CelesTrakSourceHealthTracker();
    }
    @Bean NasaOemXmlParser nasaOemXmlParser() { return new NasaOemXmlParser(); }
    @Bean NasaOemSource nasaOemSource() { return new NasaOemSource(); }
    @Bean NasaOemTrajectoryService nasaOemTrajectoryService(NasaOemRepository repository,
            NasaOemSource source, NasaOemXmlParser parser, OrekitData data, Clock utcClock) {
        return new NasaOemTrajectoryService(repository, source, parser, data, utcClock);
    }
    @Bean CelesTrakRefreshPolicy celesTrakRefreshPolicy(
            @Value("${mission1.orbital.celestrak.refresh.interval:PT2H10M}") Duration interval) {
        return new CelesTrakRefreshPolicy(interval);
    }
    @Bean CelesTrakRefreshService celesTrakRefreshService(OrbitalElementSetRepository repository,
            CelesTrakOrbitalElementsSource source, CelesTrakRefreshPolicy policy,
            CelesTrakSourceHealthTracker health, Clock utcClock, CelesTrakRequestStore requests) {
        return new CelesTrakRefreshService(repository, source, policy, health, utcClock, requests);
    }
    @Bean
    @ConditionalOnProperty(name = "mission1.orbital.celestrak.refresh.enabled", havingValue = "true", matchIfMissing = true)
    CelesTrakRefreshScheduler celesTrakRefreshScheduler(CelesTrakRefreshService service,
                                                      TaskScheduler scheduler, Clock utcClock) {
        return new CelesTrakRefreshScheduler(service, scheduler, utcClock);
    }
}
