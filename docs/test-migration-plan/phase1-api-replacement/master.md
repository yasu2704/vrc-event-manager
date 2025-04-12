# フェーズ1: テストフレームワーク API の置換

**目標:** `vitest` 固有のテスト構造とライフサイクルフックを `Deno.test` に置き換え、同時にソースコードとテストコードの連携を確保する。

## 同時移行のメリット

テストフレームワークのAPIを置き換える際、ソースコードと一貫性を持って移行することで、テストの有効性を確保できます。これにより、変換後のテストが実際のコードの挙動を正確に検証できます。

## 具体的な作業:

### 1. テストファイル (`build-rules.test.ts`) の変更

#### 1.1 `describe` / `test` の置換:
*   **変更前:**
    ```typescript
    describe('buildClineRules', () => {
      test('ルールファイルが存在する場合...', async () => {
        // ... test logic ...
      });
    });
    ```
*   **変更後:** `Deno.test` を使用。
    ```typescript
    import { assertEquals, assertMatch, assertRejects } from "@std/assert"; // importMap を利用

    Deno.test("buildClineRules", async (t) => { // t はテストコンテキスト
      await t.step("ルールファイルが存在する場合...", async () => {
        // ... test logic ...
      });

      // 他の step を追加可能
    });
    ```
*   **注意点:** `Deno.test` は非同期関数を受け入れます。`t.step` を使ってテストをネストできます。

#### 1.2 `beforeEach` / `afterEach` の置換:
*   **変更前:**
    ```typescript
    beforeEach(() => {
      vi.resetAllMocks();
      // ... setup ...
    });
    afterEach(() => {
      vi.restoreAllMocks();
    });
    ```
*   **変更後:** `try...finally` パターンを使用してモックのリセットと復元を行います。
    ```typescript
    Deno.test("buildClineRules", async (t) => {
      // テスト全体で使うスタブを定義
      const originalStat = Deno.stat;
      const originalMkdir = Deno.mkdir;
      const mockStat = spy(() => Promise.resolve({ isDirectory: () => true }));
      const mockMkdir = spy(() => Promise.resolve());
      
      // 各テストステップで個別に try/finally を使用
      await t.step("ルールファイルが存在する場合...", async () => {
        try {
          // このテストステップのセットアップ
          Deno.stat = mockStat as unknown as typeof Deno.stat;
          Deno.mkdir = mockMkdir as unknown as typeof Deno.mkdir;
          
          // スパイのリセット
          mockStat.calls.length = 0;
          mockMkdir.calls.length = 0;
          
          // ... test logic ...
        } finally {
          // このテストステップのクリーンアップ
          Deno.stat = originalStat;
          Deno.mkdir = originalMkdir;
        }
      });
    });
    ```
*   **注意点:** 個々のテストステップ内で `try...finally` を使用し、テスト終了時に必ずモックを元に戻すようにします。

### 2. ソースファイル (`build-rules.ts`) の変更

ソースファイルにおいても、Deno環境での実行を前提とした変更が必要です。

#### 2.1 モジュールシステムの変更:
*   **変更前:**
    ```typescript
    // CommonJS スタイル
    module.exports = { buildClineRules };
    // または ES Modules スタイル
    export { buildClineRules };
    ```
*   **変更後:** ESモジュールに統一
    ```typescript
    // 常にESモジュールスタイルを使用
    export { buildClineRules };
    ```

#### 2.2 スクリプト実行方法の変更:
*   **変更前:**
    ```typescript
    // Node.js スタイル
    if (require.main === module) {
      buildClineRules();
    }
    ```
*   **変更後:** Denoの`import.meta.main`を使用
    ```typescript
    // Denoスタイル
    if (import.meta.main) {
      await buildClineRules();
    }
    ```

#### 2.3 コードと型定義の統合:
*   Denoはデフォルトで型チェックが有効なので、JSDocコメントやTSファイルを使って型定義を提供します
*   ソースコードとテストコードの両方で同じ型定義を使用できるようにします

## 移行の順序

1. まず、ソースファイルとテストファイルの両方で使用するモジュールシステムをESモジュールに統一
2. Denoのテスト構造に合わせてテストファイルを変換
3. ソースファイルのエントリーポイント処理をDenoスタイルに適応
4. テストの実行方法をDenoのテストランナーに対応させる

この順序で進めることで、移行中のコードの整合性を保ちながら、段階的に変更を適用できます。