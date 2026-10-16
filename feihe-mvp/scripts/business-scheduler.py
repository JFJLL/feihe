"""Reuse automation's APScheduler and time rules, with only Feihe's isolated read-only jobs."""
import argparse,datetime,json,pathlib,signal,subprocess,sys,threading
def main():
    p=argparse.ArgumentParser();p.add_argument('--automation-root',required=True);p.add_argument('--db',required=True);p.add_argument('--once',action='store_true');args=p.parse_args()
    root=pathlib.Path(args.automation_root).resolve();dbpath=pathlib.Path(args.db).resolve();app=pathlib.Path(__file__).resolve().parent.parent
    if '/.verification/' not in dbpath.as_posix():raise ValueError('本地联调仅允许隔离开发库')
    sys.path.insert(0,str(root/'sync_console'));sys.path.insert(0,str(root))
    from core.scheduler_manager import SchedulerManager
    manager=SchedulerManager()  # Do not call manager.start(): it restores the original real tasks.
    def tick():
        result=subprocess.run(['node',str(app/'scripts/run-business-sync.mjs'),'--db',str(dbpath),'--automation-root',str(root),'--scheduled','false' if args.once else 'true'],cwd=app,capture_output=True,text=True,encoding='utf-8',timeout=840)
        if result.stdout.strip():print(result.stdout.strip(),flush=True)
        if result.returncode:print(json.dumps({'worker':'failed','exit':result.returncode}),flush=True)
    if args.once:tick();return
    manager.scheduler.add_job(tick,'interval',seconds=30,id='feihe-read-only-sync',max_instances=1,coalesce=True,misfire_grace_time=60)
    manager.scheduler.start()  # Starts only this explicitly installed job, not automation's task restoration.
    stop=threading.Event()
    signal.signal(signal.SIGINT,lambda *_:stop.set());signal.signal(signal.SIGTERM,lambda *_:stop.set())
    print(json.dumps({'worker':'started','timezone':str(manager.scheduler.timezone),'database':'isolated','writes':'Feihe local database only'}),flush=True)
    tick();stop.wait();manager.scheduler.shutdown(wait=False)
if __name__=='__main__':main()
