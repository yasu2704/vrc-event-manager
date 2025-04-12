# フェーズ4: アサーションの書き換え

**目標:** `vitest` の `expect` を使用したアサーションを `deno/std/assert` の関数に書き換える。ソースコードとテストコードを同時に更新することで、アサーションがテスト対象のコードの実際の動作を正確に検証できるようにする。

## 同時移行のアプローチ

ソースコードの動作とテストアサーションの間に一貫性を確保するために、アサーションを更新する際にはソースコードの変更も考慮する必要があります。Denoのネイティブアサーションを使用することで、より信頼性の高いテストを実現できます。

## ソースファイル (`build-rules.ts`) の調整

アサーションに関連するソースコード部分を、より明示的な戻り値型やエラー処理を含むように調整します：

```typescript
// 変更前 - 異なる戻り値型を持つ可能性がある
async function loadRuleFiles() {
  // ...
  if (!stats.isDirectory()) {
    console.warn('指定されたパスはディレクトリではありません');
    return false;
  }
  // ...
  return ruleFiles;
}

// 変更後 - 明確な戻り値型と適切なエラー処理
async function loadRuleFiles(): Promise<string[] | null> {
  try {
    // ...
    if (!stats.isDirectory()) {
      logger.warn('指定されたパスはディレクトリではありません');
      return null;
    }
    // ...
    return ruleFiles;
  } catch (error) {
    logger.error(`ルールファイルの読み込み中にエラーが発生しました: ${error.message}`);
    return null;
  }
}
```

## テストファイル (`build-rules.test.ts`) のアサーション書き換え

### 1. 呼び出し回数の検証:
*   **変更前:**
    ```typescript
    expect(mockReaddir).toHaveBeenCalledTimes(1);
    expect(mockReaddir).toHaveBeenCalledWith(expectedDir);
    ```
*   **変更後:**
    ```typescript
    import { 
      assertSpyCalls, 
      assertSpyCallArgs 
    } from "@std/testing/mock"; // importMap を利用

    // fileSystem.readDir が1回呼ばれたことを検証
    assertSpyCalls(fileSystem.readDir, 1);
    
    // 特定の引数で呼ばれたことを検証
    assertSpyCallArgs(fileSystem.readDir, 0, [expectedDir]);
    ```

### 2. 呼び出し引数の検証:
*   **変更前:**
    ```typescript
    expect(mockWriteFile.mock.calls[1][0]).toBe(expectedOutputPath);
    expect(mockWriteFile.mock.calls[1][1]).toContain('module.exports = {');
    ```
*   **変更後:**
    ```typescript
    import { 
      assertSpyCall, 
      assertStringIncludes 
    } from "@std/testing/mock"; // importMap を利用
    import { assertStringIncludes } from "@std/assert"; // importMap を利用

    // 2回目の呼び出しの第1引数を検証
    assertSpyCall(mockWriteTextFile, 1, {
      args: [expectedOutputPath, Deno.FakeTime.any]
    });
    
    // 2回目の呼び出しの第2引数に特定の文字列が含まれることを検証
    const content = mockWriteTextFile.calls[1].args[1];
    assertStringIncludes(content, 'export default {');
    ```

### 3. 関数が呼ばれなかったことの検証:
*   **変更前:**
    ```typescript
    expect(mockError).not.toHaveBeenCalled();
    ```
*   **変更後:**
    ```typescript
    import { assertSpyCalls } from "@std/testing/mock"; // importMap を利用

    // mockError が呼ばれなかったことを検証
    assertSpyCalls(mockError, 0);
    ```

### 4. 値の比較:
*   **変更前:**
    ```typescript
    expect(result).toEqual(['rules1.mdc', 'rules2.mdc']);
    ```
*   **変更後:**
    ```typescript
    import { assertEquals } from "@std/assert"; // importMap を利用

    // 値の等価性を検証
    assertEquals(result, ['rules1.mdc', 'rules2.mdc']);
    ```

### 5. 部分文字列のマッチング:
*   **変更前:**
    ```typescript
    expect(message).toMatch(/エラー/);
    ```
