package org.mission1.orbital.domain;

/** Stable reasons for the current orbital quality decision. */
public enum OrbitalQualityReason {
    NONE,
    NO_ORBITAL_ELEMENTS,
    INVALID_ORBITAL_ELEMENTS,
    EOP_DATA_UNAVAILABLE,
    PROPAGATION_FAILED,
    TRANSFORMATION_FAILED,
    ELEMENT_TOO_OLD,
    ELEMENT_EPOCH_IN_FUTURE,
    NOT_CURRENT_EVALUATION
}
