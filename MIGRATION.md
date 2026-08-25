# TypeScript implementation roadmap

The TypeScript implementation is additive: the Java implementation remains the
behavioural reference while `packages/` grows into independently publishable npm
packages. Java fixtures, JUnit integration, OGNL, and Java extension JARs are not
binary compatibility targets.

## Compatibility profile

| Capability | MVP | Later |
| --- | --- | --- |
| XHTML specifications and `concordion:*` attributes | Yes | Golden-output parity |
| `data-concordion-*` attributes | Yes | — |
| TypeScript fixtures, including async methods | Yes | Fixture scopes and full lifecycle |
| `set`, `execute`, `assertEquals`, `assertTrue`, `assertFalse`, `echo` | Yes | Tables and lists |
| HTML living-documentation output | Yes | High-fidelity Java styling |
| Markdown | No | remark-based parser |
| `verifyRows`, `run`, nested specifications | No | Yes |
| OGNL | No | Migration guide and pluggable evaluators |
| JUnit / Java fixtures | No | Not planned |

## Expression profile

The default evaluator intentionally accepts only variables, property/index
access, literals, and fixture method calls. It does not use `eval` or
`new Function`. Consumers can provide another `Evaluator` when their trust model
requires a broader expression language.

## Milestones

1. **Core skeleton (implemented):** strict TypeScript workspace, async command
   contracts, restricted evaluator, HTML parser, basic commands, result summary,
   specification hooks, and report rendering. XHTML namespace documents use the
   strict XML parser while ordinary `data-concordion-*` documents use HTML5 parsing.
2. **Core compatibility:** command-tree rewriting, tables/lists, examples,
   fixture hooks, output resources, and a Java/TypeScript golden suite.
3. **Cross-specification execution:** `verifyRows`, `run`, caching, fail-fast,
   breadcrumbs, and aggregate totals.
4. **Markdown:** translate the Concordion Markdown syntax into the common HTML
   command tree.
5. **Tooling:** `@concordion/cli` and `@concordion/vitest`, followed by extension
   APIs and npm publishing.

## MVP acceptance criteria

- A TypeScript fixture can execute XHTML or HTML-friendly commands.
- Fixture calls and commands may be asynchronous.
- Passing, failing, and exceptional commands are counted and decorated in the
  generated HTML.
- The core package has no test-runner dependency and emits ESM declarations.

## Applying this work to a branch with Node configuration

The TypeScript preview adds root `package.json` and `tsconfig.json` files. If the
target branch already has either file, apply the commit with Git and merge the
JSON objects rather than choosing the complete `ours` or `theirs` version:

```shell
git switch <target-branch>
git cherry-pick 9be697d
# Resolve package.json and tsconfig.json as described below.
git add package.json tsconfig.json
git cherry-pick --continue
npm install
npm run check:ts
./gradlew test
```

For `package.json`, preserve the target application's existing fields and merge
in the following pieces:

- `packages/*` in the `workspaces` array;
- the `build:ts`, `test:ts`, and `check:ts` scripts (rename them if the target
  already uses those names); and
- the TypeScript, Vitest, and Node type development dependencies.

For `tsconfig.json`, preserve the target compiler options and add
`{ "path": "./packages/core" }` to its project `references`. If the existing
file is not a TypeScript solution configuration, it is also valid to leave it
unchanged and create `tsconfig.concordion.json` containing the preview's
`files`/`references`; in that case, change `build:ts` to
`tsc -b tsconfig.concordion.json && tsc -p packages/core/tsconfig.test.json`.

Files reported as **skipped** usually already have the relevant change. Verify
that `.gitignore` excludes `node_modules`, `packages/*/dist`, `*.tsbuildinfo`,
and `coverage`, and that the README contains the TypeScript preview link. Do not
restore or overwrite unrelated target-branch content in either file.

To abandon a partial application safely, run `git cherry-pick --abort`. After a
successful resolution, `git status --short` should be empty and both the Node
and Java checks above should pass.
