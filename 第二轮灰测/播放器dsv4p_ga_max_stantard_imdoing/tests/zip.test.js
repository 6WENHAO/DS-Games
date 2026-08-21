'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const zip = require('../src/core/zip.js');

describe('crc32', () => {
  test('已知校验向量', () => {
    assert.equal(zip.crc32(Buffer.from('')), 0);
    assert.equal(zip.crc32(Buffer.from('hello')), 0x3610a686);
    assert.equal(zip.crc32(Buffer.from('123456789')), 0xcbf43926);
  });
});

describe('ZipWriter', () => {
  async function buildBytes() {
    const z = new zip.ZipWriter();
    z.add('hello.txt', Buffer.from('hello world'));
    z.add('中文名.txt', Buffer.from('你好，世界'));
    z.add('empty.bin', new Uint8Array(0));
    const blob = z.blob();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    return { z, bytes };
  }

  function countSignature(bytes, sig) {
    let n = 0;
    for (let i = 0; i + 4 <= bytes.length; i++) {
      if (bytes[i] === sig[0] && bytes[i + 1] === sig[1] && bytes[i + 2] === sig[2] && bytes[i + 3] === sig[3]) n++;
    }
    return n;
  }

  test('签名与结构', async () => {
    const { z, bytes } = await buildBytes();

    // 起始 PK\x03\x04
    assert.equal(bytes[0], 0x50);
    assert.equal(bytes[1], 0x4b);
    assert.equal(bytes[2], 0x03);
    assert.equal(bytes[3], 0x04);

    // 中央目录签名 PK\x01\x02 恰好 3 次
    assert.equal(countSignature(bytes, [0x50, 0x4b, 0x01, 0x02]), 3);

    // 文件以 EOCD 记录收尾：签名 PK\x05\x06 位于末尾 22 字节的起始处
    const eocd = bytes.subarray(bytes.length - 22);
    assert.equal(eocd[0], 0x50);
    assert.equal(eocd[1], 0x4b);
    assert.equal(eocd[2], 0x05);
    assert.equal(eocd[3], 0x06);
    // 注释长度字段（EOCD 最后 2 字节）为 0，确认其后无任何内容
    assert.equal(eocd[20] | (eocd[21] << 8), 0);

    // EOCD 两个条目计数字段均为 3（本盘条目数 + 总条目数）
    assert.equal(eocd[8] | (eocd[9] << 8), 3);
    assert.equal(eocd[10] | (eocd[11] << 8), 3);

    // count()/bytes() 一致性
    const cdSize = eocd[12] | (eocd[13] << 8) | (eocd[14] << 16) | (eocd[15] << 24);
    const cdOffset = eocd[16] | (eocd[17] << 8) | (eocd[18] << 16) | (eocd[19] << 24);
    assert.equal(z.count(), 3);
    assert.equal(z.bytes(), cdOffset);
    assert.equal(bytes.length, cdOffset + cdSize + 22);
  });
});

describe('zip 端到端校验 (python3 zipfile)', () => {
  test('内容与 python zipfile 逐字节一致', async (t) => {
    let hasPython = true;
    try {
      execFileSync('python3', ['--version'], { stdio: 'ignore' });
    } catch {
      hasPython = false;
    }
    if (!hasPython) {
      t.skip('python3 不可用');
      return;
    }

    const contents = [
      ['hello.txt', Buffer.from('hello world')],
      ['中文名.txt', Buffer.from('你好，世界')],
      ['empty.bin', Buffer.alloc(0)]
    ];

    const z = new zip.ZipWriter();
    for (const [name, data] of contents) z.add(name, data);
    const bytes = new Uint8Array(await z.blob().arrayBuffer());

    const tmp = path.join(os.tmpdir(), `dsv4p-test-${process.pid}-${Date.now()}.zip`);
    fs.writeFileSync(tmp, bytes);
    try {
      const spec = contents.map(([name, data]) => ({ name, b64: data.toString('base64') }));
      const py = [
        'import sys, zipfile, base64, json',
        'path = sys.argv[1]',
        'spec = json.loads(sys.argv[2])',
        'zf = zipfile.ZipFile(path)',
        'assert zf.testzip() is None, "testzip failed"',
        'names = zf.namelist()',
        'assert names == [e["name"] for e in spec], ("names", names)',
        'for e in spec:',
        '    data = zf.read(e["name"])',
        '    assert base64.b64encode(data).decode() == e["b64"], ("content", e["name"])',
        'print("OK")'
      ].join('\n');
      const out = execFileSync('python3', ['-c', py, tmp, JSON.stringify(spec)], { encoding: 'utf8' });
      assert.equal(out.trim(), 'OK');
    } finally {
      fs.unlinkSync(tmp);
    }
  });
});
