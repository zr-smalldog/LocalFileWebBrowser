// LocalFileWebBrowser - API 测试
// 用法: node test-api.mjs

const BASE = 'http://127.0.0.1:3210';

async function test(name, fn) {
  try {
    await fn();
    console.log(`✅ ${name}`);
  } catch (e) {
    console.log(`❌ ${name}: ${e.message}`);
  }
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

(async () => {
  console.log('=== LocalFileWebBrowser API Tests ===\n');

  // 1. 首页可访问
  await test('首页可访问', async () => {
    const res = await fetch(BASE);
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });

  // 2. 文件列表
  await test('文件列表 API', async () => {
    const data = await fetchJson(`${BASE}/api/list?path=`);
    if (!data.entries) throw new Error('No entries');
  });

  // 3. 文件元信息
  await test('文件元信息 API', async () => {
    const data = await fetchJson(`${BASE}/api/meta?path=LocalFileWebBrowser/README.md`);
    if (!data.mime || !data.previewMode) throw new Error('Meta incomplete');
  });

  // 4. 文本预览
  await test('文本预览 (README.md)', async () => {
    const data = await fetchJson(`${BASE}/api/preview?path=LocalFileWebBrowser/README.md`);
    if (!data.html) throw new Error('No html');
  });

  // 5. PDF 预览
  await test('PDF 预览 (test-preview.pdf)', async () => {
    const data = await fetchJson(`${BASE}/api/preview?path=test-preview.pdf`);
    if (data.kind !== 'pdf') throw new Error(`Kind: ${data.kind}`);
  });

  // 5. PDF 原始文件
  await test('PDF 原始文件可访问', async () => {
    const res = await fetch(`${BASE}/api/raw?path=test-preview.pdf`);
    if (res.headers.get('content-type') !== 'application/pdf') {
      throw new Error(`Content-Type: ${res.headers.get('content-type')}`);
    }
  });

  // 6. 图片预览
  await test('图片预览 API', async () => {
    // 找一个图片文件
    const list = await fetchJson(`${BASE}/api/list?path=`);
    const img = list.entries.find(e => e.name.match(/\.(png|jpg|jpeg|gif|webp)$/i));
    if (img) {
      const data = await fetchJson(`${BASE}/api/preview?path=${encodeURIComponent(img.path)}`);
      if (data.kind !== 'image') throw new Error(`Kind: ${data.kind}`);
    } else {
      console.log('  (跳过: 无图片文件)');
    }
  });

  // 7. 搜索功能
  await test('文件搜索 API', async () => {
    const data = await fetchJson(`${BASE}/api/search-files?path=&q=*pdf*&recursive=1`);
    if (typeof data.total !== 'number') throw new Error('No total');
  });

  // 8. 路径安全
  await test('路径安全: 禁止跳出根目录', async () => {
    const res = await fetch(`${BASE}/api/preview?path=../package.json`);
    if (res.status !== 400) throw new Error(`Should be 400, got ${res.status}`);
  });

  console.log('\n=== 测试完成 ===');
})();
