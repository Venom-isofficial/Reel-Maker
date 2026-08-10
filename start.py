import os
import sys
import time
import socket
import subprocess
import webbrowser
from pathlib import Path

# Force UTF-8 stdout encoding for Windows console compatibility
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try: sys.stdout.reconfigure(encoding="utf-8")
    except Exception: pass

# =============================================================================
#  CONFIGURABLE SERVICES LIST (PLUG & PLAY FOR FUTURE AI INTEGRATIONS)
# =============================================================================
# To add any new service in the future, simply append a dictionary below:
# {
#     "name": "Service Name",
#     "cmd": "command to run",
#     "port": 1234,  # Port to check for health (or None if no HTTP port)
#     "enabled": True
# }
# =============================================================================

SERVICES = [
    {
        "name": "Backend Express API",
        "cmd": "npm run dev:backend",
        "port": 3001,
        "enabled": True
    },
    {
        "name": "Frontend Vite UI",
        "cmd": "npm run dev:frontend",
        "port": 3005,
        "enabled": True
    },
    {
        "name": "Chatterbox 500M TTS",
        "cmd": f"{sys.executable} scripts/chatterbox_server.py --port 8002",
        "port": 8002,
        "enabled": True
    },
    # -------------------------------------------------------------------------
    # PLUG & PLAY SLOTS FOR FUTURE EXTENSIONS (Set "enabled": True to activate)
    # -------------------------------------------------------------------------
    # {
    #     "name": "Wan2GP Video Generator",
    #     "cmd": f"{sys.executable} scripts/wan2gp_server.py --port 7860",
    #     "port": 7860,
    #     "enabled": False
    # },
    # {
    #     "name": "Local Whisper Transcriber",
    #     "cmd": f"{sys.executable} scripts/whisper_server.py --port 8003",
    #     "port": 8003,
    #     "enabled": False
    # },
]

# Settings
FRONTEND_URL = "http://localhost:3005"
OPEN_BROWSER = True
LOG_DIR = Path("logs")

def is_port_in_use(port: int) -> bool:
    if not port:
        return False
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex(('127.0.0.1', port)) == 0

def kill_process_on_port(port: int):
    if not port or not is_port_in_use(port):
        return
    print(f"  [WARN] Port {port} is occupied. Clearing port...")
    if sys.platform == "win32":
        try:
            cmd = f'powershell -Command "Get-NetTCPConnection -LocalPort {port} -ErrorAction SilentlyContinue | ForEach-Object {{ Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }}"'
            subprocess.run(cmd, shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            time.sleep(1)
        except Exception:
            pass
    else:
        try:
            subprocess.run(f"fuser -k {port}/tcp", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            time.sleep(1)
        except Exception:
            pass

def wait_for_port(port: int, timeout: int = 40) -> bool:
    if not port:
        return True
    start = time.time()
    while time.time() - start < timeout:
        if is_port_in_use(port):
            return True
        time.sleep(1)
    return False

def main():
    print("\n" + "=" * 70)
    print("   🎬 AI REEL MAKER — ONE-SHOT PROJECT LAUNCHER")
    print("=" * 70)
    
    LOG_DIR.mkdir(exist_ok=True)
    
    print("\n[1/4] Checking environment dependencies...")
    # Node check
    try:
        node_v = subprocess.check_output(["node", "-v"]).decode().strip()
        print(f"  [OK] Node.js version: {node_v}")
    except Exception:
        print("  [ERROR] Node.js is not installed or not in PATH!")
        sys.exit(1)
        
    # FFmpeg check
    try:
        subprocess.check_output(["ffmpeg", "-version"], stderr=subprocess.STDOUT)
        print("  [OK] FFmpeg is installed and ready.")
    except Exception:
        print("  [WARN] FFmpeg not found in PATH. Video stitching might fail.")

    print("\n[2/4] Clearing conflicting server ports...")
    for svc in SERVICES:
        if svc.get("enabled") and svc.get("port"):
            kill_process_on_port(svc["port"])
    print("  [OK] All server ports ready.")

    print("\n[3/4] Launching project services in background...")
    processes = []
    
    for svc in SERVICES:
        if not svc.get("enabled"):
            print(f"  [SKIP] {svc['name']} (disabled in config)")
            continue
            
        name = svc["name"]
        cmd = svc["cmd"]
        port = svc.get("port")
        log_file = LOG_DIR / f"{name.lower().replace(' ', '_')}.log"
        
        print(f"  [STARTING] {name}...")
        log_fp = open(log_file, "w", encoding="utf-8")
        
        proc = subprocess.Popen(
            cmd,
            shell=True,
            stdout=log_fp,
            stderr=subprocess.STDOUT,
            creationflags=subprocess.CREATE_NEW_CONSOLE if sys.platform == "win32" else 0
        )
        processes.append((name, port, proc, log_file))
        
    print("\n[4/4] Verifying active service status...")
    print("-" * 70)
    print(f"  {'SERVICE NAME':<30} | {'PORT':<8} | {'STATUS':<15}")
    print("-" * 70)
    
    all_ok = True
    for name, port, proc, log_file in processes:
        if port:
            is_up = wait_for_port(port, timeout=40)
            status_str = "ONLINE (OK)" if is_up else "STARTING / WARN"
            if not is_up:
                all_ok = False
            print(f"  {name:<30} | {port:<8} | {status_str:<15}")
        else:
            print(f"  {name:<30} | {'N/A':<8} | RUNNING")

    print("-" * 70)
    print(f"📁 All service logs are saved to: {LOG_DIR.resolve()}")
    
    if OPEN_BROWSER:
        print(f"\n🚀 Opening Reel Maker UI at {FRONTEND_URL} ...")
        time.sleep(2)
        webbrowser.open(FRONTEND_URL)

    print("\n✅ All systems launched! You can leave this launcher open.")
    print("   To stop all background services, simply close this console or press Ctrl+C.\n")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n🛑 Stopping all background services...")
        for name, port, proc, _ in processes:
            if proc.poll() is None:
                proc.terminate()
        print("Done. Goodbye!")

if __name__ == "__main__":
    main()
