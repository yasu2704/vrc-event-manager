# LoginButton.test.tsx: bun:test から vitest への移行プラン

## 1. 背景

`apps/frontend/tests/components/LoginButton.test.tsx` は現在 `bun:test` を使用して記述されていますが、プロジェクトのテスト規約 (`.cursor/rules/testing.mdc`) ではフロントエンドのテストに `vitest` を使用することが定められています。このため、`vitest` へ移行する必要があります。

## 2. 現状分析

-   **使用されているAPI:** `describe`, `it`, `expect`, `mock.module` (from `bun:test`)
-   **モック対象:** `next-auth/react`
-   **テストライブラリ:** `@testing-library/react`

## 3. 移行プラン

### ステップ1: 依存関係の確認と追加

-   `apps/frontend/package.json` の `devDependencies` を確認します。
-   以下のパッケージが存在しない場合は追加します:
    -   `vitest`
    -   `@vitejs/plugin-react`
    -   `jsdom`
    -   `@testing-library/dom` (推奨: より詳細なアサーションのため)
    -   `@testing-library/react`
    -   `vite-tsconfig-paths`
-   コマンド例: `pnpm --filter @vrchat-event-manager/frontend add -D vitest @vitejs/plugin-react jsdom @testing-library/dom @testing-library/react vite-tsconfig-paths`

### ステップ2: Vitest 設定ファイルの確認・作成

-   `apps/frontend` ディレクトリに `vitest.config.ts` (または `vite.config.ts` 内の `test` 設定) を確認します。
-   必要に応じて以下の設定を追加または作成します:

    ```typescript
    // vitest.config.ts or vite.config.ts
    import { defineConfig } from 'vitest/config'
    import react from '@vitejs/plugin-react'
    import tsconfigPaths from 'vite-tsconfig-paths'
 
    export default defineConfig({
        plugins: [tsconfigPaths(), react()],
        test: {
        environment: 'jsdom',
        },
    })
    ```

### ステップ3: テストコードの修正

-   **インポート文の変更:**
    ```diff
    - import { describe, it, expect, mock } from 'bun:test';
    + import { describe, it, expect, vi } from 'vitest';
    ```
-   **モックの実装変更:** `mock.module` を `vi.mock` に変更します。
    ```diff
    - mock.module('next-auth/react', () => mockNextAuth());
    + vi.mock('next-auth/react', () => mockNextAuth());
    ```
    *注意:* `mockNextAuth` 関数が `useSession` や `signIn` などをエクスポートするオブジェクトを返す形式であることを確認します。

### ステップ4: テストの実行

-   以下のコマンドでテストを実行し、成功することを確認します:
    ```bash
    pnpm --filter @vrchat-event-manager/frontend test apps/frontend/tests/components/LoginButton.test.tsx
    ```

## 4. 概要図 (Mermaid)

```mermaid
graph TD
    A[依存関係確認・追加] --> B(Vitest設定確認・作成);
    B --> C(テストコード修正);
    C --> D(インポート変更);
    C --> E(モック変更);
    C --> F(アサーション改善 - 任意);
    F --> G(テスト実行);
    D --> G;
    E --> G;

    style A fill:#f9f,stroke:#333,stroke-width:2px
    style B fill:#f9f,stroke:#333,stroke-width:2px
    style C fill:#f9f,stroke:#333,stroke-width:2px
    style G fill:#ccf,stroke:#333,stroke-width:2px