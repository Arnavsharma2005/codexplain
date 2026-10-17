/**
 * Minimal streaming reader for the ustar/pax archives GitHub serves as
 * repository tarballs. Only regular files are reported, and an entry's bytes
 * are buffered only when `want` accepts it, so large binaries and vendored
 * trees stream past without being held in memory.
 */

export type TarEntry = { path: string; size: number; data: Uint8Array };

type Options = {
  /** Return true to receive this file's contents. */
  want: (path: string, size: number) => boolean;
  onEntry: (entry: TarEntry) => void;
};

const BLOCK = 512;
const decoder = new TextDecoder();

function cString(buf: Uint8Array, start: number, length: number) {
  const slice = buf.subarray(start, start + length);
  const end = slice.indexOf(0);
  return decoder.decode(end === -1 ? slice : slice.subarray(0, end));
}

function octal(buf: Uint8Array, start: number, length: number) {
  const text = cString(buf, start, length).trim();
  return text ? parseInt(text, 8) : 0;
}

/** Parses "<len> key=value\n" pax records. */
export function parsePax(data: Uint8Array): Record<string, string> {
  const out: Record<string, string> = {};
  let i = 0;
  while (i < data.length) {
    const space = data.indexOf(0x20, i);
    if (space === -1) break;
    // The length prefix counts bytes, so walk the byte view, not the decoded string.
    const len = Number(decoder.decode(data.subarray(i, space)));
    if (!Number.isInteger(len) || len <= space - i) break;
    const record = decoder.decode(data.subarray(space + 1, i + len - 1));
    const eq = record.indexOf("=");
    if (eq > 0) out[record.slice(0, eq)] = record.slice(eq + 1);
    i += len;
  }
  return out;
}

export class TarReader {
  private pending: Uint8Array[] = [];
  private pendingBytes = 0;
  private state: "header" | "data" | "done" = "header";
  private current: { path: string; size: number; type: string; keep: boolean } | null = null;
  private dataLeft = 0;
  private padLeft = 0;
  private parts: Uint8Array[] = [];
  private paxPath: string | null = null;
  private longName: string | null = null;

  constructor(private opts: Options) {}

  /** The archive's global pax comment; GitHub stores the commit SHA there. */
  comment: string | null = null;

  write(chunk: Uint8Array) {
    if (this.state === "done") return;
    this.pending.push(chunk);
    this.pendingBytes += chunk.length;
    this.drain();
  }

  private take(n: number): Uint8Array {
    const out = new Uint8Array(n);
    let filled = 0;
    while (filled < n) {
      const head = this.pending[0];
      const need = n - filled;
      if (head.length <= need) {
        out.set(head, filled);
        filled += head.length;
        this.pending.shift();
      } else {
        out.set(head.subarray(0, need), filled);
        this.pending[0] = head.subarray(need);
        filled += need;
      }
    }
    this.pendingBytes -= n;
    return out;
  }

  /** Consumes up to n bytes without copying them when they're unwanted. */
  private skipOrCollect(n: number, collect: boolean): number {
    let used = 0;
    while (used < n && this.pending.length) {
      const head = this.pending[0];
      const step = Math.min(head.length, n - used);
      if (collect) this.parts.push(head.subarray(0, step));
      if (step === head.length) this.pending.shift();
      else this.pending[0] = head.subarray(step);
      used += step;
    }
    this.pendingBytes -= used;
    return used;
  }

  private drain() {
    for (;;) {
      if (this.state === "header") {
        if (this.pendingBytes < BLOCK) return;
        const header = this.take(BLOCK);
        if (header.every((b) => b === 0)) continue; // end-of-archive padding
        const type = String.fromCharCode(header[156] || 48);
        const size = octal(header, 124, 12);
        const name = cString(header, 0, 100);
        const prefix = cString(header, 345, 155);
        let path = prefix ? `${prefix}/${name}` : name;
        if (this.longName) path = this.longName;
        if (this.paxPath) path = this.paxPath;
        const isFile = type === "0" || type === "7";
        if (isFile) {
          this.longName = null;
          this.paxPath = null;
        }
        const meta = type === "x" || type === "g" || type === "L";
        const keep = meta || (isFile && this.opts.want(path, size));
        this.current = { path, size, type, keep };
        this.dataLeft = size;
        this.padLeft = Math.ceil(size / BLOCK) * BLOCK - size;
        this.parts = [];
        this.state = "data";
        continue;
      }
      if (this.state === "data") {
        if (this.dataLeft > 0) {
          this.dataLeft -= this.skipOrCollect(this.dataLeft, this.current!.keep);
          if (this.dataLeft > 0) return;
        }
        if (this.padLeft > 0) {
          this.padLeft -= this.skipOrCollect(this.padLeft, false);
          if (this.padLeft > 0) return;
        }
        this.finishEntry();
        continue;
      }
      return;
    }
  }

  private finishEntry() {
    const cur = this.current!;
    this.state = "header";
    this.current = null;
    if (!cur.keep) return;
    const data = concat(this.parts, cur.size);
    this.parts = [];
    if (cur.type === "x") {
      this.paxPath = parsePax(data).path ?? null;
    } else if (cur.type === "g") {
      this.comment = parsePax(data).comment ?? this.comment;
    } else if (cur.type === "L") {
      this.longName = cString(data, 0, data.length);
    } else {
      this.opts.onEntry({ path: cur.path, size: cur.size, data });
    }
  }
}

function concat(parts: Uint8Array[], size: number) {
  if (parts.length === 1 && parts[0].length === size) return parts[0];
  const out = new Uint8Array(size);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** GitHub tarballs wrap everything in "<owner>-<repo>-<sha>/"; drop that first segment. */
export function stripRoot(path: string): string {
  const slash = path.indexOf("/");
  return slash === -1 ? "" : path.slice(slash + 1);
}
