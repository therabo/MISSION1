#!/usr/bin/env python3
"""Isolated normal-start runner, protected by resource identity assertions."""
import datetime, hashlib, json, os, pathlib, secrets, signal, socket, subprocess, sys, time
from observe import ROOT, fingerprint, get, now, write
if not __debug__:
    raise RuntimeError('Safety assertions require ordinary Python; do not use -O')
def checked(args, **kw): return subprocess.run(args,check=True,text=True,**kw)
def free(port):
    if subprocess.run(['lsof','-t',f'-iTCP:{port}','-sTCP:LISTEN'],capture_output=True).returncode==0:
        raise RuntimeError(f'Port {port} already has a listener')
    with socket.socket() as s:
        s.setsockopt(socket.SOL_SOCKET,socket.SO_REUSEADDR,1)
        s.bind(('127.0.0.1',port))
def env_for(t):
    e={k:v for k,v in os.environ.items() if not k.startswith(('MISSION1_','SPRING_','JAVA_TOOL_OPTIONS','JDK_JAVA_OPTIONS','_JAVA_OPTIONS'))}
    e.update(MISSION1_DB_URL=t['jdbc'],MISSION1_DB_USER='mission1',MISSION1_DB_PASSWORD=(ROOT/t['secretFile']).read_text().strip())
    return e
def guard(t):
    p=json.loads((ROOT/'canonical-protection.json').read_text())
    x=json.loads(subprocess.check_output(['docker','inspect',t['container']]))[0]
    v=json.loads(subprocess.check_output(['docker','volume','inspect',t['volume']]))[0]
    assert t['project'].startswith('mission1-cleanroom-') and t['project']!=p['project']
    assert t['database']!=p['database']['name'] and t['dbPort']!=p['database']['port']
    assert t['jdbc']==f"jdbc:postgresql://127.0.0.1:{t['dbPort']}/{t['database']}"
    assert x['Id']!=p['database']['containerId'] and x['Name'].lstrip('/')==t['container']
    assert x['Config']['Labels']['com.docker.compose.project']==t['project']
    assert [m['Name'] for m in x['Mounts'] if m['Type']=='volume']==[t['volume']]
    assert t['volume']!=p['database']['volume']['Name'] and v['Labels']['com.docker.compose.project']==t['project']
    assert set(x['NetworkSettings']['Networks'])=={t['project']+'_default'}
    assert set(x['NetworkSettings']['Networks']).isdisjoint(p['database']['networks'])
    ports=x['NetworkSettings']['Ports']['5432/tcp']
    assert ports==[{'HostIp':'127.0.0.1','HostPort':str(t['dbPort'])}]
    assert t['apiPort']!=p['backend']['port'] and t['uiPort'] not in [a['port'] for a in p['frontend']]
    return {'at':now(),'pass':True,'hostSharedLoopback':True,'distinctPortDatabaseContainerVolumeProjectNetwork':True,'containerId':x['Id'],'volumeCreatedAt':v['CreatedAt']}
def load(label): return json.loads((ROOT/(label+'-topology.json')).read_text())
def start(t):
    safe=guard(t); write(t['label']+'-guard.json',safe)
    free(t['apiPort'])
    source=ROOT/t['build']/'backend/target/mission1-backend-0.1.0-SNAPSHOT.jar'
    jar=ROOT/(t['label']+'-immutable.jar')
    if not jar.exists():
        jar.write_bytes(source.read_bytes()); jar.chmod(0o444)
    if 'jarSha256' in t:
        assert hashlib.sha256(jar.read_bytes()).hexdigest()==t['jarSha256']
    t['startedAt']=now(); t.setdefault('firstStartedAt',t['startedAt'])
    t['jarSha256']=hashlib.sha256(jar.read_bytes()).hexdigest()
    log=open(ROOT/(t['label']+'-backend.log'),'ab')
    process=subprocess.Popen(['java','-Xmx512m','-jar',str(jar),f"--server.port={t['apiPort']}",'--server.address=127.0.0.1'],env=env_for(t),stdout=log,stderr=subprocess.STDOUT,start_new_session=True,cwd=ROOT/t['build']/'backend')
    t['pid']=process.pid; write(t['label']+'-topology.json',t)
    print('Started normal backend',t['label'],'PID',process.pid,'API',t['apiPort'],'T0',t['startedAt'])
