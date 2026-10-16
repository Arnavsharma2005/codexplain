import { gzipSync, gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { TarReader, parsePax, stripRoot } from "@/lib/intel/tar";

function header(name: string, size: number, type = "0") {
  const h = Buffer.alloc(512);
  h.write(name.slice(0, 100), 0, "utf8");
  h.write(size.toString(8).padStart(11, "0") + "\0", 124);
  h.write(type, 156);
  h.write("ustar\0", 257);
  return h;
}
const pad = (n: number) => Buffer.alloc((512 - (n % 512)) % 512);

function entry(name: string, body: string | Buffer, type = "0") {
  const data = typeof body === "string" ? Buffer.from(body) : body;
  return [header(name, data.length, type), data, pad(data.length)];
}

function pax(records: Record<string, string>) {
  let out = "";
  for (const [k, v] of Object.entries(records)) {
    const rest = ` ${k}=${v}\n`;
    let len = Buffer.byteLength(rest) + 1;
    while (String(len).length + Buffer.byteLength(rest) !== len) len++;
    out += `${len}${rest}`;
  }
  return Buffer.from(out);
}

function read(archive: Buffer, chunkSize: number, want: (path: string, size: number) => boolean = () => true) {
  const entries: { path: string; text: string }[] = [];
  const reader = new TarReader({ want, onEntry: (e) => entries.push({ path: e.path, text: Buffer.from(e.data).toString() }) });
  for (let i = 0; i < archive.length; i += chunkSize) reader.write(archive.subarray(i, i + chunkSize));
  return { entries, comment: reader.comment };
}

describe("TarReader", () => {
  const longPath = `root/${"deep/".repeat(30)}file.ts`;
  const archive = Buffer.concat([
    ...entry("pax_global_header", pax({ comment: "abc123" }), "g"),
    ...entry("root/", "", "5"),
    ...entry("root/a.ts", "export const a = 1;\n"),
    ...entry("root/big.bin", Buffer.alloc(3000, 7)),
    ...entry("PaxHeader", pax({ path: longPath }), "x"),
    ...entry(longPath.slice(0, 99), "long\n"),
    ...entry("root/é.md", "# ünïcode\n"),
    Buffer.alloc(1024),
  ]);

  it.each([1, 7, 512, 100_000])("reads files, pax paths and the global comment in %i-byte chunks", (size) => {
    const { entries, comment } = read(archive, size);
    expect(comment).toBe("abc123");
    expect(entries.map((e) => e.path)).toEqual(["root/a.ts", "root/big.bin", longPath, "root/é.md"]);
    expect(entries[0].text).toBe("export const a = 1;\n");
    expect(entries[2].text).toBe("long\n");
    expect(entries[3].text).toBe("# ünïcode\n");
  });

  it("skips unwanted entries without buffering them", () => {
    const { entries } = read(archive, 64, (p) => !p.endsWith(".bin"));
    expect(entries.map((e) => e.path)).toEqual(["root/a.ts", longPath, "root/é.md"]);
  });

  it("round-trips through gzip", () => {
    const { entries } = read(gunzipSync(gzipSync(archive)), 4096);
    expect(entries).toHaveLength(4);
  });

  it("parses multi-byte pax records by byte length", () => {
    expect(parsePax(pax({ path: "ñ/ü.ts", mtime: "1" }))).toEqual({ path: "ñ/ü.ts", mtime: "1" });
  });

  it("strips GitHub's wrapper directory", () => {
    expect(stripRoot("acme-widgets-abc1234/src/index.ts")).toBe("src/index.ts");
    expect(stripRoot("acme-widgets-abc1234")).toBe("");
  });
});
