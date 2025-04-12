# マスタープラン: `build-rules.test.ts` の `deno test` 移行 (改訂版)

**目標:** `.cursor/build-rules.test.ts` および `.cursor/build-rules.ts` を `vitest` 依存から脱却させ、Deno の標準テストランナー `deno test` で実行できるようにする。

**移行アプローチの変更:**

従来の計画ではテストファイルのみを先行して移行する予定でしたが、pnpmワークスペース環境における一貫性とテストの有効性を確保するため、`build-rules.ts`と`build-rules.test.ts`を同時に移行する方針に変更します。これにより以下の利点が得られます：

- ソースコードとテストコードの互換性が確保される
- モックの複雑さが軽減される
- 移行成功の検証が容易になる
- デバッグおよび修正作業が効率化される

**移行ステップ:**

1.  **テストフレームワーク API の置換:** ([詳細](./phase1-api-replacement/master.md))
    *   `describe`, `test` を `Deno.test` に置き換えます。
    *   `expect` アサーションを Deno 標準ライブラリの `assert` モジュール (`https://deno.land/std/assert/mod.ts`) の関数に置き換えます。
    *   `beforeEach`, `afterEach` のロジックを `Deno.test` の `beforeEach`/`afterEach` オプションや `try...finally`/`using` で管理し、モックのリセットは `stub.restore()` で行います。

2.  **モジュールのインポートと型の調整 (ソースコードとテストコード):** ([詳細](./phase2-imports-types/master.md))
    *   **ソースファイル (`build-rules.ts`) の変更:**
        *   `node:fs/promises`, `node:path`, `node:url` モジュールを Deno の API に変更します。
        *   Node.js 固有の処理をDeno互換に書き換えます。
        *   `chalk` モジュールを Deno 標準ライブラリの `fmt/colors.ts` に変更します。
    *   **テストファイル (`build-rules.test.ts`) の変更:**
        *   テストが移行後のソースコードを正しく呼び出せるよう調整します。
        *   モックの実装を Deno の仕様に合わせて更新します。

3.  **モックの実装変更:** ([詳細](./phase3-mocking/master.md))
    *   `vi.mock`, `vi.mocked`, `vi.spyOn` を Deno 標準ライブラリの `testing/mock` (`https://deno.land/std/testing/mock.ts`) の `spy` 関数を使用して書き換えます。
    *   `Deno` のファイルシステムメソッドや `console` のメソッドを適切にモック化します。
    *   `this` コンテキストの問題に対処するため、関数呼び出しには `call()` または `apply()` メソッドを使用します。

4.  **アサーションの書き換え:** ([詳細](./phase4-assertions/master.md))
    *   `vitest` のアサーション (`toHaveBeenCalledTimes`, `toHaveBeenCalledWith`, `toEqual`, `stringContaining` など) を `deno/std/assert` の関数 (`assertSpyCalls`, `assertSpyCallArg`, `assertEquals`, `assertMatch` など) に置き換えます。

5.  **テスト実行コマンドの準備:** ([詳細](./phase5-execution/master.md))
    *   テスト実行には、プロジェクトルートで以下のコマンドを使用します:
        ```bash
        deno test -A .cursor/build-rules.test.ts
        ```
        (`-A` フラグはすべてのパーミッションを許可します。)
    *   CI/CD パイプラインの設定を更新して、新しいテスト実行コマンドを使用するようにします。

**成果物:**

*   `vitest` に依存せず、指定された `deno test` コマンドで実行可能な `.cursor/build-rules.ts` と `.cursor/build-rules.test.ts` ファイル。
*   pnpmワークスペース内でスムーズに機能するDenoベースのビルドスクリプトシステム。

## 段階的マイグレーション
1. ソースコードとテストコードを同時に移行
2. インポートを最初に移行し、次に実装を移行
3. 型エラーが残っても実行可能であれば一旦許容し、後で修正

## 互換性維持のポイント
- グローバルオブジェクトの互換性を確保（Deno/Node.jsの違い）
- ファイルシステムAPIの置き換え（fs/promises -> Deno API）
- パス操作の互換性（node:path -> Deno標準ライブラリ）

## マイグレーション優先順位
1. 実行時の互換性確保（動くことを最優先）
2. テストの検証内容を維持（同じ検証が行われること）
3. 型の整合性確保（型エラーの解消）

## テスト中の問題に対処するパターン
- `--no-check`フラグで型チェックをスキップする緊急対応
- `as unknown as Type`で型互換性の問題を一時的に回避
- 実際の関数呼び出しでエラーが出る場合は`try-catch`で囲む
