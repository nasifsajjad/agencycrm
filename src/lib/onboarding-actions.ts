"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { bootstrapWorkspace } from "@/lib/workspace";
import { seedDemoAgency } from "@/lib/seed";

function isSafeSlug(s: string): boolean {
  return /^[a-z0-9-]{2,40}$/.test(s) && !s.startsWith("-") && !s.endsWith("-");
}

export async function createWorkspaceAction(input: { name: string; slug: string; currency: string; timezone: string }) {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in." };
  if (!input.name.trim()) return { error: "Workspace name is required." };
  if (!isSafeSlug(input.slug)) return { error: "Slug must be 2-40 lowercase letters, digits, or hyphens." };
  const existing = await db.workspace.findUnique({ where: { slug: input.slug } });
  if (existing) return { error: "That slug is taken. Try another." };

  const result = await bootstrapWorkspace({
    name: input.name.trim(),
    slug: input.slug,
    ownerId: user.id,
    currency: input.currency,
    timezone: input.timezone,
  });

  // Audit workspace creation
  await db.auditEvent.create({
    data: {
      workspaceId: result.workspaceId,
      actorUserId: user.id,
      action: "workspace.created",
      entityType: "workspace",
      entityId: result.workspaceId,
      afterJson: { name: input.name, slug: input.slug },
    },
  });

  return { slug: input.slug };
}

export async function loadDemoDataAction(input: { name: string; slug: string; currency: string; timezone: string }) {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in." };
  if (!isSafeSlug(input.slug)) return { error: "Slug must be 2-40 lowercase letters, digits, or hyphens." };
  const existing = await db.workspace.findUnique({ where: { slug: input.slug } });
  if (existing) return { error: "That slug is taken. Try another." };

  const result = await bootstrapWorkspace({
    name: input.name.trim() || "Northstar Growth Studio",
    slug: input.slug,
    ownerId: user.id,
    currency: input.currency,
    timezone: input.timezone,
  });

  await seedDemoAgency(result.workspaceId, user.id);

  await db.auditEvent.create({
    data: {
      workspaceId: result.workspaceId,
      actorUserId: user.id,
      action: "workspace.demo_loaded",
      entityType: "workspace",
      entityId: result.workspaceId,
      afterJson: { name: input.name, slug: input.slug },
    },
  });

  return { slug: input.slug };
}
