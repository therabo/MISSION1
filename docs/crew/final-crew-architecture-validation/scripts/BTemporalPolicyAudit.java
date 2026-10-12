import java.time.*;
import java.util.*;
import org.mission1.crew.membership.*;
import static org.mission1.crew.membership.Membership.*;

/** Explicit TEST_ONLY pure inputs; no JDBC, Spring context, network or persistence. */
public class BTemporalPolicyAudit {
  static final ActiveMembershipPolicy POLICY=ActiveMembershipPolicy.defaults().production(true);
  static final Instant ZERO=Instant.parse("2026-10-01T00:00:00Z");
  static int checks=0;
  static Human human(int n){return new Human("LL2:PERSON:TEST_ONLY_"+n,UUID.nameUUIDFromBytes(("TEST_ONLY_HUMAN_"+n).getBytes()),"TEST_ONLY human "+n,null);}
  static Event event(int n,long id,String type,Instant effective,Instant evaluated,boolean forceApplicable){
    Duration max=type.equals("PERSON_CURRENTLY_ABOARD")?Duration.ofDays(7):Duration.ofDays(14);
    boolean fresh=forceApplicable||POLICY.temporal().fresh(effective,max,evaluated);
    Slot slot=new Slot("TEST_ONLY_event_"+id,"TEST_ONLY human "+n,"NASA_OPERATIONAL_FEED",null,null,null,id,0,ZERO.plus(Duration.ofDays(30)),effective,"TEST_ONLY_EXPLICIT_SECONDS",null,fresh?Freshness.FRESH:Freshness.STALE,!type.equals("PERSON_DEPARTED_STATION"),human(n).key(),null,null,"TEST_ONLY_S10_MATCH",List.of());
    return new Event(slot,type,type.equals("PERSON_CURRENTLY_ABOARD")?"OBSERVED":"COMPLETED",fresh);
  }
  static Input input(int people,List<Assignment> assignments,List<Event> events,boolean historical,boolean failure){
    Cut cut=new Cut(null,null,null,null,null,null,null,null,null,List.of(),List.of(),List.of(new Health("NASA_OPERATIONAL_FEED","TEST_ONLY",failure?"FAILURE":"SUCCESS",failure?"TEST_ONLY_TIMEOUT":"TEST_ONLY_RETAINED",null,ZERO,ZERO,Freshness.FRESH)),Map.of("historical",historical));
    List<Human> humans=new ArrayList<>();for(int n=1;n<=people;n++)humans.add(human(n));
    return new Input(cut,List.copyOf(humans),assignments,List.of(),events,null,null,null,!assignments.isEmpty(),false);
  }
  static Result eval(Input in,Instant at){return POLICY.evaluate(in,at);}
  static void require(boolean pass,String test){if(!pass)throw new AssertionError(test);checks++;System.out.println("PASS "+test);}
  static long active(Result r){return r.members().stream().filter(m->m.state()==State.ACTIVE).count();}
  static void boundary(String type,int days){
    Instant end=ZERO.plus(Duration.ofDays(days));
    for(Instant t:List.of(ZERO.minusNanos(1),ZERO,end,end.plusNanos(1))){
      Result r=eval(input(1,List.of(),List.of(event(1,1,type,ZERO,t,false)),true,false),t);
      boolean expected=!t.isBefore(ZERO)&&!t.isAfter(end);
      require((active(r)==1)==expected,type+" exact boundary "+t);
    }
  }
  public static void main(String[]args){
    boundary("PERSON_CURRENTLY_ABOARD",7);boundary("PERSON_ENTERED_STATION",14);
    List<Assignment> assignments=new ArrayList<>();for(int n=1;n<=7;n++)assignments.add(new Assignment(human(n).key(),1,UUID.nameUUIDFromBytes("TEST_ONLY_EXPEDITION".getBytes()),"TEST_ONLY_"+n,"TEST_ONLY expedition","FLIGHT_ENGINEER",null,null,ZERO,Freshness.FRESH,true));
    Instant entry=ZERO.plusSeconds(3600),depart=ZERO.plusSeconds(7200),reenter=ZERO.plusSeconds(10800);
    for(Instant t:List.of(entry.minusNanos(1),entry,depart.minusNanos(1),depart,depart.plusNanos(1),reenter.minusNanos(1),reenter)){
      List<Event>events=new ArrayList<>();for(int n=1;n<=7;n++)events.add(event(n,n,"PERSON_CURRENTLY_ABOARD",ZERO,t,true));
      for(int n=8;n<=11;n++)events.add(event(n,100+n,"PERSON_ENTERED_STATION",entry,t,true));
      for(int n=1;n<=4;n++)events.add(event(n,200+n,"PERSON_DEPARTED_STATION",depart,t,true));
      events.add(event(1,300,"PERSON_ENTERED_STATION",reenter,t,true));
      Result r=eval(input(11,List.copyOf(assignments),events,true,false),t);
      long expected=t.isBefore(entry)?7:t.isBefore(depart)?11:t.isBefore(reenter)?7:8;
      require(active(r)==expected,"future eligible events excluded and turnover at "+t+" count="+expected);
    }
    Instant far=depart.plus(Duration.ofDays(15));
    Result expired=eval(input(1,List.of(assignments.getFirst()),List.of(event(1,1,"PERSON_CURRENTLY_ABOARD",ZERO,far,false),event(1,2,"PERSON_DEPARTED_STATION",depart,far,false)),true,false),far);
    require(active(expired)==0&&expired.members().getFirst().departureVeto()!=null,"departure veto survives 14d annotation expiry");
    Result equal=eval(input(1,List.of(assignments.getFirst()),List.of(event(1,1,"PERSON_CURRENTLY_ABOARD",depart,depart,true),event(1,2,"PERSON_DEPARTED_STATION",depart,depart,true)),true,false),depart);
    require(active(equal)==0&&equal.members().getFirst().presence().equals("AMBIGUOUS"),"equal-time positive/departure fails closed");
    Result historical=eval(input(1,List.of(),List.of(event(1,1,"PERSON_CURRENTLY_ABOARD",ZERO,ZERO,true)),true,true),ZERO);
    Result current=eval(input(1,List.of(),List.of(event(1,1,"PERSON_CURRENTLY_ABOARD",ZERO,ZERO,true)),false,true),ZERO);
    require(historical.members().getFirst().presence().equals("CONFIRMED_ABOARD"),"Historical retained annotation independent of source failure flag");
    require(current.members().getFirst().presence().equals("UNVERIFIED"),"Current source failure remains separately unverified");
    Input repeated=input(1,List.of(),List.of(event(1,1,"PERSON_CURRENTLY_ABOARD",ZERO,ZERO,true)),true,false);
    require(eval(repeated,ZERO).equals(eval(repeated,ZERO)),"same pure committed input/time deterministic");
    System.out.println("B_TEMPORAL_POLICY_AUDIT_PASS checks="+checks+" policy="+POLICY.key());
  }
}
