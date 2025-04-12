import { assertEquals, assertStringIncludes } from "@std/assert";
import { assertSpyCalls, spy } from "@std/testing/mock";
import { resolve } from "@std/path";

// import the function being tested
import { buildClineRules, fileSystem, logger } from "./build-rules.ts";

const EMOJI_START = '✨';
const EMOJI_DIR = '📁';
const EMOJI_SUCCESS = '✅';

/**
 * `buildClineRules` 関数のテストスイート。
 */
Deno.test("buildClineRules", async (t) => {
	const MOCK_RULES_DIR = resolve(Deno.cwd(), '.cursor/rules');
	const MOCK_CLINE_OUTPUT = resolve(Deno.cwd(), '.clinerules');
	const MOCK_COPILOT_OUTPUT = resolve(
		Deno.cwd(),
		'.github/copilot-instructions.md',
	);

	/**
	 * ルールファイルが存在する場合に、`.clinerules` と `copilot-instructions.md` の両方のファイルが
	 * 正しく生成されることをテストします。
	 */
	await t.step("ルールファイルが存在する場合、.clinerules と copilot-instructions.md を生成する", async () => {
		// オリジナル関数を保存
		const originalStat = fileSystem.stat;
		const originalMkdir = fileSystem.mkdir;
		const originalReadDir = fileSystem.readDir;
		const originalReadTextFile = fileSystem.readTextFile;
		const originalWriteTextFile = fileSystem.writeTextFile;
		const originalConsoleLog = logger.log;
		const originalConsoleWarn = logger.warn;
		const originalConsoleError = logger.error;

		try {
			// モックの作成
			const mockStat = spy(() => Promise.resolve({
				isDirectory: true,
				isFile: false,
				isSymlink: false,
				size: 0,
				mtime: null,
				atime: null,
				birthtime: null,
				dev: 0,
				ino: 0,
				mode: 0,
				nlink: 0,
				uid: 0,
				gid: 0,
				rdev: 0,
				blksize: 0,
				blocks: 0
			} as Deno.FileInfo));
			
			const mockMkdir = spy(() => Promise.resolve());
			
			// 読み込みファイル名の設定
			const mockFilenames = ['base.mdc', 'another.mdc'];
			
			// ReadDirのモック
			const mockReadDir = spy(async function* () {
				for (const filename of mockFilenames) {
					yield {
						name: filename,
						isFile: () => true,
						isDirectory: () => false,
						isSymlink: () => false
					};
				}
			});
			
			// ReadTextFileのモック
			const mockReadTextFile = spy((path: string): Promise<string> => {
				if (path === resolve(MOCK_RULES_DIR, 'base.mdc')) return Promise.resolve('base content');
				if (path === resolve(MOCK_RULES_DIR, 'another.mdc')) return Promise.resolve('another content');
				return Promise.reject(new Error(`Unexpected readFile call: ${path}`));
			});
			
			// WriteTextFileのモック
			const mockWriteTextFile = spy(() => Promise.resolve());
			
			// Consoleのモック
			const mockConsoleLog = spy();
			const mockConsoleWarn = spy();
			const mockConsoleError = spy();
			
			// グローバルオブジェクトの置き換え
			fileSystem.stat = mockStat as unknown as typeof fileSystem.stat;
			fileSystem.mkdir = mockMkdir as unknown as typeof fileSystem.mkdir;
			fileSystem.readDir = mockReadDir as unknown as typeof fileSystem.readDir;
			fileSystem.readTextFile = mockReadTextFile as unknown as typeof fileSystem.readTextFile;
			fileSystem.writeTextFile = mockWriteTextFile as unknown as typeof fileSystem.writeTextFile;
			logger.log = mockConsoleLog;
			logger.warn = mockConsoleWarn;
			logger.error = mockConsoleError;

			const mockCombinedContent = `--- 開始: base.mdc
base content
--- 終了: base.mdc

--- 開始: another.mdc
another content
--- 終了: another.mdc
`;

			await buildClineRules();

			// 呼び出し回数のアサーション
			assertSpyCalls(mockStat, 2);
			assertSpyCalls(mockMkdir, 0); // not called
			assertSpyCalls(mockReadTextFile, 2);
			assertSpyCalls(mockWriteTextFile, 2);
			
			// コンソール出力のアサーション
			// 少なくとも1回は呼ばれているか確認
			assertEquals(mockConsoleLog.calls.length > 0, true);
			
			// 出力メッセージの検証
			let startLogFound = false;
			let outputPathLogFound = false;
			let successLogFound = false;
			
			// すべてのコンソール出力をチェック
			for (const call of mockConsoleLog.calls) {
				// call.argsが配列であることを確認し、空の場合はスキップ
				const args = call.args as unknown[];
				if (!args || args.length === 0) continue;
				
				const messageArg = args[0];
				if (messageArg === undefined) continue;
				
				const message = String(messageArg);
				
				if (message.includes(EMOJI_START)) {
					assertStringIncludes(message, "ルールファイルの結合と出力プロセスを開始します");
					startLogFound = true;
				}
				
				if (message.includes(EMOJI_DIR) && message.includes("出力ファイルパス")) {
					assertStringIncludes(message, MOCK_CLINE_OUTPUT);
					assertStringIncludes(message, MOCK_COPILOT_OUTPUT);
					outputPathLogFound = true;
				}
				
				if (message.includes(EMOJI_SUCCESS)) {
					assertStringIncludes(message, "ルールファイルが正常に結合され");
					assertStringIncludes(message, MOCK_CLINE_OUTPUT);
					assertStringIncludes(message, MOCK_COPILOT_OUTPUT);
					successLogFound = true;
				}
			}
			
			// メッセージ出力のアサーション
			assertEquals(startLogFound, true, "開始メッセージが出力されていません");
			assertEquals(outputPathLogFound, true, "出力パスメッセージが出力されていません");
			assertEquals(successLogFound, true, "成功メッセージが出力されていません");
			
			// ReadTextFileの引数検証
			let baseFileRead = false;
			let anotherFileRead = false;
			
			for (const call of mockReadTextFile.calls) {
				// call.argsが配列であることを確認し、空の場合はスキップ
				const args = call.args as unknown[];
				if (!args || args.length === 0) continue;
				
				const pathArg = args[0];
				if (pathArg === undefined) continue;
				
				const path = String(pathArg);
				
				if (path.includes('base.mdc')) {
					baseFileRead = true;
				}
				if (path.includes('another.mdc')) {
					anotherFileRead = true;
				}
			}
			
			assertEquals(baseFileRead, true, "base.mdcが読み込まれていません");
			assertEquals(anotherFileRead, true, "another.mdcが読み込まれていません");
			
			// WriteTextFileの引数検証
			let clineruleFileWritten = false;
			let copilotFileWritten = false;
			
			for (const call of mockWriteTextFile.calls) {
				// call.argsが配列であることを確認し、引数が2つ未満の場合はスキップ
				const args = call.args as unknown[];
				if (!args || args.length < 2) continue;
				
				const pathArg = args[0];
				const contentArg = args[1];
				
				// undefined チェックを追加
				if (pathArg === undefined || contentArg === undefined) continue;
				
				if (pathArg === MOCK_CLINE_OUTPUT) {
					assertEquals(contentArg, mockCombinedContent, ".clinerules ファイルの内容が正しくありません");
					clineruleFileWritten = true;
				}
				
				if (pathArg === MOCK_COPILOT_OUTPUT) {
					assertEquals(contentArg, mockCombinedContent, "copilot-instructions.md ファイルの内容が正しくありません");
					copilotFileWritten = true;
				}
			}
			
			assertEquals(clineruleFileWritten, true, ".clinerules ファイルが書き込まれていません");
			assertEquals(copilotFileWritten, true, "copilot-instructions.md ファイルが書き込まれていません");
			
		} finally {
			// 元の関数に戻す
			fileSystem.stat = originalStat;
			fileSystem.mkdir = originalMkdir;
			fileSystem.readDir = originalReadDir;
			fileSystem.readTextFile = originalReadTextFile;
			fileSystem.writeTextFile = originalWriteTextFile;
			logger.log = originalConsoleLog;
			logger.warn = originalConsoleWarn;
			logger.error = originalConsoleError;
		}
	});
}); 