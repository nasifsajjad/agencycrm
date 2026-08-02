import { redirect } from "next/navigation"

/**
 * Root of the authenticated application domain.
 *
 * This route did not exist, so anyone landing on the app's own origin — by
 * typing the domain, following a bookmark, or clicking through from an email
 * signature — got a bare 404 on what looks like the front door of the product.
 * The marketing site owns `/` on its own domain; on this one, `/` should take
 * you where you were going.
 *
 * `/app` already resolves the destination: sign-in when signed out, onboarding
 * when the account has no workspace yet, otherwise the first workspace. Rather
 * than duplicate that decision, defer to it.
 */
export default function AppDomainRoot() {
  redirect("/app")
}
