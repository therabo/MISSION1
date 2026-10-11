package org.mission1;

import org.mission1.crew.application.*;
import org.mission1.orbital.application.OrbitalElementSetRepository;
import org.mission1.orbital.propagation.*;
import org.mission1.replay.*;
import org.mission1.source.orbital.nasa.NasaOemXmlParser;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;

import java.time.*;

@Configuration
class ReplayConfiguration {
    @Bean
    CrewReplayQueryService crewReplay(
            ReplayHistoryRepository h,
            CrewRepository r,
            CrewVerificationRepository v,
            CrewReadRepository p,
            CrewReconciliationPolicy policy,
            CrewIdentityRepository identities) {
        return new CrewReplayQueryService(h, r, v, p, policy.forReplay(), identities);
    }

    @Bean
    OrbitHistoricalQueryService orbitReplay(
            ReplayHistoryRepository h,
            OrbitalElementSetRepository r,
            OrekitOrbitalPropagator p,
            OrekitData d,
            NasaOemXmlParser x,
            @Value("${mission1.replay.gp-max-offset:PT24H}") Duration max) {
        return new OrbitHistoricalQueryService(h, r, p, d, x, max);
    }

    @Bean
    MissionReplayQueryService missionReplay(
            CrewReplayQueryService c, OrbitHistoricalQueryService o, Clock clock) {
        return new MissionReplayQueryService(c, o, clock);
    }
}
