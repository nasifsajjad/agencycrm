import { vi } from "vitest"

// `server-only` deliberately throws when evaluated outside Next's server
// compiler. Unit tests execute server modules directly, so provide the same
// marker as a no-op in the test runtime.
vi.mock("server-only", () => ({}))
