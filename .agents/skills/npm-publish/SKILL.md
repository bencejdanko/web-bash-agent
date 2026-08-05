---
name: npm-publish
description: Build and publish the pugilister package to the npm registry. Handles version bumping, building, and publishing with proper validation steps.
---

# npm Publish Skill

Use this skill when asked to publish, release, or bump the version of the pugilister package.

## Prerequisites

Before publishing, verify:
1. You are logged in to npm: `npm whoami`
2. The package name is correct in `package.json`
3. The `files` field in `package.json` includes `dist` and nothing sensitive
4. 2FA is enabled on the npm account (required for scoped packages with public access)

## Steps

### 1. Ensure you're in the right directory

```bash
cd /home/bence/web-bash-agent
```

### 2. Check current version and git status

```bash
cat package.json | grep '"version"'
git status
git log --oneline -5
```

Ensure there are no uncommitted changes that shouldn't be in the release.

### 3. Build the package

```bash
pnpm run build
```

Verify the `dist/` directory was created with the expected files:

```bash
ls dist/
```

Expected: `index.js`, `index.d.ts`, `server.js`, `server.d.ts`

### 4. Validate the package contents

```bash
npm pack --dry-run
```

This shows exactly what files will be included in the published package. Verify:
- `dist/` files are present
- No `.env`, `node_modules`, or source files are included
- The `package.json` `exports` map is correct

### 5. Bump the version

Choose the appropriate version bump:

```bash
# For bug fixes
npm version patch

# For new features (backwards compatible)
npm version minor

# For breaking changes
npm version major
```

This automatically:
- Updates `package.json`
- Creates a git commit with the version tag
- Creates a git tag (e.g., `v1.0.3`)

### 6. Publish

```bash
npm publish --access public
```

If 2FA is required:
```bash
npm publish --access public --otp=<your-otp-code>
```

### 7. Verify publication

```bash
npm view pugilister version
npm view pugilister dist-tags
```

### 8. Push git tags

```bash
git push && git push --tags
```

---

## Troubleshooting

### "You must be logged in"
```bash
npm login
```

### "Package already exists at that version"
You tried to publish a version that already exists. Bump the version first.

### "Need auth" / 2FA error
Pass `--otp=<code>` from your authenticator app.

### Build artifacts missing
Run `pnpm run build` and check `tsup.config.ts` to ensure the `entry` and `outDir` are correct.

### `exports` map not resolving
Check `package.json` `exports` field. Each subpath (`.`, `./server`) must point to an existing file in `dist/`.

---

## package.json exports map reference

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./server": {
      "types": "./dist/server.d.ts",
      "import": "./dist/server.js"
    }
  }
}
```

The `./server` subpath exports Node.js-only utilities (`getFilesystem`, `getAgentContextFilesystem`).
Always import these from `pugilister/server` — never in browser/client code.
