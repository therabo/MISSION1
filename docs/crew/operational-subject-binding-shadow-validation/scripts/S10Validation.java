import java.nio.file.*;
import java.util.*;
import java.time.*;
import java.lang.reflect.*;
import java.sql.Connection;
import javax.sql.DataSource;
import java.net.URI;
import java.net.http.*;
import org.springframework.boot.*;
import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.jdbc.core.JdbcTemplate;
import com.fasterxml.jackson.databind.*;
import org.mission1.Mission1Application;
import org.mission1.crew.operational.*;
import org.mission1.crew.automatic.FrozenIdentityModel;
import org.mission1.crew.membership.*;
import org.mission1.api.crew.CrewRestQueryService;
import net.bytebuddy.ByteBuddy;
import net.bytebuddy.agent.ByteBuddyAgent;
import net.bytebuddy.asm.Advice;
import net.bytebuddy.dynamic.loading.ClassReloadingStrategy;
import static net.bytebuddy.matcher.ElementMatchers.*;

/** Explicit validation runner, never a runtime service. Official raw captures have no human crosswalk. */
public class S10Validation {
  static volatile boolean auditSql;
  static List<String> statements=Collections.synchronizedList(new ArrayList<>());
  static List<Boolean> readOnly=Collections.synchronizedList(new ArrayList<>());
  static Path root=Path.of("/Users/daniel/.codex/exports/mission1-s10-shadow");
  static Object invoke(Method method,Object target,Object[] args)throws Throwable {
    try{return method.invoke(target,args);}catch(InvocationTargetException e){throw e.getCause();}
  }
  public static class Counter {
    @Advice.OnMethodEnter public static void count(@Advice.Origin("#t.#m") String method) {
      if(!"true".equals(System.getProperty("mission1audit.active")))return;
      String key=method.contains("FrozenIdentityModel")?"score":method.contains("OperationalResolver")?"s10":method.contains("ActiveMembershipStore")?"v10":"network";
      synchronized(System.getProperties()) {
        String p="mission1audit."+key;System.setProperty(p,Long.toString(Long.parseLong(System.getProperty(p,"0"))+1));
      }
    }
  }
  public static class NetworkCounter {
    @Advice.OnMethodEnter public static void count(@Advice.Argument(0) HttpRequest request) {
      if(!"true".equals(System.getProperty("mission1audit.active")) || List.of("127.0.0.1","localhost","::1").contains(request.uri().getHost()))return;
      synchronized(System.getProperties()) {String key="mission1audit.socketHTTP";System.setProperty(key,Long.toString(Long.parseLong(System.getProperty(key,"0"))+1));}
    }
  }
  static void counters() {
    ByteBuddyAgent.install();
    var types=Map.of(FrozenIdentityModel.class,"score",OperationalResolver.class,"evaluate",ActiveMembershipStore.class,"materialize",
        org.mission1.source.crew.CrewHttpReader.class,"fetch",org.mission1.source.crew.nasa.NasaEditorialHttp.class,"fetch",
        org.mission1.source.crew.nasa.NasaOperationalFeedHttpSource.class,"fetch",org.mission1.source.crew.nasa.NasaCrewArticleReader.class,"read",
        org.mission1.source.crew.nasa.OperationalResourceHttp.class,"fetch");
    try {
      var facade=Class.forName("jdk.internal.net.http.HttpClientFacade");
      new ByteBuddy().redefine(facade).visit(Advice.to(NetworkCounter.class).on(named("send").or(named("sendAsync")))).make().load(facade.getClassLoader(),ClassReloadingStrategy.fromInstalledAgent());
    }catch(Exception e){throw new IllegalStateException("HTTP trace instrumentation",e);}
    types.forEach((type,method)->new ByteBuddy().redefine(type).visit(Advice.to(Counter.class).on(named(method))).make().load(type.getClassLoader(),ClassReloadingStrategy.fromInstalledAgent()));
  }
  static void write(ObjectMapper json,String name,Object data)throws Exception {
    Files.writeString(root.resolve(name+".json"),json.writerWithDefaultPrettyPrinter().writeValueAsString(data)+"\n");
  }
  public static void main(String[] args)throws Exception {
    counters();var app=new SpringApplication(Mission1Application.class);
    app.addInitializers(c->c.getBeanFactory().addBeanPostProcessor(new BeanPostProcessor(){public Object postProcessAfterInitialization(Object bean,String name){
      if(!(bean instanceof DataSource ds))return bean;
      return Proxy.newProxyInstance(DataSource.class.getClassLoader(),new Class[]{DataSource.class},(p,m,a)->{
        var result=invoke(m,ds,a);
        if(result instanceof Connection conn && m.getName().equals("getConnection"))return Proxy.newProxyInstance(Connection.class.getClassLoader(),new Class[]{Connection.class},(pp,mm,aa)->{
          if(auditSql && mm.getName().equals("prepareStatement")){statements.add((String)aa[0]);readOnly.add(conn.isReadOnly());}
          return invoke(mm,conn,aa);});return result;});}}));
    try(var ctx=app.run("--server.port=8081","--mission1.orbital.celestrak.refresh.enabled=false","--mission1.crew.ingestion.enabled=false","--mission1.crew.verification.enabled=false",
        "--mission1.crew.refresh.event-aware.enabled=false","--mission1.crew.editorial.enabled=false","--mission1.crew.automatic-shadow.enabled=false","--mission1.crew.active-shadow.enabled=false",
        "--mission1.crew.operational-shadow.enabled=false","--mission1.crew.identity.review-mode=OFF","--mission1.crew.occurrences.backfill-mode=OFF")) {
      var jdbc=ctx.getBean(JdbcTemplate.class);var json=ctx.getBean(ObjectMapper.class);var worker=ctx.getBean(OperationalBindingWorker.class);
      var inputs=ctx.getBean(RetainedOperationalInputs.class);var store=ctx.getBean(OperationalBindingStore.class);
      if(!jdbc.queryForObject("SELECT current_database()",String.class).equals("mission1"))throw new IllegalStateException("Wrong database");
      var report=new LinkedHashMap<String,Object>();report.put("at",Instant.now());
      auditSql=true;statements.clear();var cold=worker.evaluate();auditSql=false;
      report.put("cold",cold);report.put("coldSql",statements.size());
      // Import untouched official captures already acquired by the read-only investigation, not fixtures or labels.
      Path investigation=Path.of("/Users/daniel/.codex/exports/mission1-operational-subject-resolution-investigation");
      var manifest=json.readTree(investigation.resolve("evidence/live-source-manifest.json").toFile());
      var imports=new ArrayList<Map<String,Object>>();
      for(var n:manifest) {
        if(args.length>0 && args[0].equals("repeat"))continue;
        if(!n.path("success").asBoolean())continue;
        String url=n.path("url").asText(),category=n.path("resourceCategory").asText();
        if(!(Set.of("inline-person-target","person-biography","advertised-person-resource","agency-person-biography","ll2-detailed-person").contains(category)
            || url.equals("https://www.gctc.ru/main.php?id=154") || url.matches("https://www.nasa.gov/wp-json/wp/v2/mission/(939897|992288)")))continue;
        try{OperationalResources.allowed(url);}catch(IllegalArgumentException e){continue;}
        byte[] body=Files.readAllBytes(investigation.resolve(n.path("body").asText()));
        if(!org.mission1.source.crew.CrewHttpReader.sha256(body).equals(n.path("contentHash").asText()))throw new IllegalStateException("Original capture hash");
        var redirects=new ArrayList<String>();for(var hop:n.path("redirects"))redirects.add(hop.isTextual()?hop.asText():hop.path("location").asText());
        var capture=new OperationalResources.Capture(url,n.path("finalUrl").asText(),redirects,Instant.parse(n.path("capturedAt").asText()),n.path("status").asInt(),n.path("contentType").asText(),null,body);
        Long retained=store.retain(capture,Instant.parse(n.path("completedAt").asText()));
        var entry=new LinkedHashMap<String,Object>();entry.put("url",url);entry.put("hash",capture.hash());entry.put("retained",retained);entry.put("bytes",body.length);imports.add(entry);
      }
      report.put("imports",imports);
      auditSql=true;statements.clear();var enriched=worker.evaluate();auditSql=false;
      if(enriched.subjects()==0) {
        jdbc.update("UPDATE crew_operational_binding_work SET next_at='epoch'");
        auditSql=true;statements.clear();enriched=worker.evaluate();auditSql=false;
      }
      report.put("enriched",enriched);report.put("enrichedSql",statements.size());
      if(enriched.subjects()!=25 || enriched.matches()!=25)throw new IllegalStateException("Actual cohort deviation: "+enriched.subjects()+"/"+enriched.matches()+" "+enriched.evaluations().stream().filter(e->e.outcome()!=OperationalBinding.Outcome.AUTO_MATCH).map(e->e.subject().name()+":"+e.reasons()).toList());
      var batch=inputs.load(Instant.now());var resolver=new OperationalResolver(FrozenIdentityModel.load(json),OperationalPolicy.SHADOW);
      var warm=new ArrayList<Double>();var queries=new ArrayList<Integer>();
      for(int i=0;i<10;i++){auditSql=true;statements.clear();long start=System.nanoTime();inputs.load(Instant.now());warm.add((System.nanoTime()-start)/1e6);queries.add(statements.size());auditSql=false;}
      report.put("warmFactLoadMillis",warm);report.put("warmFactLoadSql",queries);
      var batchTimes=new ArrayList<Double>();for(int i=0;i<10;i++){long start=System.nanoTime();for(var s:batch.subjects())resolver.evaluate(s,batch.resources(),Instant.now(),batch.complete());batchTimes.add((System.nanoTime()-start)/1e6);}report.put("warm25PureBatchMillis",batchTimes);
      var compare=new OperationalShadowComparison(ctx.getBean(ActiveMembershipPolicy.class)).compare(ctx.getBean(RetainedMembershipInputs.class).load(Instant.now()),enriched.evaluations(),Instant.now());
      write(json,"differential",compare);
      // Force only mutable work eligibility to simulate a process restart; immutable inputs/targets remain untouched.
      jdbc.update("UPDATE crew_operational_binding_work SET next_at='epoch'");
      var repeat=worker.evaluate();report.put("restart",repeat);
      if(repeat.inserted()!=0)throw new IllegalStateException("Restart duplicated revisions");
      // Real HTTP requests are served by this instrumented application; collectors are enabled only during reads.
      var current=json.readTree(root.resolve("baseline-current.json").toFile());var urls=new ArrayList<String>();urls.add("/api/iss/crew");
      for(var m:current.path("members"))urls.add("/api/iss/crew/"+m.path("id").asText());
      for(String id:List.of("4cb06b5a-b94c-4ea8-9d66-8f54cd6a0bf2","2425a25d-fc4c-40ab-b1b3-1b88cd3ce3ed","e0ead20d-bbb0-4a6e-8da8-bf6b857a68b5","9735513f-4ad9-44ba-863d-4f05978fca61","9cd14c46-8b34-41b7-9fec-5ea736fa974b","b4932ff9-75e7-4eb4-b8c1-0362acb27356"))urls.add("/api/iss/crew/"+id);
      for(String at:List.of("2026-10-01T12:00:00Z","2026-10-03T12:04:00Z","2026-10-10T12:00:00Z"))urls.add("/api/iss/replay?at="+at.replace(":","%3A"));
      var responses=new LinkedHashMap<String,Object>();var getSql=new ArrayList<Integer>();var getMillis=new ArrayList<Double>();var http=HttpClient.newHttpClient();
      for(String k:List.of("score","s10","v10","network","socketHTTP"))System.setProperty("mission1audit."+k,"0");
      System.setProperty("mission1audit.active","true");auditSql=true;
      for(String url:urls){statements.clear();readOnly.clear();long start=System.nanoTime();var response=http.send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:8081"+url)).GET().build(),HttpResponse.BodyHandlers.ofByteArray());getMillis.add((System.nanoTime()-start)/1e6);getSql.add(statements.size());
        if(response.statusCode()!=200)throw new IllegalStateException("GET "+url+" = "+response.statusCode());
        if(statements.stream().anyMatch(s->!s.stripLeading().toUpperCase(Locale.ROOT).startsWith("SELECT")) || readOnly.contains(false))throw new IllegalStateException("Non-read-only GET SQL");
        responses.put(url,Map.of("status",response.statusCode(),"body",json.readTree(response.body())));
      }
      var rest=ctx.getBean(CrewRestQueryService.class);var currentSql=new ArrayList<Integer>();var currentMillis=new ArrayList<Double>();
      for(int i=0;i<20;i++){statements.clear();long start=System.nanoTime();rest.crew();currentMillis.add((System.nanoTime()-start)/1e6);currentSql.add(statements.size());}
      System.setProperty("mission1audit.active","false");auditSql=false;
      report.put("getSql",getSql);report.put("getMillis",getMillis);report.put("currentSql",currentSql);report.put("currentMillis",currentMillis);
      var counts=new TreeMap<String,Long>();for(String k:List.of("score","s10","v10","network","socketHTTP")){long count=Long.parseLong(System.getProperty("mission1audit."+k));counts.put(k,count);if(count!=0)throw new IllegalStateException("GET invoked "+k);}
      report.put("getInvocations",counts);report.put("getWrites",0);write(json,"after-http",Map.of("responses",responses));
      report.put("rowCounts",jdbc.queryForList("SELECT relname,n_live_tup FROM pg_stat_user_tables WHERE relname LIKE 'crew_operational_%' ORDER BY relname"));
      report.put("sizes",jdbc.queryForList("SELECT relname,pg_total_relation_size(relid) bytes FROM pg_stat_user_tables WHERE relname LIKE 'crew_operational_%' ORDER BY relname"));
      report.put("latestBindingExplain",jdbc.queryForList("EXPLAIN (ANALYZE,BUFFERS) SELECT DISTINCT ON(binding_key) id FROM crew_operational_binding_revision ORDER BY binding_key,id DESC"));
      write(json,"runtime-validation",report);System.out.println("S10_ACTUAL_PASS subjects=25 matches=25 restartInserted=0 GETwrites=0 counters="+counts);
    }
  }
}
