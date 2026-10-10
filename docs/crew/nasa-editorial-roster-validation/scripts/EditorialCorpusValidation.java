import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.nio.file.*;
import java.util.*;
import org.mission1.source.crew.CrewHttpReader;
import org.mission1.source.crew.nasa.NasaEditorialParser;

/** Offline production-parser validation over the external full 75-page research corpus. */
public class EditorialCorpusValidation {
  public static void main(String[] args) throws Exception {
    var json=JsonMapper.builder().findAndAddModules().build();var parser=new NasaEditorialParser(json);var rows=new ArrayList<Map<String,Object>>();
    for(int number=1;number<=75;number++) {
      var bytes=Files.readAllBytes(Path.of(args[0],"expedition-"+number+".json"));var n=parser.json(bytes);var parsed=parser.roster(n,number);
      var without=n.deepCopy();var dom=NasaEditorialParser.dom(n.path("content").path("rendered").asText());dom.select("[class]").removeAttr("class");
      ((ObjectNode)without.path("content")).put("rendered",dom.html());
      if(!parsed.equals(parser.roster(without,number))) throw new IllegalStateException("Class removal changed Expedition "+number);
      rows.add(Map.of("expedition",number,"members",parsed.members().size(),"sourceSha256",CrewHttpReader.sha256(bytes),"withoutCssClasses","PASS"));
    }
    Files.writeString(Path.of(args[1]),json.writerWithDefaultPrettyPrinter().writeValueAsString(Map.of("result","PASS","fullPages",75,"classRemovedFullPages",75,"pages",rows))+"\n");
  }
}
