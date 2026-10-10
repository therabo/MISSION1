package org.mission1.crew.automatic;

import java.text.Normalizer;
import java.util.*;
import java.util.regex.*;
import org.jsoup.parser.Parser;

/** Research V2 name/alias and lexical extraction. Context text never qualifies as biography. */
public final class IdentityFeatures {
  private final FrozenIdentityModel model;

  public IdentityFeatures(FrozenIdentityModel model) {
    this.model = model;
  }

  private static final String CYR = "абвгдеёзийклмнопрстуфхцчшщъыьэюя";
  private static final String[] LAT = {
    "a", "b", "v", "g", "d", "e", "yo", "z", "i", "y", "k", "l", "m", "n", "o", "p", "r", "s", "t",
    "u", "f", "kh", "ts", "ch", "sh", "shch", "", "y", "", "e", "yu", "ya"
  };

  public static List<String> tokens(String value) {
    var s = new StringBuilder();
    for (char c :
        Parser.unescapeEntities(value == null ? "" : value, false)
            .toLowerCase(Locale.ROOT)
            .toCharArray()) {
      int i = CYR.indexOf(c);
      s.append(i < 0 ? String.valueOf(c) : LAT[i]);
    }
    String ascii = Normalizer.normalize(s, Normalizer.Form.NFKD).replaceAll("[^\\x00-\\x7F]", "");
    return Pattern.compile("[a-z]+").matcher(ascii).results().map(MatchResult::group).toList();
  }

  public static String canonical(String s) {
    return s.replace("ei", "ey")
        .replace("ii", "y")
        .replace("ia", "ya")
        .replace("aleksandr", "alexander")
        .replace("petr", "pyotr");
  }

  public static Set<String> years(String s) {
    Set<String> out = new TreeSet<>();
    for (String regex :
        List.of(
            "(?:selected|selection|recruited|joined)[^.]{0,90}?\\b((?:19|20)\\d{2})\\b",
            "class of ((?:19|20)\\d{2})")) {
      var m = Pattern.compile(regex, Pattern.CASE_INSENSITIVE).matcher(s);
      while (m.find()) out.add(m.group(1));
    }
    return out;
  }

  public static Set<String> missions(String s) {
    Set<String> out = new TreeSet<>();
    var m =
        Pattern.compile(
                "(?:Crew[- ]\\d+|STS[- ]\\d+|Soyuz[- ](?:MS|TMA)[- ]\\d+|Apollo[- ]\\d+|Artemis[-"
                    + " ](?:II|III|IV))",
                Pattern.CASE_INSENSITIVE)
            .matcher(s);
    while (m.find()) out.add(m.group().toUpperCase(Locale.ROOT).replace(' ', '-'));
    return out;
  }

  public static List<String> aliases(String name, String bio) {
    List<String> out = new ArrayList<>(List.of(name));
    var m = Pattern.compile("\\(([А-Яа-яЁё ]{5,100})\\)").matcher(bio);
    while (m.find() && out.size() < 16) out.add(m.group(1));
    return out;
  }

  /** Python difflib.SequenceMatcher longest-block recursion; names are below its autojunk size. */
  public static double similarity(String a, String b) {
    if (a.equals(b)) return 1;
    if (a.isEmpty() || b.isEmpty()) return 0;
    return 2.0 * matches(a, b, 0, a.length(), 0, b.length()) / (a.length() + b.length());
  }

  private static int matches(String a, String b, int alo, int ahi, int blo, int bhi) {
    int ai = alo, bj = blo, best = 0;
    int[] prev = new int[bhi - blo + 1];
    for (int i = alo; i < ahi; i++) {
      int[] row = new int[prev.length];
      for (int j = blo; j < bhi; j++)
        if (a.charAt(i) == b.charAt(j)) {
          int k = prev[j - blo] + 1;
          row[j - blo + 1] = k;
          if (k > best) {
            best = k;
            ai = i - k + 1;
            bj = j - k + 1;
          }
        }
      prev = row;
    }
    if (best == 0) return 0;
    return best
        + (alo < ai && blo < bj ? matches(a, b, alo, ai, blo, bj) : 0)
        + (ai + best < ahi && bj + best < bhi ? matches(a, b, ai + best, ahi, bj + best, bhi) : 0);
  }

  public static double[] names(IdentityEvidence a, IdentityEvidence b) {
    double[] best = new double[6];
    boolean chosen = false;
    for (String aa : a.aliases())
      for (String bb : b.aliases()) {
        var ta = tokens(aa);
        var tb = tokens(bb);
        if (ta.isEmpty() || tb.isEmpty()) continue;
        var sa = new HashSet<>(ta);
        var sb = new HashSet<>(tb);
        var union = new HashSet<>(sa);
        union.addAll(sb);
        var inter = new HashSet<>(sa);
        inter.retainAll(sb);
        var tc = ta.stream().map(IdentityFeatures::canonical).toList();
        var td = tb.stream().map(IdentityFeatures::canonical).toList();
        var reverse = new ArrayList<>(td);
        Collections.reverse(reverse);
        double[] z = {
          String.join(" ", ta).equals(String.join(" ", tb)) ? 1 : 0,
          sa.containsAll(sb) || sb.containsAll(sa) ? 1 : 0,
          (double) inter.size() / union.size(),
          Math.max(
              similarity(String.join(" ", tc), String.join(" ", td)),
              similarity(String.join(" ", tc), String.join(" ", reverse))),
          td.stream().mapToDouble(t -> similarity(tc.getFirst(), t)).max().orElse(0),
          td.stream().mapToDouble(t -> similarity(tc.getLast(), t)).max().orElse(0)
        };
        if (!chosen || z[1] > best[1] || z[1] == best[1] && z[3] > best[3]) {
          best = z;
          chosen = true;
        }
      }
    return best;
  }

  public double[] extract(IdentityEvidence ll2, IdentityEvidence nasa) {
    double[] z = Arrays.copyOf(names(ll2, nasa), 13);
    z[6] = ll2.agency() != null && ll2.agency().equals(nasa.agency()) ? 1 : 0;
    boolean day =
        ll2.dob() != null
            && nasa.dob() != null
            && !ll2.dob().endsWith("-01-01")
            && !nasa.dob().endsWith("-01-01");
    z[7] = day && ll2.dob().equals(nasa.dob()) ? 1 : 0;
    z[8] = day && !ll2.dob().equals(nasa.dob()) ? 1 : 0;
    z[9] = Collections.disjoint(ll2.selections(), nasa.selections()) ? 0 : 1;
    z[10] = Collections.disjoint(ll2.missions(), nasa.missions()) ? 0 : 1;
    z[11] = model.cosine(ll2, nasa);
    z[12] = 0; // no retained verified official cross-provider personnel bridge
    return z;
  }
}
