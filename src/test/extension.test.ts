// Copyright (c) Microsoft Corporation.

import * as assert from 'assert';

// 可以匯入並使用 'vscode' module 的所有 API，
// 也可以匯入 extension 本身進行測試。
import * as vscode from 'vscode';
// import * as myExtension from '../../extension';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Sample test', () => {
		assert.strictEqual(-1, [1, 2, 3].indexOf(5));
		assert.strictEqual(-1, [1, 2, 3].indexOf(0));
	});
});
