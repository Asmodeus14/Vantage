"use client";

import * as React from "react";
import Link from "next/link";
import { FileCode, Folder, FolderOpen, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { SourceFileEntry } from "@/lib/types";

/**
 * The sidebar for the file viewer.
 *
 * Directories are derived from the paths rather than requested separately —
 * the API returns a flat list because that is what both providers can produce
 * cheaply, and a tree is a rendering concern.
 *
 * Folders containing findings start open. Opening a viewer to a collapsed tree
 * and hunting for the file you came to read is the wrong first impression, and
 * the finding counts are the only reason this sidebar is more useful than the
 * repository on GitHub.
 */

interface TreeNode {
  name: string;
  path: string;
  file?: SourceFileEntry;
  children: Map<string, TreeNode>;
  findings: number;
}

function buildTree(files: SourceFileEntry[]): TreeNode {
  const root: TreeNode = { name: "", path: "", children: new Map(), findings: 0 };

  for (const file of files) {
    const parts = file.path.split("/");
    let node = root;
    let prefix = "";

    for (let i = 0; i < parts.length; i += 1) {
      const part = parts[i]!;
      prefix = prefix ? `${prefix}/${part}` : part;
      let child = node.children.get(part);
      if (!child) {
        child = { name: part, path: prefix, children: new Map(), findings: 0 };
        node.children.set(part, child);
      }
      // Counts bubble up, so a collapsed folder still says how much is inside.
      child.findings += file.findings;
      if (i === parts.length - 1) child.file = file;
      node = child;
    }
    root.findings += file.findings;
  }
  return root;
}

function sortedChildren(node: TreeNode): TreeNode[] {
  return [...node.children.values()].sort((a, b) => {
    const aDir = a.children.size > 0;
    const bDir = b.children.size > 0;
    if (aDir !== bDir) return aDir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export function FileTree({
  files,
  reportId,
  activePath,
  truncated,
}: {
  files: SourceFileEntry[];
  reportId: string;
  activePath: string | null;
  truncated: boolean;
}) {
  const [query, setQuery] = React.useState("");

  const visible = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return files;
    return files.filter((file) => file.path.toLowerCase().includes(needle));
  }, [files, query]);

  const tree = React.useMemo(() => buildTree(visible), [visible]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-fg-subtle"
          aria-hidden
        />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Find a file…"
          aria-label="Filter files"
          className="h-8 pl-8 text-xs"
        />
      </div>

      <div className="flex items-center justify-between text-xs text-fg-subtle">
        <span>
          {visible.length} of {files.length} files
        </span>
      </div>

      {visible.length === 0 ? (
        <p className="py-6 text-center text-xs text-fg-subtle">
          No file matches that.
        </p>
      ) : (
        <ul className="scrollbar-thin min-h-0 flex-1 overflow-y-auto text-xs">
          {sortedChildren(tree).map((child) => (
            <Node
              key={child.path}
              node={child}
              reportId={reportId}
              activePath={activePath}
              depth={0}
              // A filtered tree is already narrowed to what someone asked for,
              // so collapsing it would hide the answer.
              forceOpen={query.trim().length > 0}
            />
          ))}
        </ul>
      )}

      {truncated && (
        <p className="border-t border-border pt-2 text-xs text-fg-subtle">
          Only the first 5,000 files are listed.
        </p>
      )}
    </div>
  );
}

function Node({
  node,
  reportId,
  activePath,
  depth,
  forceOpen,
}: {
  node: TreeNode;
  reportId: string;
  activePath: string | null;
  depth: number;
  forceOpen: boolean;
}) {
  const isDirectory = node.children.size > 0;
  const onActivePath = activePath?.startsWith(`${node.path}/`) ?? false;
  const [open, setOpen] = React.useState(
    () => node.findings > 0 || onActivePath,
  );
  const expanded = open || forceOpen || onActivePath;

  const indent = { paddingLeft: `${depth * 0.75 + 0.25}rem` };

  if (!isDirectory && node.file) {
    const active = activePath === node.path;
    return (
      <li>
        <Link
          href={`/r/${encodeURIComponent(reportId)}/f/${node.path
            .split("/")
            .map(encodeURIComponent)
            .join("/")}`}
          style={indent}
          className={cn(
            "flex items-center gap-1.5 rounded py-1 pr-2 transition-colors duration-(--duration-fast)",
            active
              ? "bg-accent-subtle font-medium text-fg"
              : "text-fg-muted hover:bg-surface-hover hover:text-fg",
          )}
          aria-current={active ? "page" : undefined}
        >
          <FileCode className="size-3 shrink-0 text-fg-subtle" aria-hidden />
          <span className="truncate">{node.name}</span>
          {node.findings > 0 && (
            <span className="tabular ml-auto shrink-0 text-fg-subtle">
              {node.findings}
            </span>
          )}
        </Link>
      </li>
    );
  }

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={expanded}
        style={indent}
        className="flex w-full items-center gap-1.5 rounded py-1 pr-2 text-left text-fg-muted transition-colors duration-(--duration-fast) hover:bg-surface-hover hover:text-fg"
      >
        {expanded ? (
          <FolderOpen className="size-3 shrink-0 text-fg-subtle" aria-hidden />
        ) : (
          <Folder className="size-3 shrink-0 text-fg-subtle" aria-hidden />
        )}
        <span className="truncate">{node.name}</span>
        {node.findings > 0 && (
          <span className="tabular ml-auto shrink-0 text-fg-subtle">
            {node.findings}
          </span>
        )}
      </button>

      {expanded && (
        <ul>
          {sortedChildren(node).map((child) => (
            <Node
              key={child.path}
              node={child}
              reportId={reportId}
              activePath={activePath}
              depth={depth + 1}
              forceOpen={forceOpen}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
