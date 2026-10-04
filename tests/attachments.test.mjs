// 附件字段规范化:超限/非法数据在 normalizeItem 被静默丢弃,编辑器与导入共用这条路径。
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeItem, FILE_MAX, VAULT_FILES_MAX, FILE_COUNT_MAX } from '../src/lib/model.js';

const b64 = (bytes) => Buffer.alloc(bytes, 7).toString('base64');

test('合法附件保留,size 以实际内容为准', () => {
  const item = normalizeItem({ type: 'note', title: 'x', files: [{ id: 'a', name: 'k.txt', size: 999, type: 'text/plain', data: b64(1000) }] });
  assert.equal(item.files.length, 1);
  assert.equal(item.files[0].size, 1000); // 以 base64 解码后的真实大小为准,而非声明值
  assert.equal(item.files[0].name, 'k.txt');
});

test('超限/非法附件被丢弃', () => {
  const item = normalizeItem({
    type: 'note',
    files: [
      { id: 'big', name: 'big.bin', size: 10, data: b64(FILE_MAX + 1) }, // 超过单文件上限
      { id: 'bad', name: 'bad.bin', data: 'not base64!!' }, // 非法 base64
      { id: 'empty', name: 'empty.bin', data: '' }, // 空文件
      { name: 'no-id.bin', data: b64(10) }, // 缺 id → 自动补
    ],
  });
  assert.equal(item.files.length, 1);
  assert.equal(item.files[0].name, 'no-id.bin');
  assert.ok(item.files[0].id);
});

test('数量上限:超过部分丢弃,重复 id 去重', () => {
  const files = Array.from({ length: FILE_COUNT_MAX + 5 }, (_, i) => ({ id: `f${i}`, name: `${i}.bin`, data: b64(10) }));
  files.push({ id: 'f0', name: 'dup.bin', data: b64(10) });
  const item = normalizeItem({ type: 'note', files });
  assert.equal(item.files.length, FILE_COUNT_MAX);
  assert.equal(new Set(item.files.map((f) => f.id)).size, FILE_COUNT_MAX);
});

test('非数组/缺字段兜底', () => {
  assert.deepEqual(normalizeItem({ type: 'note' }).files, []);
  assert.deepEqual(normalizeItem({ type: 'note', files: 'junk' }).files, []);
  assert.deepEqual(new Set([VAULT_FILES_MAX]).size, 1); // 常量可导出(UI 提示用)
});
