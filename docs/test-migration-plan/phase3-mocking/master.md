# フェーズ3: モックの実装変更

**目標:** `vitest` のモック API を `deno/std/testing/mock` の関数に置き換え、同時にソースコードとテストコードの連携を確保する。

## 同時移行のアプローチ

モックの実装を変更する際は、ソースコードの変更と連動してテストコードの変更も行います。これにより、Denoの環境で動作するソースコードと、そのコードを正確にテストするモックの一貫性を確保できます。

## ソースファイル (`build-rules.ts`) のための準備

### 1. 依存モジュールの変換
ソースコードをモックしやすい設計に変更します。具体的には：

* ファイルシステム操作のラッパー関数を作成し、テストでモック可能にする
* 外部依存を明示的なインポートとして表現する
* 純粋関数とサイドエフェクトを持つ関数を分離する

```typescript
// 変更前
import { readdir, readFile, writeFile, mkdir, stat } from 'node:fs/promises';

// 変更後
// (fmt/colors.ts は標準モジュールなのでインポートのみ)
import { red, dim, yellow, cyan, blue, green, bold } from "@std/fmt/colors"; // importMap を利用

// ファイルシステム操作のラッパー - テストのモック対象
export const fileSystem = {
  stat: Deno.stat,
  mkdir: Deno.mkdir,
  readTextFile: Deno.readTextFile,
  writeTextFile: Deno.writeTextFile,
  readDir: Deno.readDir,
};

// 以降のコードではfileSystemオブジェクト経由でファイルシステム操作を実行
```

## テストファイル (`build-rules.test.ts`) のモック実装

### 1. `vi.mock('node:fs/promises', ...)` の置換:
*   **変更前:**
    ```typescript
    vi.mock('node:fs/promises', async () => {
      return {
        stat: vi.fn(),
        mkdir: vi.fn(),
        rm: vi.fn(),
        writeFile: vi.fn(),
        readdir: vi.fn(),
        readFile: vi.fn(),
      };
    });
    
    vi.mocked(mockStat).mockResolvedValue(mockStats);
    ```
*   **変更後:** `spy` を使用して `fileSystem` オブジェクトのメソッドをモック。
    ```typescript
    import { spy } from "@std/testing/mock"; // importMap を利用
    import { fileSystem } from "./build-rules.ts";
    
    // 元の関数をバックアップ
    const originalStat = fileSystem.stat;
    const originalMkdir = fileSystem.mkdir;
    const originalReadTextFile = fileSystem.readTextFile;
    const originalWriteTextFile = fileSystem.writeTextFile;
    const originalReadDir = fileSystem.readDir;
    
    // 型定義
    type StatFn = typeof fileSystem.stat;
    type MkdirFn = typeof fileSystem.mkdir;
    type ReadTextFileFn = typeof fileSystem.readTextFile;
    type WriteTextFileFn = typeof fileSystem.writeTextFile;
    
    // モック関数を作成
    const statFn: StatFn = () => Promise.resolve({ 
      isFile: false,
      isDirectory: true,
      isSymlink: false,
      size: 0,
      mtime: null,
      atime: null,
      birthtime: null,
    });
    
    const mkdirFn: MkdirFn = () => Promise.resolve();
    const readTextFileFn: ReadTextFileFn = () => Promise.resolve("");
    const writeTextFileFn: WriteTextFileFn = () => Promise.resolve();
    
    // スパイでラップ
    const mockStat = spy(statFn);
    const mockMkdir = spy(mkdirFn);
    const mockReadTextFile = spy(readTextFileFn);
    const mockWriteTextFile = spy(writeTextFileFn);
    
    // テスト内でモックを設定
    Deno.test("buildClineRules", async (t) => {
      await t.step("ルールファイルが存在する場合", async () => {
        try {
          // モックを設定
          fileSystem.stat = mockStat;
          fileSystem.mkdir = mockMkdir;
          fileSystem.readTextFile = mockReadTextFile;
          fileSystem.writeTextFile = mockWriteTextFile;
          
          // readDirのモック（非同期イテレータ）
          const mockEntries = [
            { name: "base.mdc", isFile: true, isDirectory: false, isSymlink: false },
            { name: "another.mdc", isFile: true, isDirectory: false, isSymlink: false }
          ] as Deno.DirEntry[];
          
          fileSystem.readDir = spy(() => {
            let index = 0;
            return {
              [Symbol.asyncIterator]() { return this; },
              async next() {
                if (index < mockEntries.length) {
                  return { value: mockEntries[index++], done: false };
                }
                return { value: undefined, done: true };
              }
            };
          });
          
          // スパイのリセット
          mockStat.calls.length = 0;
          mockMkdir.calls.length = 0;
          mockReadTextFile.calls.length = 0;
          mockWriteTextFile.calls.length = 0;
          
          // テスト実行
          await buildClineRules();
          
          // アサーション
          // ...
        } finally {
          // 元の関数を復元
          fileSystem.stat = originalStat;
          fileSystem.mkdir = originalMkdir;
          fileSystem.readTextFile = originalReadTextFile;
          fileSystem.writeTextFile = originalWriteTextFile;
          fileSystem.readDir = originalReadDir;
        }
      });
    });
    ```

### 2. `chalk` のモック (不要)
*   `chalk` は Deno 標準モジュール `fmt/colors.ts` に置き換えられたため、モックは不要です。

### 3. `vi.spyOn(console, ...)` の置換:
*   **変更前:**
    ```typescript
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    ```
*   **変更後:** `spy` を使用。
    ```typescript
    import { spy } from "@std/testing/mock"; // importMap を利用
    
    // コンソールロガーサービスをソースコードで分離
    export const logger = {
      log: console.log,
      warn: console.warn,
      error: console.error,
    };
    
    // テストコードでのモック
    Deno.test("buildClineRules", async (t) => {
      // 元の関数をバックアップ
      const originalLog = logger.log;
      const originalWarn = logger.warn;
      const originalError = logger.error;
      
      await t.step("ルールファイルが存在する場合", async () => {
        try {
          // モック関数を作成してスパイでラップ
          const mockLog = spy(() => {});
          const mockWarn = spy(() => {});
          const mockError = spy(() => {});
          
          // モックを設定
          logger.log = mockLog;
          logger.warn = mockWarn;
          logger.error = mockError;
          
          // テスト実行
          await buildClineRules();
          
          // アサーション
          // ...
        } finally {
          // 元の関数を復元
          logger.log = originalLog;
          logger.warn = originalWarn;
          logger.error = originalError;
        }
      });
    });
    ```

## 移行の主なポイント

1. **依存性の明示的な分離**
   * ソースコードの依存関係を明示的なオブジェクトとして抽出する
   * これにより、テストコードでの置き換えが容易になる

2. **関数型アプローチ**
   * 純粋関数とサイドエフェクトを分離する
   * 外部依存は引数として受け取るか、モック可能なオブジェクトから参照する

3. **非同期イテレータのモック**
   * `Deno.readDir`のような非同期イテレータを返す関数は、適切にモックする
   * Symbol.asyncIteratorとnextメソッドを持つオブジェクトを実装する

4. **適切なクリーンアップ**
   * `try...finally`パターンを使用して、テストの終了時に必ずモックを元の実装に戻す
   * グローバルな状態の変更を最小限に抑える

このアプローチにより、ソースコードとテストコードの連携を確保しながら、効率的なモックの実装変更が可能になります。