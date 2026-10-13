package org.mission1.crew.operational;

import com.ibm.icu.text.*;
import com.ibm.icu.util.VersionInfo;
import java.text.Normalizer;
import java.util.*;

/** Generated comparison variants have no authority and are never written to canonical identity aliases. */
public final class OperationalNames {
  public static final String VERSION = "s10-nfkc-casefold-icu78.3-v1";

  private OperationalNames() {}

  public static String normalize(String s) {
    if (s == null || s.length() > 10000) return "";
    return Normalizer2.getNFKCCasefoldInstance()
        .normalize(s)
        .replaceAll("[^\\p{L}\\p{N} ]", "")
        .replaceAll("(?U)\\s+", " ")
        .strip();
  }

  public static String display(String s) {
    return Normalizer.normalize(s, Normalizer.Form.NFC);
  }

  public static String clean(String s) {
    return normalize(s)
        .replaceAll("\\b(nasa|esa|astronaut|candidate|biography|of|dr|phd|md)\\b", "")
        .replaceAll(" +", " ")
        .strip();
  }

  public static List<String> transliterations(String nativeName) {
    if (!VersionInfo.ICU_VERSION.toString().startsWith("78.3"))
      throw new IllegalStateException("ICU release mismatch");
    return List.of(
        Transliterator.getInstance("Any-Latin; Latin-ASCII; Lower()").transliterate(nativeName),
        Transliterator.getInstance("Russian-Latin/BGN; Latin-ASCII; Lower()")
            .transliterate(nativeName));
  }

  public static boolean compatible(String a, String b, boolean shortened) {
    if (b == null || b.matches("(?is).*\\b(and|or)\\b.*") || b.contains("&") || b.contains("/"))
      return false;
    var x = clean(a).split(" ");
    var y = clean(b).split(" ");
    return x.length >= 2
        && y.length >= 2
        && x[x.length - 1].equals(y[y.length - 1])
        && (x[0].equals(y[0])
            || jaro(x[0], y[0]) >= .90
            || shortened && x[0].length() >= 3 && y[0].startsWith(x[0]));
  }

  /** Jaro-Winkler, research retrieval compatibility; never an identity decision. */
  public static double jaro(String a, String b) {
    if (a.equals(b)) return 1;
    if (a.isEmpty() || b.isEmpty()) return 0;
    int radius = Math.max(0, Math.max(a.length(), b.length()) / 2 - 1), matches = 0;
    boolean[] x = new boolean[a.length()], y = new boolean[b.length()];
    for (int i = 0; i < a.length(); i++)
      for (int j = Math.max(0, i - radius); j < Math.min(b.length(), i + radius + 1); j++)
        if (!y[j] && a.charAt(i) == b.charAt(j)) {
          x[i] = true;
          y[j] = true;
          matches++;
          break;
        }
    if (matches == 0) return 0;
    int j = 0, transposed = 0;
    for (int i = 0; i < a.length(); i++)
      if (x[i]) {
        while (!y[j]) j++;
        if (a.charAt(i) != b.charAt(j)) transposed++;
        j++;
      }
    double v =
        (matches / (double) a.length()
                + matches / (double) b.length()
                + (matches - transposed / 2.0) / matches)
            / 3;
    int prefix = 0;
    while (prefix < Math.min(4, Math.min(a.length(), b.length()))
        && a.charAt(prefix) == b.charAt(prefix)) prefix++;
    return v > .7 ? v + prefix * .1 * (1 - v) : v;
  }
}
