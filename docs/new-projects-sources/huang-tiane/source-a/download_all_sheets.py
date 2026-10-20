import json
import subprocess
import os
import sys
import time

if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

script_dir = os.path.dirname(os.path.abspath(__file__))
raw_dir = os.path.join(script_dir, 'raw')
catalog_path = os.path.join(script_dir, 'catalog.json')
manifest_path = os.path.join(script_dir, 'manifest.json')

with open(catalog_path, 'r', encoding='utf-8') as f:
    catalog = json.load(f)

total_sheets = sum(len(wb['sheets']) for wb in catalog['workbooks'])
print(f"Starting batch download for {total_sheets} sheets...", flush=True)

downloaded_count = 0
for wb in catalog['workbooks']:
    wb_id = wb['id']
    token = wb['spreadsheet_token']
    title = wb['title']
    print(f"\nProcessing workbook {wb_id} ({title})...", flush=True)
    
    for s in wb['sheets']:
        sheet_id = s['sheet_id']
        sheet_name = s['sheet_name']
        out_rel = f"raw/{wb_id}_{sheet_id}.json"
        out_path = os.path.join(script_dir, out_rel)
        
        # Check if already downloaded and complete
        if os.path.exists(out_path):
            try:
                with open(out_path, 'r', encoding='utf-8') as f:
                    d = json.load(f)
                if d.get('actual_range'):
                    s['status'] = 'downloaded'
                    s['raw_file'] = out_rel
                    s['actual_range'] = d.get('actual_range')
                    s['read_rows'] = d.get('row_count')
                    s['read_cols'] = d.get('col_count')
                    s['has_more'] = d.get('has_more')
                    print(f"  [Cached] {wb_id} - {sheet_name} ({sheet_id}): {d.get('actual_range')}", flush=True)
                    downloaded_count += 1
                    continue
            except Exception:
                pass

        print(f"  Fetching {wb_id} - {sheet_name} ({sheet_id})...", flush=True)
        cmd = [
            'lark-cli.cmd', 'sheets', '+csv-get',
            '--spreadsheet-token', token,
            '--sheet-id', sheet_id,
            '--output-path', out_path
        ]
        t0 = time.time()
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding='utf-8', shell=True)
        dur = time.time() - t0
        
        if res.returncode != 0:
            print(f"    ERROR: returncode {res.returncode}, stderr: {res.stderr[:200]}", flush=True)
            s['status'] = 'error'
            s['error'] = res.stderr[:200]
        else:
            try:
                with open(out_path, 'r', encoding='utf-8') as f:
                    d = json.load(f)
                s['status'] = 'downloaded'
                s['raw_file'] = out_rel
                s['actual_range'] = d.get('actual_range')
                s['read_rows'] = d.get('row_count')
                s['read_cols'] = d.get('col_count')
                s['has_more'] = d.get('has_more')
                s['bytes'] = os.path.getsize(out_path)
                s['fetch_duration_sec'] = round(dur, 2)
                downloaded_count += 1
                print(f"    OK: range={d.get('actual_range')}, rows={d.get('row_count')}, cols={d.get('col_count')}, dur={round(dur, 2)}s", flush=True)
            except Exception as e:
                print(f"    ERROR parsing result: {e}", flush=True)
                s['status'] = 'error'
                s['error'] = str(e)
        
        # Save catalog checkpoint after each sheet
        with open(catalog_path, 'w', encoding='utf-8') as f:
            json.dump(catalog, f, ensure_ascii=False, indent=2)
        with open(manifest_path, 'w', encoding='utf-8') as f:
            json.dump(catalog, f, ensure_ascii=False, indent=2)

print(f"\nFinished downloading {downloaded_count}/{total_sheets} sheets!", flush=True)
