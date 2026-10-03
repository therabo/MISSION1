package org.mission1.crew.domain;

/** Missing country codes remain null; an empty list is not proof of statelessness. */
public record Nationality(String alpha2, String alpha3, String displayName) { }
