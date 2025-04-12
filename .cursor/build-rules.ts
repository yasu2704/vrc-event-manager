import {
	red,
	yellow,
	green,
	blue,
	cyan,
	dim,
} from "@std/fmt/colors";
import { dirname, join, resolve } from "@std/path";

// ファイルシステム操作のラッパー
export const fileSystem = {
	stat: Deno.stat,
	mkdir: Deno.mkdir, 
	readTextFile: Deno.readTextFile,
	writeTextFile: Deno.writeTextFile,
	readDir: Deno.readDir,
};

// ロガーのラッパー
export const logger = {
	log: console.log,
	warn: console.warn,
	error: console.error,
};

// --- Emojis ---
const EMOJI_START = '✨';
const EMOJI_DIR = '📁';
const EMOJI_ORDER = '📊';
const EMOJI_READ = '➡️';
const EMOJI_WRITE = '💾';
const EMOJI_WARN = '⚠️';
const EMOJI_ERROR = '❌';
const EMOJI_SUCCESS = '✅';

// --- 定数定義 ---

/** 現在のスクリプトファイルのディレクトリパス */
const __dirname: string = dirname(new URL(import.meta.url).pathname);
/** ルールファイルが格納されているディレクトリへの絶対パス */
const RULES_DIR_PATH: string = resolve(__dirname, './', 'rules');
/** 出力する .clinerules ファイルへの絶対パス */
const CLINE_RULES_OUTPUT_FILE_PATH: string = resolve(__dirname, '../', '.clinerules');
/** 出力する GitHub Copilot 指示ファイルへの絶対パス */
const COPILOT_OUTPUT_FILE_PATH: string = resolve(__dirname, '../', '.github/copilot-instructions.md');
/** 優先的に先頭に配置するファイル名 */
const BASE_RULE_FILENAME: string = 'base.mdc';
/** 読み込むファイルの拡張子 */
const RULE_FILE_EXTENSION: string = '.mdc';

// --- 型定義 ---

/** ファイル読み込みエラーを表すカスタムエラー */
class FileReadError extends Error {
	constructor(
		public filePath: string,
		public originalError: unknown,
	) {
		super(`ファイルの読み込みに失敗しました: ${filePath}`);
		this.name = 'FileReadError';
		// Denoではキャプチャスタックトレースが不要
	}
}

// --- 関数定義 ---

/**
 * 指定されたディレクトリパスが存在することを確認し、存在しない場合は作成します。
 * @param dirPath 確認または作成するディレクトリのパス。
 * @throws ディレクトリの作成に失敗した場合、またはパスがディレクトリでない場合。
 */
export const ensureDirectoryExists = async (dirPath: string): Promise<void> => {
	try {
		// ディレクトリの存在を確認 (存在しない場合は NotFound エラーが throw される)
		const stats = await fileSystem.stat(dirPath);

		// パスが存在するがディレクトリでない場合はエラーをスロー
		if (!stats.isDirectory) {
			const error: Error & { code?: string } = new Error(
				`パスが存在しますが、ディレクトリではありません: ${dirPath}`,
			);
			error.code = 'ENOTDIR';
			logger.error(
				red(
					`${EMOJI_ERROR} パスが存在しますが、ディレクトリではありません: ${dirPath}`,
				),
			);
			throw error;
		}

		// ディレクトリが既に存在する場合は、何もせずに正常終了

	} catch (error: unknown) {
		// stat で発生したエラーを処理
		if (error instanceof Deno.errors.NotFound) {
			// パスが存在しない場合のみディレクトリを作成
			try {
				await fileSystem.mkdir(dirPath, { recursive: true });
				logger.log(
					dim(`${EMOJI_DIR} ディレクトリを作成しました: ${dirPath}`),
				);
				// 作成成功、正常終了
				return;
			} catch (mkdirError) {
				// mkdir 自体のエラー（例: パーミッション不足）
				logger.error(
					red(
						`${EMOJI_ERROR} ディレクトリの作成に失敗しました ${dirPath}:`,
					),
					mkdirError,
				);
				throw mkdirError; // mkdir のエラーを再スロー
			}
		} else {
			// NotFound 以外のエラー（例: パーミッション不足など）
			logger.error(
				red(
					`${EMOJI_ERROR} ディレクトリ状態の確認中に予期せぬエラーが発生しました ${dirPath}:`,
				),
				error,
			);
			throw error; // 元のエラーを再スロー
		}
	}
};

/**
 * 指定されたディレクトリからルールファイル（.mdc）のリストを取得します。
 * @param dirPath ルールファイルが含まれるディレクトリのパス。
 * @returns ディレクトリ内の .mdc ファイル名の配列。
 * @throws ディレクトリの読み取りに失敗した場合。
 */