def provision(label,dbport,apiport,uiport,build):
    if not label.replace('-','').replace('_','').isalnum():
        raise ValueError('Label must contain only letters, digits, hyphens or underscores')
    if (ROOT/(label+'-topology.json')).exists():
        raise ValueError('Use a new label; refuse replacing an existing run')
    if not (ROOT/build).resolve().is_relative_to(ROOT):
        raise ValueError('Build must be within the external evidence directory')
    if len({dbport,apiport,uiport})!=3:
        raise ValueError('Database, backend and frontend ports must differ')
    for port in [dbport,apiport,uiport]: free(port)
    unique=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d%H%M%S')+'-'+secrets.token_hex(3)
    project='mission1-cleanroom-'+unique
    database='mission1_cleanroom_'+secrets.token_hex(5)
    t={'label':label,'project':project,'container':project+'-postgres-1','volume':project+'_fresh-postgres','database':database,'dbPort':dbport,'apiPort':apiport,'uiPort':uiport,'jdbc':f'jdbc:postgresql://127.0.0.1:{dbport}/{database}','build':build,'secretFile':label+'-password.txt'}
    secret=ROOT/t['secretFile']; secret.write_text(secrets.token_urlsafe(32)+'\n'); secret.chmod(0o600)
    compose=ROOT/(label+'-compose.yaml')
    compose.write_text(f'''services:
  postgres:
    image: postgres:16.10
    environment:
      POSTGRES_DB: {database}
      POSTGRES_USER: mission1
      POSTGRES_PASSWORD: ${{MISSION1_DB_PASSWORD:?isolated password required}}
    ports:
      - "127.0.0.1:{dbport}:5432"
    volumes:
      - fresh-postgres:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U mission1 -d {database}"]
      interval: 1s
      timeout: 3s
      retries: 30
volumes:
  fresh-postgres:
''')
    write(label+'-topology.json',t)
    checked(['docker','compose','-p',project,'-f',str(compose),'up','-d','--wait','postgres'],env=env_for(t))
    write(label+'-guard.json',guard(t))
    empty=fingerprint(t['container'],database)
    assert empty['tables']==[]
    write(label+'-empty-proof.json',empty)
    start(t)
def monitor(label):
    t=load(label); schema=(ROOT/(label+'-post-migration.json')).exists()
    while True:
        try:
            log=(ROOT/(label+'-backend.log')).read_text()
            if not schema and 'Started Mission1Application' in log:
                write(label+'-post-migration.json',fingerprint(t['container'],t['database'])); schema=True
            record={'observedAt':now(),'crew':get(t['apiPort'],'/api/iss/crew'),'orbit':get(t['apiPort'],'/api/iss/state')}
            with (ROOT/(label+'-observations.jsonl')).open('a') as f: f.write(json.dumps(record)+'\n')
            for name,key in [('first-current','crew'),('first-orbit','orbit')]:
                milestone=ROOT/(label+'-'+name+'.json')
                if record[key].get('status')==200 and not milestone.exists():
                    write(milestone.name,record)
            if schema: write(label+'-latest-fingerprint.json',fingerprint(t['container'],t['database']))
        except Exception as ex:
            with (ROOT/(label+'-monitor-errors.log')).open('a') as f:f.write(now()+' '+repr(ex)+'\n')
        time.sleep(30)
