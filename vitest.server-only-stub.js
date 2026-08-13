// vitest-only stand-in for the "server-only" package. That package's default export
// unconditionally throws and only resolves safely under Next's "react-server" bundler
// condition — vitest doesn't know about that condition, so every file that does
// `import "server-only"` needs this alias (see vitest.config.ts) to be unit-testable.
export {};
