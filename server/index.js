import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import mime from 'mime-types';
import mammoth from 'mammoth';
import XLSX from 'xlsx';
import JSZip from 'jszip';
import hljs from 'highlight.js';

const app = express();
const PORT = Number(process.env.PORT || 3210);
const ROOT_DIR = '/home/openclaw/.openclaw/workspace';
const PUBLIC_DIR = path.resolve('public');
const TEXT_LIMIT = 1024 * 512;
const TABLE_ROW_LIMIT = 80;
const TABLE_COL_LIMIT = 20;
const SLIDE_LIMIT = 30;
const SEARCH_RESULT_LIMIT = 500;

function safeResolve(rel = '') {
  const clean = rel.replace(/^\/+/, '');
  const target = path.resolve(ROOT_DIR, clean);
  if (!target.startsWith(ROOT_DIR)) {
    const err = new Error('Path escapes root');
    err.status = 400;
    throw err;
  }
  return target;
}

function escapeHtml(str = '') { return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function unescapeXml(str = '') { return str.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'"); }
function globToRegex(pattern = '', { caseSensitive = false, whole = false } = {}) {
  const escaped = pattern
    .replace(/[|\\{}()[\]^$+./]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  const source = whole ? `^${escaped}$` : escaped;
  return new RegExp(source, caseSensitive ? '' : 'i');
}
async function walkFiles(rel = '', recursive = true, bucket = []) {
  const abs = safeResolve(rel);
  const dirents = await fs.readdir(abs, { withFileTypes: true });
  for (const d of dirents) {
    const childRel = path.posix.join(rel, d.name);
    const full = path.join(abs, d.name);
    if (d.isDirectory()) {
      if (recursive) await walkFiles(childRel, recursive, bucket);
    } else if (d.isFile()) {
      const st = await fs.stat(full);
      bucket.push({ name: d.name, path: childRel, dir: path.posix.dirname(childRel) === '.' ? '/' : path.posix.dirname(childRel), size: st.size, mtime: st.mtime });
      if (bucket.length >= SEARCH_RESULT_LIMIT) break;
    }
  }
  return bucket;
}
function getPreviewMode(ext = '') {
  if (['png','jpg','jpeg','gif','webp','bmp','svg'].includes(ext)) return '图片直出预览';
  if (ext === 'pdf') return 'PDF 内嵌预览';
  if (['md', 'markdown'].includes(ext)) return 'Markdown 渲染';
  if (['py','js','mjs','cjs','sh','bash','ts','tsx','jsx','json','yml','yaml','html','css','xml'].includes(ext)) return '代码高亮预览';
  if (['txt','log'].includes(ext)) return '纯文本预览';
  if (ext === 'docx') return 'DOCX HTML 预览';
  if (ext === 'xls' || ext === 'xlsx') return '表格轻量预览';
  if (ext === 'pptx') return 'PPTX 文本提取预览';
  return '原文件下载';
}
async function getFileMeta(rel = '') {
  const abs = safeResolve(rel);
  const st = await fs.stat(abs);
  const isFile = st.isFile();
  const ext = isFile ? path.extname(abs).toLowerCase().replace('.', '') : '';
  return {
    name: path.basename(abs),
    path: rel,
    relativePath: rel,
    size: st.size,
    mtime: st.mtime,
    ext,
    mime: isFile ? (mime.lookup(abs) || 'application/octet-stream') : 'inode/directory',
    previewMode: isFile ? getPreviewMode(ext) : '目录',
    type: isFile ? 'file' : 'directory'
  };
}
function markdownToHtml(md) {
  const escaped = escapeHtml(md);
  return escaped.replace(/^### (.*)$/gm, '<h3>$1</h3>').replace(/^## (.*)$/gm, '<h2>$1</h2>').replace(/^# (.*)$/gm, '<h1>$1</h1>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>').replace(/`([^`]+)`/g, '<code>$1</code>').split(/\n{2,}/).map((block) => /^<h\d/.test(block) ? block : `<p>${block.replace(/\n/g, '<br/>')}</p>`).join('\n');
}
function highlight(content, ext) {
  const langMap = { py: 'python', js: 'javascript', mjs: 'javascript', cjs: 'javascript', sh: 'bash', bash: 'bash', ts: 'typescript', json: 'json', yml: 'yaml', yaml: 'yaml', md: 'markdown', html: 'xml', xml: 'xml', css: 'css' };
  const lang = langMap[ext] || ext;
  if (lang && hljs.getLanguage(lang)) return hljs.highlight(content, { language: lang }).value;
  return escapeHtml(content);
}
async function listDir(rel = '') {
  const abs = safeResolve(rel);
  const dirents = await fs.readdir(abs, { withFileTypes: true });
  const entries = await Promise.all(dirents.map(async (d) => {
    const p = path.posix.join(rel, d.name);
    const full = path.join(abs, d.name);
    const st = await fs.stat(full);
    return { name: d.name, path: p, type: d.isDirectory() ? 'directory' : 'file', size: st.size, mtime: st.mtime };
  }));
  entries.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name, 'zh-CN') : a.type === 'directory' ? -1 : 1));
  const parts = rel.split('/').filter(Boolean);
  const breadcrumbs = parts.map((name, i) => ({ name, path: parts.slice(0, i + 1).join('/') }));
  return { path: rel, entries, breadcrumbs };
}
async function previewText(abs, rel, ext, name) {
  const buf = await fs.readFile(abs);
  const text = buf.slice(0, TEXT_LIMIT).toString('utf8');
  return { kind: ['md', 'markdown'].includes(ext) ? 'markdown' : ['py','js','mjs','cjs','sh','bash','ts','tsx','jsx','json','yml','yaml','html','css','xml'].includes(ext) ? 'code' : 'text', path: rel, name, html: ['md', 'markdown'].includes(ext) ? markdownToHtml(text) : highlight(text, ext), searchText: text };
}
async function previewDocx(abs, rel, name) { const { value } = await mammoth.convertToHtml({ path: abs }); const { value: rawText } = await mammoth.extractRawText({ path: abs }); return { kind: 'docx', path: rel, name, html: value || '<p>（文档为空）</p>', searchText: rawText || '' }; }
async function previewXlsx(abs, rel, name) {
  const wb = XLSX.readFile(abs, { cellDates: true });
  const sheets = wb.SheetNames.slice(0, 8).map((sheetName) => ({ name: sheetName, rows: XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, raw: false }).slice(0, TABLE_ROW_LIMIT).map((row) => row.slice(0, TABLE_COL_LIMIT)) }));
  return { kind: 'xlsx', path: rel, name, sheets, searchText: sheets.map((sheet) => `${sheet.name}\n${sheet.rows.map((r) => r.join('\t')).join('\n')}`).join('\n\n') };
}
async function previewPptx(abs, rel, name) {
  const zip = await JSZip.loadAsync(await fs.readFile(abs));
  const slideFiles = Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const slides = [];
  for (const [i, slidePath] of slideFiles.slice(0, SLIDE_LIMIT).entries()) {
    const xml = await zip.files[slidePath].async('string');
    slides.push({ index: i + 1, lines: [...xml.matchAll(/<a:t[^>]*>(.*?)<\/a:t>/g)].map((m) => unescapeXml(m[1])).filter(Boolean) });
  }
  return { kind: 'pptx', path: rel, name, slides, searchText: slides.map((s) => `Slide ${s.index}\n${s.lines.join('\n')}`).join('\n\n') };
}
app.get('/api/list', async (req, res, next) => { try { res.json(await listDir(String(req.query.path || ''))); } catch (e) { next(e); } });
app.get('/api/meta', async (req, res, next) => {
  try {
    res.json(await getFileMeta(String(req.query.path || '')));
  } catch (e) { next(e); }
});
app.get('/api/search-files', async (req, res, next) => {
  try {
    const rel = String(req.query.path || '');
    const q = String(req.query.q || '').trim();
    const recursive = String(req.query.recursive || '1') !== '0';
    const caseSensitive = String(req.query.caseSensitive || '0') === '1';
    const whole = String(req.query.whole || '0') === '1';
    if (!q) return res.json({ total: 0, items: [] });
    const regex = globToRegex(q, { caseSensitive, whole });
    const files = await walkFiles(rel, recursive);
    const items = files.filter((f) => regex.test(f.name) || regex.test(f.path)).slice(0, SEARCH_RESULT_LIMIT);
    res.json({ total: items.length, items });
  } catch (e) { next(e); }
});
app.get('/api/raw', async (req, res, next) => { try { const rel = String(req.query.path || ''); const abs = safeResolve(rel); const st = await fs.stat(abs); if (!st.isFile()) return res.status(400).send('Not a file'); res.type(mime.lookup(abs) || 'application/octet-stream'); res.sendFile(abs); } catch (e) { next(e); } });
app.get('/api/preview', async (req, res, next) => {
  try {
    const rel = String(req.query.path || ''); const abs = safeResolve(rel); const st = await fs.stat(abs); if (!st.isFile()) return res.status(400).send('Not a file');
    const name = path.basename(abs); const ext = path.extname(name).toLowerCase().replace('.', '');
    const imageExts = new Set(['png','jpg','jpeg','gif','webp','bmp','svg']);
    const textExts = new Set(['txt','log','md','markdown','py','js','mjs','cjs','sh','bash','ts','tsx','jsx','json','yml','yaml','html','css','xml']);
    if (imageExts.has(ext)) return res.json({ kind: 'image', path: rel, name });
    if (ext === 'pdf') return res.json({ kind: 'pdf', path: rel, name, searchText: '' });
    if (textExts.has(ext)) return res.json(await previewText(abs, rel, ext, name));
    if (ext === 'docx') return res.json(await previewDocx(abs, rel, name));
    if (ext === 'xls' || ext === 'xlsx') return res.json(await previewXlsx(abs, rel, name));
    if (ext === 'pptx') return res.json(await previewPptx(abs, rel, name));
    return res.json({ kind: 'unsupported', path: rel, name });
  } catch (e) { next(e); }
});
app.use(express.static(PUBLIC_DIR));
app.get('*', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));
app.use((err, req, res, next) => { console.error(err); res.status(err.status || 500).send(err.message || 'Server error'); });
app.listen(PORT, '0.0.0.0', () => { console.log(`Artifact Browser running on http://0.0.0.0:${PORT}`); console.log(`Root: ${ROOT_DIR}`); });
