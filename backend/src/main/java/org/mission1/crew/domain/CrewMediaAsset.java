package org.mission1.crew.domain;

import java.net.URI;
/** Nullable rights metadata means unknown, never permission to mirror/reuse. */
public record CrewMediaAsset(URI url, URI thumbnailUrl, String credit, String licenseName,
        URI licenseUrl, Boolean singleUse) { }
