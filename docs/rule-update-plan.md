# .cursor/rules/*.mdc 更新計画

## 変更概要

*   **パッケージマネージャー**: `bun` -> `pnpm`
*   **テストフレームワーク**:
    *   `apps/frontend`: `bun:test` -> `vitest`
    *   その他: `bun:test` -> `deno test`
*   **ランタイム**:
    *   `apps/frontend`: `bun` -> `Node.js`
    *   その他: `bun` -> `deno`
*   **テストファイルの配置**:
    *   `apps/frontend`: `apps/frontend/tests/` ディレクトリ、ファイル名は `*.test.ts` または `*.test.tsx`
    *   その他: 実装ファイルと同じディレクトリ、ファイル名は `*.test.ts`
*   **削除ファイル**: `bun-test-mock.mdc`

## ファイルごとの変更詳細

### 1. `basic-design.mdc`

*   **2.2 技術選定理由:**
    *   パッケージマネージャーを `pnpm` に変更。
    *   テストフレームワークを `vitest (apps/frontend), deno test (その他)` に変更。
    *   開発環境ランタイムを `Node.js LTS (apps/frontend), Deno (その他)` に変更。
*   **7.3 テスト計画:**
    *   ユニットテストフレームワークを `vitest (apps/frontend), deno test (その他)` に変更。
*   **10.1 ディレクトリ構造:**
    *   バックエンドのテストディレクトリに関する記述を、新しいルール（実装ファイルと同階層）に合わせて注釈変更 (`# テスト (実装ファイルと同階層に *.test.ts を配置)`)。
*   **10.2 テストファイルの配置規則:**
    *   ユニットテストの配置場所を `apps/frontend は apps/frontend/tests/ に配置。その他のパッケージは実装ファイルと同じディレクトリに *.test.ts を配置。` に変更。
*   **10.4.3 スクリプト実行規則:**
    *   `bun` コマンド (`bun run`, `bun test`) を `pnpm` コマンド (`pnpm run`, `pnpm test`, `pnpm --filter`) に変更。

### 2. `implementation.mdc`

*   **## コーディング規約:**
    *   ランタイムを `apps/frontend では Node.js、それ以外のパッケージでは Deno を利用` に変更。

### 3. `testing.mdc`

*   **## 基本設定:**
    *   テストフレームワークを `apps/frontend は vitest、それ以外のパッケージは deno test` に変更。
    *   テスト実行コマンド例を `pnpm test`, `pnpm --filter ... test`, `deno test` に変更。
    *   E2Eテスト実行コマンド例を `pnpm test:e2e` に変更。
    *   Vitest/Jest の使用に関する記述を修正。
    *   Bun のモックに関する参照を削除し、Vitest/Deno のモック方法に関する記述または参照を追加。
*   **## ディレクトリ構造:**
    *   セクション全体を新しいテストファイル配置ルールに合わせて書き換え。
*   **## ファイル命名規則:**
    *   ユニットテストのファイル名に `*.test.tsx` も許容することを明記。
*   **## TDDサイクル:**
    *   テスト実行コマンド例を `pnpm --filter ... test` や `deno test` に変更。
*   **## テストの種類と配置:**
    *   ユニットテストの `location` を `apps/frontend/tests/ (frontend), ./ (その他)` に変更。
*   **## bunでモックする時:**
    *   セクション全体を削除。

### 4. `bun-test-mock.mdc`

*   このファイルは削除します。

### 5. `package-json-template.mdc`

*   **## ルートpackage.json:**
    *   `scripts` 内の `bun` コマンドを `pnpm` コマンドに置き換え。
*   **## フロントエンドpackage.json:**
    *   `scripts.test` を `vitest run` に変更。
    *   `devDependencies` に `vitest`, `happy-dom` などを追加する記述を追加。
*   **## バックエンドのpackage.json:**
    *   `scripts.dev` を `deno run ...` に変更。
    *   `scripts.build` を削除または `deno compile ...` に変更。
    *   `scripts.test` を `deno test ...` に変更 (適切なパーミッションフラグ付き)。

### 6. `git-commit.mdc`

*   変更なし。