const getRuleFilenames = async (dirPath: string): Promise<string[]> => {
	try {
		const filenames: string[] = [];
		for await (const entry of fileSystem.readDir(dirPath)) {
			if (entry.name.endsWith(RULE_FILE_EXTENSION)) {
				filenames.push(entry.name);
			}
		}
		return filenames;
	} catch (error) {
		// ディレクトリが存在しない場合は空配列を返す (NotFound)
		if (error instanceof Deno.errors.NotFound) {
			logger.warn(
				yellow(
					`${EMOJI_WARN} 警告: ルールディレクトリが見つかりません: ${dirPath}`,
				),
			);
			return [];
		}
		logger.error(
			red(`${EMOJI_ERROR} ディレクトリの読み取り中にエラーが発生しました: ${dirPath}`),
			error,
		);
		// エラーメッセージはコンソールに出力済みなので、ここではシンプルなエラーをスロー
		throw new Error(`ディレクトリの読み取りに失敗しました: ${dirPath}`);
	}
};

/** 定義されたルールファイルの読み込み順序 */
const FILE_ORDER: ReadonlyArray<string> = [
	'base.mdc',
	'requirements-definition.mdc',
	'basic-design.mdc',
	'architecture.mdc',
	'implementation.mdc',
	'code-quality.mdc',
	'error-handling.mdc',
	'testing.mdc',
	'bun-test-mock.mdc',
	'git.mdc',
	'git-commit.mdc',
	'review.mdc',
	'package-json-template.mdc',
];

/**
 * ルールファイル名の配列を定義された順序リストに基づいてソートします。
 * 'base.mdc' が存在する場合は常に先頭になります。
 * 順序リストに含まれないファイルは、リストの末尾にアルファベット順で追加されます。
 * @param filenames ソートするファイル名の配列。
 * @returns ソートされたファイル名の配列。
 */
const sortFilenames = (filenames: string[]): string[] => {
	const fileSet = new Set(filenames);
	const sortedKnownFiles: string[] = [];
	const unknownFiles: string[] = [];

	// base.mdc が存在するか確認し、存在しない場合は警告
	if (!fileSet.has(BASE_RULE_FILENAME)) {
		logger.warn(
			yellow(
				`${EMOJI_WARN} 警告: ${BASE_RULE_FILENAME} がルールディレクトリに見つかりません。出力には含まれません。`,
			),
		);
	}

	// 定義された順序リストに基づいてファイルを配置
	for (const file of FILE_ORDER) {
		if (fileSet.has(file)) {
			sortedKnownFiles.push(file);
			fileSet.delete(file); // 処理済みとしてセットから削除
		}
	}

	// 順序リストに含まれなかった残りのファイルを収集
	for (const remainingFile of fileSet) {
		unknownFiles.push(remainingFile);
	}

	// 未知のファイルをアルファベット順にソート
	unknownFiles.sort((a, b) => a.localeCompare(b));

	if (unknownFiles.length > 0) {
		logger.warn(
			yellow(
				`${EMOJI_WARN} 警告: 以下のファイルが見つかりましたが、定義済みの FILE_ORDER に含まれていません。末尾にアルファベット順で追加されます:`,
			),
			unknownFiles.map((f) => dim(f)).join(', '), // 未知ファイルもDim表示
		);
	}

	// 既知のファイルリストと未知のファイルリストを結合して返す
	return [...sortedKnownFiles, ...unknownFiles];
};

/**
 * 指定されたファイルパスのリストから内容を読み込み、結合します。
 * @param dirPath ファイルが存在するディレクトリのパス。
 * @param sortedFilenames 読み込む順序でソートされたファイル名の配列。
 * @returns 結合されたファイル内容の文字列。
 * @throws FileReadError ファイルの読み込みに失敗した場合。
 */
const combineFileContents = async (
	dirPath: string,
	sortedFilenames: string[],
): Promise<string> => {
	let combinedContent = '';
	const errors: FileReadError[] = [];

	// logger.log(cyan('ファイルの読み込み:')); // 読み込み開始ヘッダーは不要かも
	for (const filename of sortedFilenames) {
		const filePath = join(dirPath, filename);
		// DIMカラーでインデントして読み込み中ファイルを表示
		logger.log(dim(`${EMOJI_READ}  読み込み中: ${filePath}`));
		try {
			const content = await fileSystem.readTextFile(filePath);
			// ファイルの開始を示す区切りコメントを追加
			combinedContent += `--- 開始: ${filename}\n`;
			// ファイル内容を追加
			combinedContent += `${content.trimEnd()}\n`;
			// ファイルの終了を示す区切りコメントを追加
			combinedContent += `--- 終了: ${filename}\n\n`;
		} catch (readError) {
			// エラーが発生しても処理を続け、後でまとめて報告する
			errors.push(new FileReadError(filePath, readError));
			// エラー発生ファイルも赤色で表示
			logger.error(
				red(`${EMOJI_ERROR} ファイルの読み込みエラー ${filePath}:`),
				readError,
			);
		}
	}

	// 読み込みエラーがあった場合は例外をスロー
	if (errors.length > 0) {
		const errorMessages = errors
			.map((e) => `  - ${e.filePath}: ${e.originalError}`)
			.join('\n');
		// エラーメッセージ全体を赤色に
		throw new Error(
			red(
				`ルールファイルの読み込み中にエラーが発生しました:\n${errorMessages}`,
			),
		);
	}

	// 末尾の余分な改行を削除し、最後に1つの改行を追加
	return `${combinedContent.trimEnd()}\n`;
};

