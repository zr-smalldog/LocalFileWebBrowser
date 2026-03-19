import React, { useEffect, useMemo, useState } from 'react';

const fmtSize = (size) => {
  if (size == null) return '-';
  const units = ['B', 'KB', 'MB', 'GB'];
  let n = size;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
};

async function api(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function useListing(path) {
  const [data, setData] = useState({ path, entries: [], breadcrumbs: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    setLoading(true);
    setError('');
    api(`/api/list?path=${encodeURIComponent(path)}`)
      .then(setData)
      .catch((e) => setError(e.message || '加载目录失败'))
      .finally(() => setLoading(false));
  }, [path]);
  return { data, loading, error };
}

function usePreview(path) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!path) return;
    setLoading(true);
    setError('');
    setData(null);
    api(`/api/preview?path=${encodeURIComponent(path)}`)
      .then(setData)
      .catch((e) => setError(e.message || '预览失败'))
      .finally(() => setLoading(false));
  }, [path]);
  return { data, loading, error };
}

function EntryTree({ entries, onOpen, selectedPath }) {
  return (
    <div className="entry-list">
      {entries.map((entry) => (
        <button
          key={entry.path}
          className={`entry ${selectedPath === entry.path ? 'selected' : ''}`}
          onClick={() => onOpen(entry)}
        >
          <span className="entry-name">{entry.type === 'directory' ? '📁' : '📄'} {entry.name}</span>
          <span className="entry-meta">{entry.type === 'directory' ? '目录' : fmtSize(entry.size)}</span>
        </button>
      ))}
    </div>
  );
}

function Preview({ preview, loading, error }) {
  if (!preview && !loading && !error) return <div className="empty">选择文件开始预览</div>;
  if (loading) return <div className="empty">预览加载中...</div>;
  if (error) return <div className="empty error">{error}</div>;
  if (!preview) return null;

  if (preview.kind === 'image') {
    return <div className="preview-scroll"><img className="preview-image" src={`/api/raw?path=${encodeURIComponent(preview.path)}`} alt={preview.name} /></div>;
  }

  if (preview.kind === 'markdown') {
    return <div className="preview-scroll prose" dangerouslySetInnerHTML={{ __html: preview.html }} />;
  }

  if (preview.kind === 'code' || preview.kind === 'text') {
    return (
      <div className="preview-scroll">
        <pre className="code-block"><code dangerouslySetInnerHTML={{ __html: preview.html }} /></pre>
      </div>
    );
  }

  if (preview.kind === 'docx') {
    return <div className="preview-scroll prose" dangerouslySetInnerHTML={{ __html: preview.html }} />;
  }

  if (preview.kind === 'xlsx') {
    return (
      <div className="preview-scroll sheets">
        {preview.sheets.map((sheet) => (
          <section key={sheet.name} className="sheet">
            <h3>{sheet.name}</h3>
            <table>
              <tbody>
                {sheet.rows.map((row, i) => (
                  <tr key={i}>{row.map((cell, j) => <td key={j}>{cell ?? ''}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>
    );
  }

  if (preview.kind === 'pptx') {
    return (
      <div className="preview-scroll slides">
        {preview.slides.map((slide) => (
          <section key={slide.index} className="slide">
            <h3>Slide {slide.index}</h3>
            {slide.lines.length ? slide.lines.map((line, i) => <p key={i}>{line}</p>) : <p className="muted">（无可提取文本）</p>}
          </section>
        ))}
      </div>
    );
  }

  return <div className="empty">暂不支持此文件类型的内嵌预览，可直接下载。</div>;
}

export function App() {
  const [currentDir, setCurrentDir] = useState('');
  const [selectedFile, setSelectedFile] = useState('');
  const { data, loading, error } = useListing(currentDir);
  const preview = usePreview(selectedFile);

  const title = useMemo(() => selectedFile || currentDir || '/', [selectedFile, currentDir]);

  const openEntry = (entry) => {
    if (entry.type === 'directory') {
      setCurrentDir(entry.path);
      setSelectedFile('');
    } else {
      setSelectedFile(entry.path);
    }
  };

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1>Artifact Browser</h1>
          <div className="root-tag">根目录固定：workspace</div>
        </div>
        <div className="breadcrumbs">
          <button onClick={() => { setCurrentDir(''); setSelectedFile(''); }}>/</button>
          {data.breadcrumbs.map((crumb) => (
            <button key={crumb.path} onClick={() => { setCurrentDir(crumb.path); setSelectedFile(''); }}>{crumb.name}</button>
          ))}
        </div>
        {loading ? <div className="empty">目录加载中...</div> : error ? <div className="empty error">{error}</div> : <EntryTree entries={data.entries} onOpen={openEntry} selectedPath={selectedFile} />}
      </aside>
      <main className="content">
        <div className="content-header">
          <div>
            <div className="muted">当前</div>
            <h2>{title}</h2>
          </div>
          {selectedFile ? <a className="download-btn" href={`/api/raw?path=${encodeURIComponent(selectedFile)}`} target="_blank" rel="noreferrer">打开/下载原文件</a> : null}
        </div>
        <Preview {...preview} />
      </main>
    </div>
  );
}
