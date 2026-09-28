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
import org.mission1.orbital.application.CelesTrakSourceHealthTracker;
import org.mission1.source.orbital.celestrak.CelesTrakOrbitalElementsSource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

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
    @Bean CelesTrakSourceHealthTracker celesTrakSourceHealthTracker() {
        return new CelesTrakSourceHealthTracker();
    }
    @Bean CelesTrakRefreshPolicy celesTrakRefreshPolicy(
            @Value("${mission1.orbital.celestrak.refresh.interval:PT2H10M}") Duration interval,
            @Value("${mission1.orbital.celestrak.refresh.initial-delay:PT2H10M}") Duration initialDelay) {
        CelesTrakRefreshPolicy policy = new CelesTrakRefreshPolicy(interval);
        if (initialDelay.compareTo(interval) < 0) {
            throw new IllegalArgumentException("Initial delay must be at least the CelesTrak refresh interval");
        }
        return policy;
    }
    @Bean CelesTrakRefreshService celesTrakRefreshService(OrbitalElementSetRepository repository,
            CelesTrakOrbitalElementsSource source, CelesTrakRefreshPolicy policy,
            CelesTrakSourceHealthTracker health, Clock utcClock) {
        return new CelesTrakRefreshService(repository, source, policy, health, utcClock);
    }
    @Bean
    @ConditionalOnProperty(name = "mission1.orbital.celestrak.refresh.enabled", havingValue = "true", matchIfMissing = true)
    CelesTrakRefreshScheduler celesTrakRefreshScheduler(CelesTrakRefreshService service) {
        return new CelesTrakRefreshScheduler(service);
    }
}
