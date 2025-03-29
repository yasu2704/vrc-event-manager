import chalk from 'chalk';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// --- Emojis ---
const EMOJI_START = '✨';
const EMOJI_DIR = '📁';
const EMOJI_FILE = '📄';
const EMOJI_ORDER = '📊';
const EMOJI_READ = '➡️';
const EMOJI_WRITE = '💾';
const EMOJI_WARN = '⚠️';
const EMOJI_ERROR = '❌';
const EMOJI_SUCCESS = '✅';

// --- 定数定義 ---

/** 現在のスクリプトファイルのディレクトリパス */
const __dirname: string = dirname(fileURLToPath(import.meta.url));
/** ルールファイルが格納されているディレクトリへの絶対パス */
const RULES_DIR_PATH: string = resolve(__dirname, 'rules');
/** 出力する .clinerules ファイルへの絶対パス */
const OUTPUT_FILE_PATH: string = resolve(__dirname, '../.clinerules');
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
		super(`Failed to read file: ${filePath}`);
		this.name = 'FileReadError';
		// Maintains proper stack trace in V8 environments (like Node.js and Bun)
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, FileReadError);
		}
	}
}

// --- 関数定義 ---

/**
 * 指定されたディレクトリからルールファイル（.mdc）のリストを取得します。
 * @param dirPath ルールファイルが含まれるディレクトリのパス。
 * @returns ディレクトリ内の .mdc ファイル名の配列。
 * @throws ディレクトリの読み取りに失敗した場合。
 */
const getRuleFilenames = async (dirPath: string): Promise<string[]> => {
	try {
		const allEntries = await readdir(dirPath);
		return allEntries.filter((entry) => entry.endsWith(RULE_FILE_EXTENSION));
	} catch (error) {
		// ディレクトリが存在しない場合は空配列を返す (ENOENT)
		if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
			console.warn(
				chalk.yellow(
					`${EMOJI_WARN} Warning: Rule directory not found: ${dirPath}`,
				),
			);
			return [];
		}
		console.error(
			chalk.red(`${EMOJI_ERROR} Error reading directory: ${dirPath}`),
			error,
		);
		// エラーメッセージはコンソールに出力済みなので、ここではシンプルなエラーをスロー
		throw new Error(`Failed to read directory: ${dirPath}`);
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
		console.warn(
			chalk.yellow(
				`${EMOJI_WARN} Warning: ${BASE_RULE_FILENAME} not found in the rule directory. It will not be included in the output.`,
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
		console.warn(
			chalk.yellow(
				`${EMOJI_WARN} Warning: The following files were found but are not included in the predefined FILE_ORDER. They will be appended alphabetically at the end:`,
			),
			unknownFiles.map((f) => chalk.dim(f)).join(', '), // 未知ファイルもDim表示
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

	// console.log(chalk.cyan('Reading files:')); // 読み込み開始ヘッダーは不要かも
	for (const filename of sortedFilenames) {
		const filePath = join(dirPath, filename);
		// DIMカラーでインデントして読み込み中ファイルを表示
		console.log(chalk.dim(`${EMOJI_READ}  Reading: ${filePath}`));
		try {
			const content = await readFile(filePath, 'utf-8');
			// ファイルの開始を示す区切りコメントを追加
			combinedContent += `--- START: ${filename}\n`;
			// ファイル内容を追加
			combinedContent += `${content.trimEnd()}\n`;
			// ファイルの終了を示す区切りコメントを追加
			combinedContent += `--- END: ${filename}\n\n`;
		} catch (readError) {
			// エラーが発生しても処理を続け、後でまとめて報告する
			errors.push(new FileReadError(filePath, readError));
			// エラー発生ファイルも赤色で表示
			console.error(
				chalk.red(`${EMOJI_ERROR} Error reading file ${filePath}:`),
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
			chalk.red(
				`Encountered errors while reading rule files:\n${errorMessages}`,
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
		console.log(chalk.dim(`${EMOJI_WRITE} Writing combined content to: ${filePath}`));
		await writeFile(filePath, content, 'utf-8');
	} catch (error) {
		console.error(
			chalk.red(`${EMOJI_ERROR} Error writing file ${filePath}:`),
			error,
		);
		throw new Error(`Failed to write file: ${filePath}`);
	}
};

// --- メイン処理 ---

/**
 * ルールファイルを結合して .clinerules ファイルを生成するメイン関数。
 */
const buildClineRules = async (): Promise<void> => {
	try {
		// BOLD + BLUE で開始メッセージ
		console.log(
			chalk.blue.bold(
				`${EMOJI_START} Starting build process for .clinerules...`,
			),
		);
		// CYAN でパス情報
		console.log(
			chalk.cyan(`${EMOJI_DIR} Rule source directory: ${RULES_DIR_PATH}`),
		);
		console.log(
			chalk.cyan(`${EMOJI_DIR} Output file path: ${OUTPUT_FILE_PATH}`),
		);

		const mdcFiles = await getRuleFilenames(RULES_DIR_PATH);

		if (mdcFiles.length === 0) {
			// 黄色で警告
			console.warn(
				chalk.yellow(
					`${EMOJI_WARN} No ${RULE_FILE_EXTENSION} files found in ${RULES_DIR_PATH}. Creating an empty ${OUTPUT_FILE_PATH}.`,
				),
			);
			await writeCombinedFile(OUTPUT_FILE_PATH, ''); // 空ファイルを作成
			console.log(
				chalk.yellow(
					`${EMOJI_WARN} .clinerules file generation skipped (no source files).`,
				),
			);
			return;
		}

		const sortedFiles = sortFilenames(mdcFiles);
		// CYAN でファイル順序をリスト表示
		console.log(chalk.cyan(`${EMOJI_ORDER} File processing order:`));
		console.log(
			sortedFiles.map((f) => chalk.dim(`  - ${f}`)).join('\n'),
		);

		const combinedContent = await combineFileContents(
			RULES_DIR_PATH,
			sortedFiles,
		);

		await writeCombinedFile(OUTPUT_FILE_PATH, combinedContent);

		// BOLD + GREEN で成功メッセージ
		console.log(
			chalk.green.bold(
				`${EMOJI_SUCCESS} .clinerules file generated successfully.`,
			),
		);
	} catch (error) {
		// BOLD + RED でビルドエラー
		console.error(
			chalk.red.bold(`${EMOJI_ERROR} Error building .clinerules file:`),
			error instanceof Error ? error.message : error, // エラーオブジェクトの内容を表示
		);
		// Bun/Node.js 環境でエラー終了させる
		process.exit(1); // エラーコード 1 で終了
	}
};

// --- スクリプト実行 ---
await buildClineRules();
