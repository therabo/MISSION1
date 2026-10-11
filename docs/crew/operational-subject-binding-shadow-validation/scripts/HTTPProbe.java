import java.nio.file.*;
import java.time.*;
import java.util.*;
import org.springframework.boot.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.mission1.Mission1Application;
import org.mission1.crew.operational.*;
import org.mission1.source.crew.nasa.OperationalResourceHttp;
public class HTTPProbe {
 public static void main(String[] args)throws Exception {
  var app=new SpringApplication(Mission1Application.class);app.setWebApplicationType(WebApplicationType.NONE);
  try(var ctx=app.run("--mission1.orbital.celestrak.refresh.enabled=false","--mission1.crew.ingestion.enabled=false","--mission1.crew.verification.enabled=false","--mission1.crew.refresh.event-aware.enabled=false","--mission1.crew.editorial.enabled=false","--mission1.crew.automatic-shadow.enabled=false","--mission1.crew.active-shadow.enabled=false","--mission1.crew.operational-shadow.enabled=false","--mission1.crew.identity.review-mode=OFF","--mission1.crew.occurrences.backfill-mode=OFF")) {
   var capture=ctx.getBean(OperationalResourceHttp.class).fetch("https://www.esa.int/Science_Exploration/Human_and_Robotic_Exploration/Astronauts/Sophie_Adenot");
   var json=ctx.getBean(ObjectMapper.class);var store=ctx.getBean(OperationalBindingStore.class);
   Long resource=store.retain(capture,Instant.now());var result=ctx.getBean(OperationalBindingWorker.class).evaluate();
   var out=new LinkedHashMap<String,Object>();out.put("url",capture.url());out.put("finalUrl",capture.finalUrl());out.put("redirects",capture.redirects());out.put("hash",capture.hash());out.put("capturedAt",capture.capturedAt());out.put("status",capture.status());out.put("error",capture.error());out.put("retained",resource);out.put("worker",result);
   Files.writeString(Path.of("/Users/daniel/.codex/exports/mission1-s10-shadow/live-acquisition.json"),json.writerWithDefaultPrettyPrinter().writeValueAsString(out)+"\n");
   if(capture.error()!=null || resource==null || result.matches()!=25)throw new IllegalStateException("Live acquisition did not converge");
   System.out.println("S10_LIVE_RESOURCE_PASS status="+capture.status()+" workerMatches="+result.matches());
  }
 }
}
