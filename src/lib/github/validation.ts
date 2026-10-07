import { z } from "zod";

/** GitHub usernames/orgs: alphanumerics and single hyphens, max 39 chars. */
export const ownerSchema = z
  .string()
  .regex(/^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/, "Invalid repository owner");

/** Repository names: letters, digits, '.', '-', '_' (not '.' or '..'). */
export const repoNameSchema = z
  .string()
  .regex(/^[A-Za-z0-9._-]{1,100}$/, "Invalid repository name")
  .refine((s) => s !== "." && s !== "..", "Invalid repository name");

/** A subset of git's check-ref-format rules, enough to keep refs safe in URLs. */
export const refSchema = z
  .string()
  .min(1)
  .max(255)
  .refine(
    (s) =>
      !/[\x00-\x20~^:?*[\\\x7f]/.test(s) &&
      !s.includes("..") &&
      !s.includes("@{") &&
      !s.startsWith("/") &&
      !s.endsWith("/") &&
      !s.endsWith(".") &&
      !s.endsWith(".lock") &&
      !s.includes("//"),
    "Invalid branch or tag name",
  );

/** Repository-relative file path. No traversal, no leading slash. */
export const pathSchema = z
  .string()
  .min(1)
  .max(1024)
  .refine((s) => {
    if (s.startsWith("/") || s.endsWith("/") || s.includes("\0")) return false;
    return s.split("/").every((seg) => seg.length > 0 && seg !== "." && seg !== "..");
  }, "Invalid file path");

export const repoCoordsSchema = z.object({
  owner: ownerSchema,
  repo: repoNameSchema,
});

export const analysisModeSchema = z.enum(["OVERVIEW", "DEEP_DIVE", "REVIEW"]);
export type AnalysisModeInput = z.infer<typeof analysisModeSchema>;
