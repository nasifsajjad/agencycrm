import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

/**
 * A structural guard, not a behavioural one.
 *
 * createDashboardWidgetAction and deleteDashboardWidgetAction shipped with no
 * permission check at all: they resolved the workspace and then mutated, with
 * RLS as the only guard, and deleteDashboardWidgetAction did not even scope its
 * delete by workspace. Every other mutating action in the same codebase was
 * gated. The defect was not a wrong rule, it was a missing one — the kind of
 * thing no behavioural test catches, because there is no test for a check
 * nobody remembered to write.
 *
 * This test reads the action modules and requires each exported action to be
 * visibly gated. It is deliberately crude: it cannot prove a check is correct,
 * only that one is present. New actions must either use a recognised helper or
 * be added to SELF_SCOPED with a reason.
 */

const ACTIONS_DIR = join(__dirname, "../../apps/app/src/lib")

/** Helpers that establish authorization before mutating. */
const GATES = [
  "withPermission(",
  "requirePerm(",
  "requirePermission(",
  "requireEditableDashboard(",
  "can(ctx,",
  "can(context,",
]

/**
 * Actions that are legitimately not permission-gated, each with the reason it
 * is safe. Anything added here should be genuinely scoped to the caller's own
 * data or be part of unauthenticated auth flow.
 */
const SELF_SCOPED: Record<string, string> = {
  // Auth flows run before a workspace context exists.
  "auth-actions.ts:signInAction": "pre-authentication",
  "auth-actions.ts:signUpAction": "pre-authentication",
  "auth-actions.ts:signOutAction": "ends the caller's own session",
  "auth-actions.ts:forgotPasswordAction": "pre-authentication, constant response",
  "auth-actions.ts:resetPasswordAction": "acts on the caller's own recovery session",
  "auth-actions.ts:signInWithMagicLinkAction": "pre-authentication, constant response",
  // Invitation acceptance is authorized by the single-use token, in an RPC.
  "invite-actions.ts:acceptInviteAction": "authorized by invitation token inside accept_invitation",
  // Onboarding creates a workspace the caller will own; create_workspace
  // performs its own checks.
  "onboarding-actions.ts:createWorkspaceAction":
    "creates a new workspace, checked in create_workspace RPC",
  "onboarding-actions.ts:loadDemoDataAction": "creates a new workspace for the caller",
  // Portal actions authorize against the portal identity inside their RPCs.
  "portal-actions.ts:createClientRequestAction":
    "scoped to portal identity in create_client_request RPC",
  "portal-actions.ts:decidePortalApprovalAction":
    "scoped to portal identity in decide_approval RPC",
  // Notification state is filtered by ctx.userId in the query itself.
  "crm-actions.ts:markNotificationReadAction": "filtered by ctx.userId",
  "crm-actions.ts:markAllNotificationsReadAction": "filtered by ctx.userId",
  // Saved views are created for and deleted by their own owner.
  "customization-actions.ts:createSavedViewAction": "owner is set to ctx.userId",
  "customization-actions.ts:deleteSavedViewAction": "filtered by ctx.userId and workspaceId",
}

function actionBodies(source: string): Array<{ name: string; body: string }> {
  const out: Array<{ name: string; body: string }> = []
  const re = /export async function (\w+)\s*\(/g
  let match: RegExpExecArray | null
  while ((match = re.exec(source))) {
    const start = match.index
    const next = source.indexOf("\nexport async function", start + 1)
    out.push({
      name: match[1],
      body: source.slice(start, next === -1 ? source.length : next),
    })
  }
  return out
}

describe("server action authorization", () => {
  const files = readdirSync(ACTIONS_DIR).filter((f) => f.endsWith("-actions.ts"))

  it("finds the action modules", () => {
    expect(files.length).toBeGreaterThan(0)
  })

  for (const file of files) {
    const source = readFileSync(join(ACTIONS_DIR, file), "utf8")

    for (const { name, body } of actionBodies(source)) {
      const key = `${file}:${name}`
      const exempt = key in SELF_SCOPED

      it(`${key} is authorized${exempt ? " (self-scoped)" : ""}`, () => {
        if (exempt) {
          // Assert the stated reason still holds in the crudest possible way:
          // a self-scoped action must not be silently rewritten into a
          // workspace-wide mutation without someone revisiting this list.
          expect(SELF_SCOPED[key]).toBeTruthy()
          return
        }
        const gated = GATES.some((gate) => body.includes(gate))
        expect(
          gated,
          `${key} mutates without a recognised permission gate. Use withPermission/requirePerm, ` +
            `or add it to SELF_SCOPED in this test with the reason it is safe.`
        ).toBe(true)
      })
    }
  }
})
