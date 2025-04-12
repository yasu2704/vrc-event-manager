# フェーズ2: モジュールのインポートと型の調整

**目標:** Node.js 固有のモジュールと型を Deno のものに置き換え、ソースコードとテストコードの一貫性を確保する。

## 同時移行アプローチ

テストファイルとソースファイルを同時に移行することで、互換性の問題を早期に発見し、効率的に移行作業を進められます。この同時移行により、テストの有効性を保ちながら、コードの品質を確保できます。

## ソースファイル (`build-rules.ts`) の移行

### 1. `node:fs/promises` の置換:
*   **変更前:** `import { stat, mkdir, readFile, writeFile, readdir } from 'node:fs/promises';`
*   **変更後:** `Deno` グローバルオブジェクトのメソッドを使用。インポートは不要。
    *   `stat` -> `Deno.stat`
    *   `mkdir` -> `Deno.mkdir`
    *   `readFile` -> `Deno.readTextFile` (UTF-8 テキストを読み込む場合)
    *   `writeFile` -> `Deno.writeTextFile` (UTF-8 テキストを書き込む場合)
    *   `readdir` -> `Deno.readDir` を使用してファイル名のリストを取得

### 2. `node:path` の置換:
*   **変更前:** `import { resolve, dirname } from 'node:path';`
*   **変更後:** `deno/std/path` を使用。
    ```typescript
    import { resolve, dirname } from "@std/path"; // importMap を利用
    ```

### 3. `node:url` の置換:
*   **変更前:** `import { fileURLToPath } from 'node:url';`
*   **変更後:** `deno/std/path/from_file_url.ts` を使用。
    ```typescript
    import { fromFileUrl } from "@std/path/from-file-url"; // importMap を利用
    const __dirname = dirname(fromFileUrl(import.meta.url));
    ```

### 4. `process.exit()` の置換:
*   **変更前:** `process.exit(1);`
*   **変更後:** `Deno.exit(1);`

### 5. 型の調整:
*   Node.js 固有の型を Deno の型に置き換える。例えば、`StatsBase` を `Deno.FileInfo` に変更。

### 6. `readdir` の実装の変更:
*   `Deno.readDir` は非同期イテレータを返すため、配列に変換するロジックが必要。

```typescript
// 変更前
const allEntries = await readdir(dirPath);

// 変更後
const allEntries: string[] = [];
for await (const entry of Deno.readDir(dirPath)) {
  allEntries.push(entry.name);
}
```

### 7. `import.meta.main` の使用:
*   **変更前:** `if (require.main === module)`
*   **変更後:** `if (import.meta.main)`

### 8. `chalk` の置換:
*   **変更前:** `import chalk from 'npm:chalk';`
*   **変更後:** `deno/std/fmt/colors.ts` を使用。
    ```typescript
    import { red, dim, yellow, cyan, blue, green, bold } from "@std/fmt/colors"; // importMap を利用
    ```
*   コード内の `chalk.red(...)` などを `red(...)` に、`chalk.blue.bold(...)` などを `bold(blue(...))` に置き換えます。


## テストファイル (`build-rules.test.ts`) の移行

### 1. Denoのテスト関連モジュールのインポート:
```typescript
import { assertEquals, assertStringIncludes } from "@std/assert"; // importMap を利用
import { assertSpyCalls, spy } from "@std/testing/mock"; // importMap を利用
import { fromFileUrl, dirname, resolve } from "@std/path"; // importMap を利用
```