/**
 * 指定されたパスに内容を書き込みます。
 * @param filePath 書き込むファイルのパス。
 * @param content 書き込む内容。
 * @throws ファイルの書き込みに失敗した場合。
 */
const writeCombinedFile = async (
	filePath: string,
	content: string,
): Promise<void> => {
	try {
		// DIMカラーでインデントして書き込み先を表示
		logger.log(dim(`${EMOJI_WRITE} 結合された内容を書き込み中: ${filePath}`));
		await fileSystem.writeTextFile(filePath, content);
	} catch (error) {
		logger.error(
			red(`${EMOJI_ERROR} ファイルへの書き込みエラー ${filePath}:`),
			error,
		);
		throw new Error(`ファイルへの書き込みに失敗しました: ${filePath}`);
	}
};

// --- メイン処理 ---

/**
 * ルールファイルを結合して .clinerules ファイルを生成するメイン関数。
 */
export const buildClineRules = async (): Promise<void> => {
	try {
		// BOLD + BLUE で開始メッセージ (出力ファイルパスも表示、改行追加)
		logger.log(
			blue(
				`${EMOJI_START} ルールファイルの結合と出力プロセスを開始します...\n    (出力先: ${CLINE_RULES_OUTPUT_FILE_PATH} および ${COPILOT_OUTPUT_FILE_PATH})`,
			),
		);
		// CYAN でパス情報 (複数行で両方の出力パスを表示)
		logger.log(
			cyan(`${EMOJI_DIR} ルールソースディレクトリ: ${RULES_DIR_PATH}`),
		);
		logger.log(
			cyan(`${EMOJI_DIR} 出力ファイルパス:\n  - ${CLINE_RULES_OUTPUT_FILE_PATH}\n  - ${COPILOT_OUTPUT_FILE_PATH}`),
		);

		const clineRulesDir = dirname(CLINE_RULES_OUTPUT_FILE_PATH);
		const copilotDir = dirname(COPILOT_OUTPUT_FILE_PATH);

		// 両方のディレクトリに対して ensureDirectoryExists を呼び出す
		try {
			await Promise.all([
				ensureDirectoryExists(clineRulesDir),
				ensureDirectoryExists(copilotDir),
			]);
		} catch (error) {
			// どちらかのディレクトリ作成に失敗した場合
			logger.error(
				red(
					`${EMOJI_ERROR} 出力先ディレクトリの準備中にエラーが発生しました:`,
				),
				error,
			);
			Deno.exit(1); // エラーで終了
		}
		
		const mdcFiles = await getRuleFilenames(RULES_DIR_PATH);

		if (mdcFiles.length === 0) {
			// 黄色で警告
			logger.warn(
				yellow(
					`${EMOJI_WARN} ${RULE_FILE_EXTENSION} ファイルが ${RULES_DIR_PATH} に見つかりません。空の ${CLINE_RULES_OUTPUT_FILE_PATH} を作成します。`,
				),
			);
			await writeCombinedFile(CLINE_RULES_OUTPUT_FILE_PATH, ''); // 空ファイルを作成
			logger.log(
				yellow(
					`${EMOJI_WARN} .clinerules ファイルの生成はスキップされました（ソースファイルがありません）。`,
				),
			);
			return;
		}

		const sortedFiles = sortFilenames(mdcFiles);
		// CYAN でファイル順序をリスト表示
		logger.log(cyan(`${EMOJI_ORDER} ファイル処理順序:`));
		logger.log(
			sortedFiles.map((f) => dim(`  - ${f}`)).join('\n'),
		);

		const combinedContent = await combineFileContents(
			RULES_DIR_PATH,
			sortedFiles,
		);

		await writeCombinedFile(CLINE_RULES_OUTPUT_FILE_PATH, combinedContent);
		// Copilot 指示ファイルにも同じ内容を書き込む
		await writeCombinedFile(COPILOT_OUTPUT_FILE_PATH, combinedContent);

		// BOLD + GREEN で成功メッセージ (両方のファイルパスを含めるように修正)
		logger.log(
			green(
				`${EMOJI_SUCCESS} ルールファイルが正常に結合され、以下のファイルに出力されました:\n  - ${CLINE_RULES_OUTPUT_FILE_PATH}\n  - ${COPILOT_OUTPUT_FILE_PATH}`,
			),
		);
	} catch (error) {
		// BOLD + RED でビルドエラー
		logger.error(
			red(`${EMOJI_ERROR} .clinerules ファイルのビルド中にエラーが発生しました:`),
			error instanceof Error ? error.message : error, // エラーオブジェクトの内容を表示
		);
		// Deno環境でエラー終了させる
		Deno.exit(1); // エラーコード 1 で終了
	}
};

// --- スクリプト実行 ---
// このファイルが直接実行された場合のみビルド処理を実行
if (import.meta.main) {
	await buildClineRules();
}
