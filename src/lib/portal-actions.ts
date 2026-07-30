"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

export async function createClientRequestAction(workspaceSlug: string, clientId: string, portalSlug: string, formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const priority = String(formData.get("priority") ?? "normal");
  if (!title) return { error: "Title is required." };

  const portal = await db.clientPortal.findUnique({ where: { slug: portalSlug } });
  if (!portal) return { error: "Portal not found." };

  await db.clientRequest.create({
    data: {
      workspaceId: portal.workspaceId,
      clientId,
      title,
      description: description || null,
      priority,
      status: "new",
    },
  });

  revalidatePath(`/portal/${portalSlug}/requests`);
  return { ok: true };
}
