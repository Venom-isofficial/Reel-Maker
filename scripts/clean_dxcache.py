import os

def main():
    print("=" * 65)
    print("Cleaning NVIDIA DXCache & GLCache (Reclaiming ~16.8 GB)")
    print("=" * 65)

    cache_dirs = [
        r"C:\Users\ashis\AppData\Local\NVIDIA\DXCache",
        r"C:\Users\ashis\AppData\Local\NVIDIA\GLCache"
    ]

    freed_bytes = 0
    deleted_count = 0

    for d in cache_dirs:
        if os.path.exists(d):
            for root, _, files in os.walk(d):
                for f in files:
                    fp = os.path.join(root, f)
                    try:
                        sz = os.path.getsize(fp)
                        os.remove(fp)
                        freed_bytes += sz
                        deleted_count += 1
                    except Exception:
                        pass

    print(f"Deleted {deleted_count} cache files.")
    print(f"SUCCESS: Total Reclaimed Disk Space: {freed_bytes / (1024**3):.2f} GB!")
    print("=" * 65)

if __name__ == "__main__":
    main()