### 2. ファイルシステム関数のモック:
```typescript
// 型定義
type StatFn = (path: string) => Promise<Deno.FileInfo>;
type ReadTextFileFn = (path: string) => Promise<string>;
type WriteTextFileFn = (path: string, content: string) => Promise<void>;
type MkdirFn = (path: string, options?: { recursive?: boolean }) => Promise<void>;

// 初期モック関数
const statFn: StatFn = () => Promise.resolve({
  isFile: false,
  isDirectory: true,
  isSymlink: false,
  size: 0,
  mtime: null,
  atime: null,
  birthtime: null,
});

const readTextFileFn: ReadTextFileFn = () => Promise.resolve("");
const writeTextFileFn: WriteTextFileFn = () => Promise.resolve();
const mkdirFn: MkdirFn = () => Promise.resolve();

// スパイでラップ
const mockStat = spy(statFn);
const mockReadTextFile = spy(readTextFileFn);
const mockWriteTextFile = spy(writeTextFileFn);
const mockMkdir = spy(mkdirFn);

// Denoオブジェクトの関数をモックに置き換え
const originalStat = Deno.stat;
const originalReadTextFile = Deno.readTextFile;
const originalWriteTextFile = Deno.writeTextFile;
const originalMkdir = Deno.mkdir;

Deno.stat = mockStat as unknown as typeof Deno.stat;
Deno.readTextFile = mockReadTextFile as unknown as typeof Deno.readTextFile;
Deno.writeTextFile = mockWriteTextFile as unknown as typeof Deno.writeTextFile;
Deno.mkdir = mockMkdir as unknown as typeof Deno.mkdir;

// readDir関数のモック（非同期イテレータを返す）
const mockReadDirEntries: Deno.DirEntry[] = [];
const mockReadDir = spy(() => {
  let index = 0;
  return {
    async next() {
      if (index < mockReadDirEntries.length) {
        return { value: mockReadDirEntries[index++], done: false };
      }
      return { value: undefined, done: true };
    },
    [Symbol.asyncIterator]() {
      return this;
    },
  };
});

Deno.readDir = mockReadDir as unknown as typeof Deno.readDir;
```

### 3. モックのクリーンアップ:
```typescript
// テスト終了後に元の関数を復元
Deno.test({
  name: "buildClineRules",
  fn: async (t) => {
    try {
      // テスト実装
    } finally {
      // 元の関数を復元
      Deno.stat = originalStat;
      Deno.readTextFile = originalReadTextFile;
      Deno.writeTextFile = originalWriteTextFile;
      Deno.mkdir = originalMkdir;
      Deno.readDir = originalReadDir;
    }
  }
});
```

### 4. テストケースでのモック関数の使用:
```typescript
await t.step("ルールファイルが存在する場合", async () => {
  // モックの設定
  mockReadDirEntries.length = 0;
  mockReadDirEntries.push(
    { name: "base.mdc", isFile: true, isDirectory: false, isSymlink: false } as Deno.DirEntry,
    { name: "another.mdc", isFile: true, isDirectory: false, isSymlink: false } as Deno.DirEntry
  );
  
  // スパイのリセット
  mockStat.calls.length = 0;
  mockReadTextFile.calls.length = 0;
  mockWriteTextFile.calls.length = 0;
  mockMkdir.calls.length = 0;
  mockReadDir.calls.length = 0;
  
  // テスト対象関数の実行
  await buildClineRules();
  
  // アサーション
  assertSpyCalls(mockStat, 2);
  assertSpyCalls(mockReadDir, 1);
  assertSpyCalls(mockReadTextFile, 2);
  assertSpyCalls(mockWriteTextFile, 2);
});
```

## pnpmワークスペース環境での移行時の注意点

1. **依存関係の管理:**
   * `package.json` から `vitest` 依存を削除
   * 必要に応じて `deno` コマンドの実行方法をスクリプトに追加

2. **ファイルパスの解決:**
   * Node.js の `__dirname` と Deno の `import.meta.url` + `fromFileUrl` では動作が異なる場合がある
   * ワークスペースのルートからの相対パスの解決方法を調整する必要がある

3. **モジュール解決の違い:**
   * Node.js/NPM の依存解決と Deno のURL ベースの依存解決の違いに注意
   * `npm:` プレフィックスを使って npm パッケージを利用する場合は注意が必要

4. **実行コマンド:**
   * pnpmワークスペース内でのDeno実行コマンドの例:
     ```bash
     pnpm --filter cursor-rules exec deno test -A build-rules.test.ts
     ```

## 移行完了後の検証

1. ソースファイルとテストファイルの両方が正常に動作することを確認
2. pnpmワークスペース環境内でコマンドが正常に実行できることを検証
3. CI/CDパイプラインでテストが正常に実行されることを確認