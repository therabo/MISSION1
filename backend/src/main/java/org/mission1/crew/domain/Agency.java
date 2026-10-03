package org.mission1.crew.domain;

import java.util.List;
public record Agency(String name, String abbreviation, String type, List<ExternalId> externalIds) {
    public Agency { externalIds = List.copyOf(externalIds); }
}
