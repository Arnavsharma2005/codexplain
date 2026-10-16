import { z } from "zod";
import { isValidOwner, isValidRepoName } from "./names";

export const ownerSchema = z.string().refine(isValidOwner, "Invalid repository owner");

export const repoNameSchema = z.string().refine(isValidRepoName, "Invalid repository name");

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
