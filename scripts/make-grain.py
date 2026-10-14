# scripts/make-grain.py  — run: python3 scripts/make-grain.py src/app/_assets
import random, struct, sys, zlib
N, LEVELS, MAX_ALPHA = 128, 4, 40
def png(rows, rgb):
    def chunk(t, d): return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    trns = bytes(round(i * MAX_ALPHA / (LEVELS - 1)) for i in range(LEVELS))
    raw = b"".join(b"\x00" + bytes(r) for r in rows)
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", N, N, 8, 3, 0, 0, 0))
            + chunk(b"PLTE", bytes(rgb) * LEVELS) + chunk(b"tRNS", trns)
            + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))
random.seed(1)
rows = [[min(LEVELS - 1, int(abs((random.random() + random.random() + random.random()) / 3 - 0.5) * 2 * LEVELS))
         for _ in range(N)] for _ in range(N)]
out = sys.argv[1] if len(sys.argv) > 1 else "."
for name, rgb in (("grain-paper.png", (14, 28, 58)), ("grain-night.png", (242, 229, 195))):
    open(f"{out}/{name}", "wb").write(png(rows, rgb))
