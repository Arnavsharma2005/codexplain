const BINARY_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "ico", "bmp", "tiff", "avif", "heic", "psd",
  "pdf", "zip", "gz", "tgz", "bz2", "xz", "7z", "rar", "jar", "war",
  "exe", "dll", "so", "dylib", "bin", "o", "a", "class", "pyc", "wasm",
  "woff", "woff2", "ttf", "otf", "eot",
  "mp3", "mp4", "mov", "avi", "mkv", "webm", "wav", "flac", "ogg",
  "sqlite", "db", "lockb", "parquet", "pkl", "npy", "onnx", "pt",
]);

export function extensionOf(path: string): string {
  const name = path.split("/").pop() ?? "";
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

/** Extension check first, then a NUL-byte sniff of the first 8 KB (what git does). */
export function isProbablyBinary(path: string, bytes?: Uint8Array): boolean {
  if (BINARY_EXTENSIONS.has(extensionOf(path))) return true;
  if (!bytes) return false;
  const sample = bytes.subarray(0, 8000);
  for (let i = 0; i < sample.length; i++) if (sample[i] === 0) return true;
  return false;
}
