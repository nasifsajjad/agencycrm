import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import * as bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { db } from "@/lib/db";
import { PERMISSIONS, ROLE_PERMISSIONS, type Permission } from "@/lib/permissions";

const SESSION_COOKIE = "aos_session";
const SESSION_SECRET = process.env.SESSION_SECRET || "agencyos-local-dev-secret-change-me";
const SESSION_TTL_DAYS = 14;

const encoder = new TextEncoder();

function secretKey() {
  return encoder.encode(SESSION_SECRET);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function createSession(userId: string, meta?: { ipHash?: string; userAgentSummary?: string }) {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  await db.session.create({
    data: {
      userId,
      token,
      expiresAt,
      ipHash: meta?.ipHash ?? null,
      userAgentSummary: meta?.userAgentSummary ?? null,
    },
  });
  await db.user.update({ where: { id: userId }, data: { lastSignInAt: new Date() } });
  return { token, expiresAt };
}

export async function destroySession(token: string): Promise<void> {
  await db.session.deleteMany({ where: { token } });
}

interface SessionPayload {
  sub: string;
  t: string; // session token
  exp?: number;
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  const cookieStore = await cookies();
  const payload: SessionPayload = { sub: token, t: token };
  const jwt = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(secretKey());
  cookieStore.set(SESSION_COOKIE, jwt, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const jwt = cookieStore.get(SESSION_COOKIE)?.value;
  if (!jwt) return null;
  try {
    const { payload } = await jwtVerify(jwt, secretKey());
    const token = (payload as SessionPayload).t;
    if (!token) return null;
    const session = await db.session.findUnique({
      where: { token },
      include: { user: true },
    });
    if (!session || session.expiresAt < new Date()) {
      if (session) await db.session.delete({ where: { id: session.id } });
      return null;
    }
    return session.user;
  } catch {
    return null;
  }
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return user;
}

export async function getUserMemberships(userId: string) {
  return db.workspaceMembership.findMany({
    where: { userId, status: "active" },
    include: {
      workspace: true,
      roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
    },
  });
}

export interface WorkspaceContext {
  workspaceId: string;
  workspaceSlug: string;
  workspaceName: string;
  userId: string;
  membershipId: string;
  roles: string[];
  permissions: Set<Permission>;
  isOwner: boolean;
}

export async function getWorkspaceContext(
  workspaceSlug: string,
  user: { id: string }
): Promise<WorkspaceContext | null> {
  const workspace = await db.workspace.findUnique({ where: { slug: workspaceSlug } });
  if (!workspace) return null;
  const membership = await db.workspaceMembership.findUnique({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
    include: {
      roles: {
        include: {
          role: {
            include: {
              permissions: { include: { permission: true } },
            },
          },
        },
      },
    },
  });
  if (!membership || membership.status !== "active") return null;

  const roles = membership.roles.map((mr) => mr.role.name);
  const permissionSet = new Set<Permission>();
  for (const mr of membership.roles) {
    const roleName = mr.role.name;
    if (roleName === "Owner") {
      PERMISSIONS.forEach((p) => permissionSet.add(p));
    } else {
      const rolePerms = ROLE_PERMISSIONS[roleName] ?? [];
      rolePerms.forEach((p) => permissionSet.add(p));
      mr.role.permissions.forEach((rp) => permissionSet.add(rp.permission.key as Permission));
    }
  }
  const isOwner = roles.includes("Owner") || workspace.ownerId === user.id;

  return {
    workspaceId: workspace.id,
    workspaceSlug: workspace.slug,
    workspaceName: workspace.name,
    userId: user.id,
    membershipId: membership.id,
    roles,
    permissions: permissionSet,
    isOwner,
  };
}

export function can(ctx: WorkspaceContext, permission: Permission): boolean {
  if (ctx.isOwner) return true;
  return ctx.permissions.has(permission);
}

export function requirePermission(ctx: WorkspaceContext, permission: Permission) {
  if (!can(ctx, permission)) {
    throw new AuthorizationError(`Missing permission: ${permission}`);
  }
}

export class AuthorizationError extends Error {
  status = 403;
  constructor(message: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}
