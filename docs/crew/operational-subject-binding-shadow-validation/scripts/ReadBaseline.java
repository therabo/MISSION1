import java.nio.file.*;
import java.util.*;
import java.time.*;
import java.lang.reflect.*;
import java.sql.Connection;
import javax.sql.DataSource;
import org.springframework.boot.*;
import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.*;
import org.springframework.transaction.support.TransactionTemplate;
import com.fasterxml.jackson.databind.*;
import org.mission1.Mission1Application;
import org.mission1.api.crew.CrewRestQueryService;
import org.mission1.crew.application.*;
import org.mission1.crew.membership.*;
import org.mission1.source.crew.nasa.*;

public class ReadBaseline {
  static boolean enabled; static List<String> statements=new ArrayList<>();static List<Boolean> readOnly=new ArrayList<>();
  static Object invoke(Method m,Object target,Object[] args)throws Throwable {try{return m.invoke(target,args);}catch(InvocationTargetException e){throw e.getCause();}}
  public static void main(String[] args)throws Exception {
    Path root=Path.of("/Users/daniel/.codex/exports/mission1-s10-shadow");
    var app=new SpringApplication(Mission1Application.class);app.setWebApplicationType(WebApplicationType.NONE);
    app.addInitializers(c->c.getBeanFactory().addBeanPostProcessor(new BeanPostProcessor(){public Object postProcessAfterInitialization(Object bean,String name){
      if(!(bean instanceof DataSource ds))return bean;
      return Proxy.newProxyInstance(DataSource.class.getClassLoader(),new Class[]{DataSource.class},(p,m,a)->{
        var result=invoke(m,ds,a);
        if(result instanceof Connection conn && m.getName().equals("getConnection"))return Proxy.newProxyInstance(Connection.class.getClassLoader(),new Class[]{Connection.class},(pp,mm,aa)->{
          if(enabled && mm.getName().equals("prepareStatement")){statements.add((String)aa[0]);readOnly.add(conn.isReadOnly());}return invoke(mm,conn,aa);});return result;});}}));
    try(var ctx=app.run("--mission1.orbital.celestrak.refresh.enabled=false","--mission1.crew.ingestion.enabled=false","--mission1.crew.verification.enabled=false",
      "--mission1.crew.refresh.event-aware.enabled=false","--mission1.crew.editorial.enabled=false","--mission1.crew.automatic-shadow.enabled=false","--mission1.crew.active-shadow.enabled=false",
      "--mission1.crew.identity.review-mode=OFF","--mission1.crew.occurrences.backfill-mode=OFF")) {
      var jdbc=ctx.getBean(JdbcTemplate.class);var json=ctx.getBean(ObjectMapper.class);var report=new LinkedHashMap<String,Object>();
      if(!jdbc.queryForObject("SELECT current_database()",String.class).equals("mission1"))throw new IllegalStateException("Wrong database");
      var rest=ctx.getBean(CrewRestQueryService.class);var times=new ArrayList<Double>();var sqlCounts=new ArrayList<Integer>();enabled=true;
      for(int i=0;i<20;i++){statements.clear();readOnly.clear();long start=System.nanoTime();rest.crew();times.add((System.nanoTime()-start)/1e6);sqlCounts.add(statements.size());
        if(statements.stream().anyMatch(s->!s.stripLeading().toUpperCase(Locale.ROOT).startsWith("SELECT")))throw new IllegalStateException("GET SQL write");
        if(readOnly.contains(false))throw new IllegalStateException("GET connection not read-only");}
      enabled=false;report.put("currentGetMillis",times);report.put("currentGetSqlCounts",sqlCounts);report.put("getWrites",0);report.put("getExternalCalls",0);report.put("getV9Evaluations",0);report.put("getV10Materializations",0);
      report.put("at",Instant.now());Files.writeString(root.resolve("baseline-read-sql.json"),json.writerWithDefaultPrettyPrinter().writeValueAsString(report)+"\n");
      System.out.println("BASELINE_SQL_PASS queries="+sqlCounts);
    }
  }
}
