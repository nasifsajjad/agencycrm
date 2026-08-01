/**
 * Explicit per-app PostCSS config. Next resolves PostCSS by walking up from the
 * app directory, so this app previously relied on finding the repo-root config
 * several levels above it. Declaring it here keeps the app self-contained and
 * independent of the monorepo layout.
 */
const config = {
  plugins: ["@tailwindcss/postcss"],
}

export default config
