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
import org.mission1.crew.application.*;
import org.mission1.crew.operational.*;
import org.mission1.crew.membership.*;
import net.bytebuddy.ByteBuddy;
import net.bytebuddy.agent.ByteBuddyAgent;
import net.bytebuddy.asm.Advice;
import net.bytebuddy.dynamic.loading.ClassReloadingStrategy;
import static net.bytebuddy.matcher.ElementMatchers.*;

/** External opt-in audit. No source evaluation, acquisition or materialization is executed. */
public class UnifiedFinalAudit {
  static volatile boolean active;
  static List<String> statements=Collections.synchronizedList(new ArrayList<>());
  static List<Boolean> readOnly=Collections.synchronizedList(new ArrayList<>());
  static Path root=Path.of(System.getProperty("mission1.audit.output", System.getProperty("java.io.tmpdir")));
  static Object invoke(Method method,Object target,Object[] args)throws Throwable {
    try{return method.invoke(target,args);}catch(InvocationTargetException e){throw e.getCause();}
  }
  public static class Counter {
    @Advice.OnMethodEnter public static void count(@Advice.Origin("#t.#m") String method) {
      if(!"true".equals(System.getProperty("mission1getaudit.active")))return;
      synchronized(System.getProperties()) {
        String p="mission1getaudit.calls."+method;System.setProperty(p,Long.toString(Long.parseLong(System.getProperty(p,"0"))+1));
      }
    }
  }
  public static class NetworkCounter {
    @Advice.OnMethodEnter public static void count(@Advice.Argument(0) HttpRequest request) {
      if(!"true".equals(System.getProperty("mission1getaudit.active")) || List.of("127.0.0.1","localhost","::1").contains(request.uri().getHost()))return;
      synchronized(System.getProperties()) {String key="mission1getaudit.externalHTTP";System.setProperty(key,Long.toString(Long.parseLong(System.getProperty(key,"0"))+1));}
    }
  }
  static void counters() throws Exception {
    ByteBuddyAgent.install();
    var types=new LinkedHashMap<String,String>();
    types.put("org.mission1.crew.automatic.FrozenIdentityModel","score");
    types.put("org.mission1.crew.automatic.AutomaticIdentityStore","evaluate");
    types.put("org.mission1.crew.automatic.AutomaticIdentityWorker","run");
    types.put("org.mission1.crew.operational.OperationalResolver","evaluate");
    types.put("org.mission1.crew.operational.OperationalBindingWorker","evaluate|acquire");
    types.put("org.mission1.crew.membership.ActiveMembershipStore","materialize");
    types.put("org.mission1.source.crew.CrewHttpReader","fetch");
    types.put("org.mission1.source.crew.nasa.NasaEditorialHttp","fetch");
    types.put("org.mission1.source.crew.nasa.NasaOperationalFeedHttpSource","fetch");
    types.put("org.mission1.source.crew.nasa.NasaCrewArticleReader","read");
    types.put("org.mission1.source.crew.nasa.OperationalResourceHttp","fetch");
    types.put("org.mission1.crew.application.CrewIngestionService","ingest");
    types.put("org.mission1.crew.application.NasaCrewVerificationIngestionService","ingest");
    for(var e:types.entrySet()) {
      for(String method:e.getValue().split("\\|"))System.setProperty("mission1getaudit.calls."+e.getKey()+"."+method,"0");
      var type=Class.forName(e.getKey());
      var match=named(e.getValue().split("\\|")[0]);
      for(String method:e.getValue().split("\\|")) match=match.or(named(method));
      new ByteBuddy().redefine(type).visit(Advice.to(Counter.class).on(match)).make().load(type.getClassLoader(),ClassReloadingStrategy.fromInstalledAgent());
    }
    var facade=Class.forName("jdk.internal.net.http.HttpClientFacade");
    new ByteBuddy().redefine(facade).visit(Advice.to(NetworkCounter.class).on(named("send").or(named("sendAsync")))).make().load(facade.getClassLoader(),ClassReloadingStrategy.fromInstalledAgent());
  }
  static Map<String,Object> fingerprints(JdbcTemplate jdbc) {
    var out=new TreeMap<String,Object>();
    for(String table:jdbc.queryForList("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",String.class)) {
      var q="SELECT count(*) AS count,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) AS hash FROM public.\""+table.replace("\"","\"\"")+"\" t";
      out.put(table,jdbc.queryForMap(q));
    }
    return out;
  }
  static double percentile(List<Double> values,double p) {
    var sorted=new ArrayList<>(values);Collections.sort(sorted);return sorted.get(Math.max(0,(int)Math.ceil(p*sorted.size())-1));
  }
  static Map<String,Long> counts() {
    var map=new TreeMap<String,Long>();
    for(String key:System.getProperties().stringPropertyNames()) if(key.startsWith("mission1getaudit.calls."))map.put(key.substring("mission1getaudit.calls.".length()),Long.parseLong(System.getProperty(key)));
    map.put("externalHTTP",Long.parseLong(System.getProperty("mission1getaudit.externalHTTP","0")));return map;
  }
  public static void main(String[] args)throws Exception {
    String label=args.length==0?"before":args[0];int port=args.length>1?Integer.parseInt(args[1]):8083;
    counters();var app=new SpringApplication(Mission1Application.class);
    app.addInitializers(c->c.getBeanFactory().addBeanPostProcessor(new BeanPostProcessor(){public Object postProcessAfterInitialization(Object bean,String name){
      if(!(bean instanceof DataSource ds))return bean;
      return Proxy.newProxyInstance(DataSource.class.getClassLoader(),new Class[]{DataSource.class},(p,m,a)->{
        var result=invoke(m,ds,a);
        if(result instanceof Connection conn && m.getName().equals("getConnection"))return Proxy.newProxyInstance(Connection.class.getClassLoader(),new Class[]{Connection.class},(pp,mm,aa)->{
          if(active && mm.getName().equals("prepareStatement")){statements.add((String)aa[0]);readOnly.add(conn.isReadOnly());}
          return invoke(mm,conn,aa);});return result;});}}));
    try(var ctx=app.run("--server.port="+port,"--spring.flyway.enabled=false","--mission1.orbital.celestrak.refresh.enabled=false","--mission1.crew.ingestion.enabled=false","--mission1.crew.verification.enabled=false",
        "--mission1.crew.refresh.event-aware.enabled=false","--mission1.crew.editorial.enabled=false","--mission1.crew.automatic-shadow.enabled=false","--mission1.crew.active-shadow.enabled=false",
        "--mission1.crew.operational-shadow.enabled=false","--mission1.crew.identity.review-mode=OFF","--mission1.crew.occurrences.backfill-mode=OFF")) {
      var jdbc=ctx.getBean(JdbcTemplate.class);var json=ctx.getBean(ObjectMapper.class);var report=new LinkedHashMap<String,Object>();report.put("at",Instant.now());report.put("label",label);
      if(!jdbc.queryForObject("SELECT current_database()",String.class).equals("mission1"))throw new IllegalStateException("Wrong database");
      var before=fingerprints(jdbc);report.put("tablesBefore",before);
      var http=HttpClient.newHttpClient();String base="http://127.0.0.1:"+port;
      var initial=http.send(HttpRequest.newBuilder(URI.create(base+"/api/iss/crew")).GET().build(),HttpResponse.BodyHandlers.ofByteArray());
      if(initial.statusCode()!=200)throw new IllegalStateException("Initial roster HTTP "+initial.statusCode());
      var current=json.readTree(initial.body());Files.write(root.resolve(label+"-initial-current.json"),initial.body());
      var detailUrls=new ArrayList<String>();for(var m:current.path("members"))detailUrls.add("/api/iss/crew/"+m.path("id").asText());
      for(String id:List.of("4cb06b5a-b94c-4ea8-9d66-8f54cd6a0bf2","2425a25d-fc4c-40ab-b1b3-1b88cd3ce3ed","e0ead20d-bbb0-4a6e-8da8-bf6b857a68b5","9735513f-4ad9-44ba-863d-4f05978fca61","9cd14c46-8b34-41b7-9fec-5ea736fa974b","b4932ff9-75e7-4eb4-b8c1-0362acb27356"))detailUrls.add("/api/iss/crew/"+id);
      var replayUrls=new ArrayList<String>();for(String at:List.of("2026-10-02T02:01:54Z","2026-10-02T02:01:55Z","2026-10-03T12:04:00Z","2026-10-07T12:04:59Z","2026-10-07T12:05:00Z","2026-10-10T12:00:00Z"))replayUrls.add("/api/iss/replay?at="+at.replace(":","%3A"));
      var seekUrls=new ArrayList<String>();for(int offset:List.of(-20,-10,0,10,20))seekUrls.add("/api/iss/replay?at="+Instant.parse("2026-10-07T12:05:00Z").plusSeconds(offset*60).toString().replace(":","%3A"));
      var groups=new LinkedHashMap<String,List<String>>();groups.put("currentRoster",List.of("/api/iss/crew"));groups.put("currentDetailsIncludingAliases",detailUrls);groups.put("historicalRosterAndEmbeddedDetails",replayUrls);groups.put("historicalSeek10Minutes",seekUrls);groups.put("replayCoverage",List.of("/api/iss/replay/coverage"));
      var realCuts=new ArrayList<String>();
      for(String event:List.of("2026-10-02T02:01:55Z","2026-10-03T10:30:18.796289Z","2026-10-05T17:18:04Z","2026-10-06T17:57:55Z","2026-10-07T12:05:00Z","2026-10-09T16:35:40Z","2026-10-10T12:00:00Z"))
        for(int delta:List.of(-1,0,1))realCuts.add("/api/iss/replay?at="+Instant.parse(event).plusSeconds(delta).toString().replace(":","%3A"));
      groups.put("historical21RealCuts",realCuts);
      var results=new LinkedHashMap<String,Object>();System.setProperty("mission1getaudit.active","true");active=true;
      for(var group:groups.entrySet()) {
        var samples=new ArrayList<Map<String,Object>>();var times=new ArrayList<Double>();var sqlCounts=new ArrayList<Integer>();var bytes=new ArrayList<Integer>();var examples=new LinkedHashMap<String,Object>();
        int rounds=Math.max(20,group.getValue().size()*2);
        for(int i=-5;i<rounds;i++) {
          String url=group.getValue().get(Math.floorMod(i,group.getValue().size()));statements.clear();readOnly.clear();long start=System.nanoTime();
          var response=http.send(HttpRequest.newBuilder(URI.create(base+url)).GET().build(),HttpResponse.BodyHandlers.ofByteArray());double ms=(System.nanoTime()-start)/1e6;
          if(response.statusCode()!=200)throw new IllegalStateException("GET "+url+" = "+response.statusCode()+" "+new String(response.body()));
          if(statements.stream().anyMatch(s->!s.stripLeading().toUpperCase(Locale.ROOT).startsWith("SELECT")) || readOnly.contains(false))throw new IllegalStateException("Non-read-only GET SQL "+url+" "+statements);
          if(i>=0){times.add(ms);sqlCounts.add(statements.size());bytes.add(response.body().length);samples.add(Map.of("url",url,"millis",ms,"queries",statements.size(),"bytes",response.body().length));examples.putIfAbsent(url,Map.of("sql",new ArrayList<>(statements),"readOnly",new ArrayList<>(readOnly),"body",json.readTree(response.body())));}
        }
        results.put(group.getKey(),Map.of("samples",samples,"medianMillis",percentile(times,.5),"p95Millis",percentile(times,.95),"queryCounts",new TreeSet<>(sqlCounts),"payloadBytes",new TreeSet<>(bytes),"examples",examples));
      }
      active=false;System.setProperty("mission1getaudit.active","false");report.put("getMeasurements",results);report.put("getInvocations",counts());
      if(counts().values().stream().anyMatch(n->n!=0))throw new IllegalStateException("GET invocation side effect "+counts());
      var after=fingerprints(jdbc);report.put("tablesAfter",after);report.put("allTablesUnchanged",before.equals(after));if(!before.equals(after))throw new IllegalStateException("GET changed table rows");
      report.put("getWrites",0);report.put("allPreparedQueriesSelectOnly",true);report.put("allGetConnectionsReadOnly",true);report.put("forbiddenMethodInstrumentation",List.of("V9 scoring/evaluation","S10 evaluation/acquisition","V10 materialization","source HTTP/acquisition","actual external Java HTTP send/sendAsync"));
      Files.writeString(root.resolve(label+"-get-audit.json"),json.writerWithDefaultPrettyPrinter().writeValueAsString(report)+"\n");
      System.out.println("GET_AUDIT_PASS label="+label+" groups="+groups.keySet()+" tables="+before.size()+" unchanged=true forbiddenInvocations="+counts());
      var perf=new LinkedHashMap<String,Object>();perf.put("GETPhaseFinishedBeforeMaterialization",true);
      var verification=ctx.getBean(CrewVerificationRepository.class);var known=Instant.now();
      var evidence=new CrewCompatibleVersionSelector().select(verification.evidenceAsOf(known),verification.occurrenceVersionsAsOf(known)).evidence();
      var consumer=ctx.getBean(OperationalProductionBindings.class);
      var lookupTimes=new ArrayList<Double>();var lookupQueries=new TreeSet<Integer>();Map<String,OperationalProductionBindings.Binding> resolved=Map.of();List<String> lookupSql=List.of();
      active=true;System.setProperty("mission1getaudit.active","true");
      for(int i=-5;i<20;i++){statements.clear();readOnly.clear();long begin=System.nanoTime();resolved=consumer.resolve(evidence,known);double millis=(System.nanoTime()-begin)/1e6;
        if(readOnly.contains(false) || statements.stream().anyMatch(q->!q.stripLeading().toUpperCase(Locale.ROOT).startsWith("SELECT")))throw new IllegalStateException("Consumer writes");
        if(i>=0){lookupTimes.add(millis);lookupQueries.add(statements.size());lookupSql=new ArrayList<>(statements);}}
      active=false;System.setProperty("mission1getaudit.active","false");if(counts().values().stream().anyMatch(n->n!=0))throw new IllegalStateException("Lookup invoked side-effect "+counts());
      perf.put("s10Lookup",Map.of("samplesMillis",lookupTimes,"medianMillis",percentile(lookupTimes,.5),"p95Millis",percentile(lookupTimes,.95),"preparedQueryCounts",lookupQueries,"sql",lookupSql,"resolvedSubjects",resolved.size(),"matchedSubjects",resolved.values().stream().filter(OperationalProductionBindings.Binding::matched).count(),"bindings",resolved));
      if(args.length>2 && args[2].equals("materialize")) {
        var store=ctx.getBean(ActiveMembershipStore.class);var latest=store.latest().orElseThrow();
        var at=latest.evaluatedAt();var input=ctx.getBean(RetainedMembershipInputs.class).load(at);var proposed=ctx.getBean(ActiveMembershipPolicy.class).evaluate(input,at);
        String meaning=store.encode(proposed),cut=store.encode(proposed.cut());
        var retained=jdbc.queryForMap("SELECT input_hash,semantic_hash FROM crew_active_projection_revision WHERE id=?",latest.revision());
        boolean idempotent=store.hash(meaning).equals(retained.get("semantic_hash")) && store.hash(cut).equals(retained.get("input_hash"));
        perf.put("materializationPrecheck",Map.of("revision",latest.revision(),"evaluationAt",at,"idempotent",idempotent,"expectedSemanticHash",retained.get("semantic_hash"),"actualSemanticHash",store.hash(meaning),"expectedInputHash",retained.get("input_hash"),"actualInputHash",store.hash(cut)));
        if(idempotent){
          var timings=new ArrayList<Double>();var reported=new ArrayList<Double>();var countsSql=new TreeSet<Integer>();var revisions=new TreeSet<Long>();var inserts=new ArrayList<Boolean>();
          active=true;
          for(int i=0;i<20;i++){statements.clear();long begin=System.nanoTime();var m=store.materialize(at);double elapsed=(System.nanoTime()-begin)/1e6;
            timings.add(elapsed);reported.add(m.millis());countsSql.add(statements.size());revisions.add(m.revision());inserts.add(m.inserted());
            if(m.inserted() || m.revision()!=latest.revision())throw new IllegalStateException("Authorized idempotent materialization inserted revision");}
          active=false;
          perf.put("v10Materialization",Map.of("samplesMillis",timings,"reportedSamplesMillis",reported,"medianMillis",percentile(timings,.5),"p95Millis",percentile(timings,.95),"preparedQueryCounts",countsSql,"revisions",revisions,"inserted",inserts,"evaluationTime",at));
        } else {
          Files.writeString(root.resolve(label+"-materialization-precheck-cut.json"),json.writerWithDefaultPrettyPrinter().writeValueAsString(proposed.cut())+"\n");
          Files.writeString(root.resolve(label+"-materialization-precheck-result.json"),json.writerWithDefaultPrettyPrinter().writeValueAsString(proposed)+"\n");
        }
      }
      perf.put("tablesAfterSeparatePerformance",fingerprints(jdbc));
      Files.writeString(root.resolve(label+"-separate-performance.json"),json.writerWithDefaultPrettyPrinter().writeValueAsString(perf)+"\n");
      System.out.println("SEPARATE_PERF_READY lookupMedian="+percentile(lookupTimes,.5)+" queries="+lookupQueries+" matches="+resolved.values().stream().filter(OperationalProductionBindings.Binding::matched).count()+" materialization="+perf.get("materializationPrecheck"));
    }
  }
}
