#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
remote-deploy.py

Local automation tool to trigger hardened, safe deployment on 172.16.10.45.
Usage:
  python scripts/remote-deploy.py
"""

import os
import sys
import paramiko

sys.stdout.reconfigure(encoding='utf-8')

SERVER_HOST = '172.16.10.45'
SERVER_USER = 'user'
SERVER_PASS = os.environ.get('FEIHE_DEPLOY_PASS', '')
REMOTE_REPO = '/home/user/models/feihe'

def main():
    if not SERVER_PASS:
        print("Error: Environment variable FEIHE_DEPLOY_PASS is not set.", file=sys.stderr)
        sys.exit(1)
    print(f"Connecting to {SERVER_USER}@{SERVER_HOST}...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(SERVER_HOST, username=SERVER_USER, password=SERVER_PASS, timeout=15)

    deploy_command = f"""
set -e
cd {REMOTE_REPO}
git fetch origin main
git checkout main
git reset --hard origin/main
NODE_BIN="{REMOTE_REPO}/feihe-mvp/runtime/node"
$NODE_BIN feihe-mvp/scripts/deploy-release.mjs
"""
    print("Executing automated deployment pipeline on remote server...\n")
    stdin, stdout, stderr = ssh.exec_command(deploy_command)

    while True:
        line = stdout.readline()
        if not line:
            break
        print(line, end='', flush=True)

    err = stderr.read().decode('utf-8')
    if err and 'warn' not in err.lower() and 'npm' not in err.lower():
        print(err, file=sys.stderr)

    exit_code = stdout.channel.recv_exit_status()
    ssh.close()
    if exit_code != 0:
        print(f"\n[ERROR] Deployment failed with exit code {exit_code}", file=sys.stderr)
        sys.exit(exit_code)
    print("\n[SUCCESS] Remote deployment and health check verified successfully.")

if __name__ == '__main__':
    main()
