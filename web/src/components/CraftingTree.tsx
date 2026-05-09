"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { ChevronRight, ChevronDown, GitBranch } from "lucide-react";
import type { CraftingTreeNode } from "@/lib/craftingTree";

export function CraftingTree({
  root,
  label = "Full crafting tree",
}: {
  root: CraftingTreeNode;
  label?: string;
}) {
  // Default open state: collapsed at root, expanded one level. Past that the
  // user opts in. Big trees stay readable.
  return (
    <div className="text-sm">
      <h3 className="text-xs uppercase tracking-wider text-[var(--color-fg-3)] mb-2 flex items-center gap-1.5">
        <GitBranch size={11} />
        {label}
      </h3>
      <ul className="space-y-1">
        {root.children.map((child, i) => (
          <TreeItem key={i} node={child} depth={0} defaultOpen={true} />
        ))}
      </ul>
    </div>
  );
}

function TreeItem({
  node,
  depth,
  defaultOpen = false,
}: {
  node: CraftingTreeNode;
  depth: number;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const hasChildren = node.children.length > 0;

  return (
    <li>
      <div
        className="flex items-center gap-2 py-0.5"
        style={{ paddingLeft: `${depth * 16}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={`${open ? "Collapse" : "Expand"} ${node.name}`}
            className="text-[var(--color-fg-3)] hover:text-[var(--color-fg-1)]"
          >
            {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        ) : (
          <span className="w-3" aria-hidden="true" />
        )}

        {node.imageUrl ? (
          <Image
            src={node.imageUrl}
            alt=""
            width={20}
            height={20}
            className="bg-[var(--color-bg-3)] rounded p-0.5 shrink-0"
            unoptimized
          />
        ) : (
          <span className="w-5" aria-hidden="true" />
        )}

        <span className="text-[var(--color-fg-2)] font-mono text-xs shrink-0">
          {node.qty}×
        </span>

        {node.slug ? (
          <Link
            href={`/items/${node.slug}`}
            className="text-[var(--color-fg-1)] hover:text-[var(--color-gold)] truncate"
          >
            {node.name}
          </Link>
        ) : (
          <span className="text-[var(--color-fg-1)] truncate">{node.name}</span>
        )}

        <span className="text-[10px] text-[var(--color-fg-3)] font-mono shrink-0">
          T{node.tier}
        </span>

        {!hasChildren && (
          <span className="text-[9px] uppercase tracking-wider text-[var(--color-emerald)]/70 shrink-0">
            base
          </span>
        )}
      </div>
      {open && hasChildren && (
        <ul>
          {node.children.map((child, i) => (
            <TreeItem key={i} node={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}