def stop(label, destroy=False):
    t=load(label); guard(t)
    cmd=subprocess.check_output(['ps','-p',str(t['pid']),'-o','command='],text=True).strip()
    assert f"--server.port={t['apiPort']}" in cmd and str(ROOT/(label+'-immutable.jar')) in cmd and 'java' in cmd
    assert t['pid']!=json.loads((ROOT/'canonical-protection.json').read_text())['backend']['pid']
    os.kill(t['pid'],signal.SIGTERM)
    for suffix, expected in [('monitor','run.py monitor '+label),('frontend',f"--port {t['uiPort']}")]:
        f=ROOT/(label+'-'+suffix+'.pid')
        if f.exists():
            pid=int(f.read_text()); command=subprocess.check_output(['ps','-p',str(pid),'-o','command='],text=True).strip()
            assert expected in command
            os.kill(pid,signal.SIGTERM)
    if not destroy: return
    safety=guard(t)
    network=t['project']+'_default'
    n=json.loads(subprocess.check_output(['docker','network','inspect',network]))[0]
    assert n['Labels']['com.docker.compose.project']==t['project'] and set(n['Containers'])=={safety['containerId']}
    print('DELETE ONLY:',json.dumps({'containerId':safety['containerId'],'container':t['container'],'network':network,'volume':t['volume'],'database':t['database']}),flush=True)
    checked(['docker','stop',safety['containerId']]); checked(['docker','rm',safety['containerId']])
    checked(['docker','network','rm',network]); checked(['docker','volume','rm',t['volume']])
    write(label+'-cleanup.json',{'at':now(),'deleted':{'container':safety['containerId'],'network':network,'volume':t['volume']},'guard':safety})
def protect(container, database, dbport, apiport, uiports):
    x=json.loads(subprocess.check_output(['docker','inspect',container]))[0]
    volumes=[m for m in x['Mounts'] if m['Type']=='volume']
    assert len(volumes)==1
    v=json.loads(subprocess.check_output(['docker','volume','inspect',volumes[0]['Name']]))[0]
    project=x['Config']['Labels']['com.docker.compose.project']
    assert x['NetworkSettings']['Ports']['5432/tcp']==[{'HostIp':'127.0.0.1','HostPort':str(dbport)}]
    pid=int(subprocess.check_output(['lsof','-t','-iTCP:'+str(apiport),'-sTCP:LISTEN'],text=True).strip())
    canonical={'capturedAt':now(),'project':project,'database':{'host':'127.0.0.1','port':dbport,'name':database,'containerId':x['Id'],'container':container,'volume':v,'networks':x['NetworkSettings']['Networks']},'backend':{'pid':pid,'port':apiport},'frontend':[{'port':p} for p in uiports],'readOnly':True}
    target=ROOT/'canonical-protection.json'
    if target.exists(): raise ValueError('Refuse replacing an existing protection manifest')
    write('canonical-protection.json',canonical)
    write('canonical-before-fingerprint.json',fingerprint(container,database))
    from observe import apis
    write('canonical-before-api.json',apis(apiport))
    print('Canonical resources protected; metadata captured read-only')
def check(label):
    t=load(label); safe=guard(t)
    crew=get(t['apiPort'],'/api/iss/crew'); orbit=get(t['apiPort'],'/api/iss/state')
    c=crew.get('body',{}); o=orbit.get('body',{})
    result={'at':now(),'guard':safe,'firstStartedAt':t.get('firstStartedAt',t.get('startedAt')),
            'crewHttp':crew.get('status'),'crewMembers':len(c.get('members',[])),
            'crewMembership':c.get('membership'),'orbitHttp':orbit.get('status'),
            'orbitClassification':o.get('classification'),'orbitQuality':o.get('quality')}
    write(label+'-check.json',result)
    print(json.dumps(result,indent=2))
    return crew.get('status')==200 and orbit.get('status')==200
if __name__=='__main__':
    action=sys.argv[1]
    if action=='protect': protect(sys.argv[2],sys.argv[3],int(sys.argv[4]),int(sys.argv[5]),list(map(int,sys.argv[6:])))
    elif action=='provision': provision(sys.argv[2],*map(int,sys.argv[3:6]),sys.argv[6])
    elif action=='start': start(load(sys.argv[2]))
    elif action=='monitor': monitor(sys.argv[2])
    elif action=='check': sys.exit(0 if check(sys.argv[2]) else 2)
    elif action=='stop': stop(sys.argv[2],len(sys.argv)>3 and sys.argv[3]=='destroy')