*   **変更後:**
    ```typescript
    import { assertMatch } from "@std/assert"; // importMap を利用

    // 正規表現にマッチすることを検証
    assertMatch(message, /エラー/);
    ```

### 6. エラーがスローされることの検証:
*   **変更前:**
    ```typescript
    await expect(buildRules()).rejects.toThrow();
    ```
*   **変更後:**
    ```typescript
    import { assertRejects } from "@std/assert"; // importMap を利用

    // 関数がエラーをスローすることを検証
    await assertRejects(() => buildRules());
    
    // 特定のエラーメッセージを持つエラーがスローされることを検証
    await assertRejects(
      () => buildRules(),
      Error,
      "期待されるエラーメッセージ"
    );
    ```

## エラー処理とアサーションを連携させる例

ソースコードとテストコードを連携させた具体的な例：

```typescript
// ソースコード (build-rules.ts)
export async function validateRuleFile(filePath: string): Promise<boolean> {
  try {
    const content = await fileSystem.readTextFile(filePath);
    if (!content.includes('rule:')) {
      logger.error(`無効なルールファイル形式: ${filePath}`);
      return false;
    }
    return true;
  } catch (error) {
    logger.error(`ルールファイルの検証中にエラーが発生しました: ${error.message}`);
    throw new Error(`ルールファイルを読み込めません: ${filePath}`);
  }
}

// テストコード (build-rules.test.ts)
Deno.test("validateRuleFile", async (t) => {
  await t.step("有効なルールファイル", async () => {
    try {
      // モックを設定
      fileSystem.readTextFile = spy(() => Promise.resolve("rule: test"));
      logger.error = spy(() => {});
      
      // テスト実行
      const result = await validateRuleFile("valid.mdc");
      
      // アサーション
      assertEquals(result, true);
      assertSpyCalls(logger.error, 0);
    } finally {
      // モックをリセット
      fileSystem.readTextFile = originalReadTextFile;
      logger.error = originalError;
    }
  });
  
  await t.step("無効なルールファイル", async () => {
    try {
      // モックを設定
      fileSystem.readTextFile = spy(() => Promise.resolve("invalid content"));
      logger.error = spy(() => {});
      
      // テスト実行
      const result = await validateRuleFile("invalid.mdc");
      
      // アサーション
      assertEquals(result, false);
      assertSpyCalls(logger.error, 1);
      assertSpyCallArgs(logger.error, 0, ["無効なルールファイル形式: invalid.mdc"]);
    } finally {
      // モックをリセット
      fileSystem.readTextFile = originalReadTextFile;
      logger.error = originalError;
    }
  });
  
  await t.step("ファイル読み込みエラー", async () => {
    try {
      // モックを設定
      fileSystem.readTextFile = spy(() => Promise.reject(new Error("読み込みエラー")));
      logger.error = spy(() => {});
      
      // テスト実行とアサーション
      await assertRejects(
        () => validateRuleFile("error.mdc"),
        Error,
        "ルールファイルを読み込めません: error.mdc"
      );
      assertSpyCalls(logger.error, 1);
    } finally {
      // モックをリセット
      fileSystem.readTextFile = originalReadTextFile;
      logger.error = originalError;
    }
  });
});
```

## 移行の主なポイント

1. **型安全性の向上**
   * Denoの型システムを活用して、より明確な関数シグネチャを定義
   * テストアサーションもより型安全な方法で実装

2. **明示的なエラー処理**
   * ソースコードでは明確なエラー処理パターンを使用
   * テストではそれに対応する適切なアサーションを実装

3. **アサーションの細分化**
   * Vitestの柔軟なアサーションをDenoの特化したアサーション関数に置き換え
   * 各アサーションの意図をより明確に表現

4. **ソースコードとテストの協調**
   * ソースコードの設計をテスト容易性を考慮して調整
   * テストコードはソースコードの実際の動作を正確に検証

この移行アプローチにより、ソースコードとテストコードの間の整合性が高まり、テストの信頼性が向上します。また、Denoの型システムと標準ライブラリを活用することで、より堅牢なコードとテストを実現できます。