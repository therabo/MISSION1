package org.mission1.orbital.application;

import org.mission1.orbital.domain.OrbitalElementSet;

/** One explicit acquisition; callers decide whether and when to fetch. */
public interface OrbitalElementsSource {
    OrbitalElementSet fetch();
}
