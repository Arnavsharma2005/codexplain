export type RepoInfo = {
  owner: string;
  name: string;
  fullName: string;
  description: string | null;
  defaultBranch: string;
  stars: number;
  forks: number;
  language: string | null;
  topics: string[];
  license: string | null;
  htmlUrl: string;
  ownerAvatarUrl: string;
  pushedAt: string | null;
};

export type TreeEntry = {
  path: string;
  type: "blob" | "tree";
  size?: number;
};

export type RepoTree = {
  ref: string;
  sha: string;
  truncated: boolean;
  entries: TreeEntry[];
};

export type RepoRefs = {
  branches: string[];
  tags: string[];
};

export type RepoFile = {
  path: string;
  sha: string;
  size: number;
  /** Null when the file is binary or too large to display. */
  content: string | null;
  reason?: "binary" | "too_large";
  htmlUrl: string;
};
