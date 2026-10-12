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
            CrewIdentityRepository identities,
            org.mission1.crew.membership.RetainedMembershipInputs inputs,
            org.mission1.crew.membership.ActiveMembershipPolicy lifecycle,
            CrewReadQueryService read,
            @Value("${mission1.replay.crew.mode:UNIFIED_V10_S10}") String mode) {
        if (!java.util.Set.of("UNIFIED_V10_S10", "LEGACY").contains(mode)) {
            throw new IllegalArgumentException("Known Crew Replay mode required");
        }
        var replay = new CrewReplayQueryService(
                h, r, v, p, mode.equals("LEGACY") ? policy.forReplay() : policy, identities);
        return mode.equals("LEGACY")
                ? replay
                : replay.unified(new UnifiedCrewReplay(inputs, lifecycle, read, r, v));
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
