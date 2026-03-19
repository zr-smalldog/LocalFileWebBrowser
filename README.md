# LocalFileWebBrowser

一个部署在虚拟机中的轻量本地文件产物浏览器，用浏览器查看 `/home/openclaw/.openclaw/workspace` 及其子目录下的工作产物。

## 项目目标

- 后端运行在当前虚拟机
- 宿主机通过浏览器访问 `虚拟机IP:端口`
- 只读浏览和预览本地工作产物
- 尽量少依赖、轻量、易维护

## 当前能力

### 文件浏览
- 根目录固定为：`/home/openclaw/.openclaw/workspace`
- 支持浏览其子目录
- 只读访问
- 禁止跳出根目录

### 文件预览
当前支持：

- 图片：`png`, `jpg`, `jpeg`, `gif`, `webp`, `bmp`, `svg`
- 纯文本/代码：`txt`, `log`, `md`, `markdown`, `py`, `js`, `mjs`, `cjs`, `sh`, `bash`, `ts`, `tsx`, `jsx`, `json`, `yml`, `yaml`, `html`, `css`, `xml`
- Markdown：渲染预览
- DOCX：正文 HTML 预览
- XLS/XLSX：表格预览
- PPTX：文本型 slide 预览

### 搜索能力
- 左侧文件搜索
  - 支持 `*` 和 `?` 通配符
  - 支持是否包含子目录
  - 支持全字匹配
  - 支持区分大小写
  - 支持结果统计
  - 支持结果高亮
  - 支持显示所属目录
- 右侧当前文件内搜索
  - 支持 `*` 和 `?` 通配符
  - 支持全字匹配
  - 支持区分大小写
  - 支持结果统计
  - 支持高亮

### 交互体验
- 左右区域独立滚动
- 深色主题
- 自定义滚动条样式
- 支持原文件打开/下载

## 技术栈

### 后端
- Node.js
- Express
- mammoth（DOCX 预览）
- xlsx（XLS/XLSX 预览）
- jszip（PPTX 文本提取）
- highlight.js（代码高亮）

### 前端
- 原生 HTML / CSS / JavaScript

> 当前版本采用静态前端 + Express 一体部署方案，优先保证依赖少、部署稳、维护简单。

## 项目结构

```bash
LocalFileWebBrowser/
├── public/
│   ├── index.html
│   ├── app.js
│   └── styles.css
├── server/
│   └── index.js
├── package.json
├── package-lock.json
├── .gitignore
└── README.md
```

> 目录中如果仍有 `src/` 或 `vite.config.js` 等历史文件，它们属于早期尝试阶段遗留，目前运行主链路不依赖它们。

## 部署与运行说明

### 运行环境要求
- Linux 虚拟机
- Node.js 18+（推荐 Node.js 20+）
- npm 可用
- 宿主机与虚拟机网络互通

### 项目位置
```bash
/home/openclaw/.openclaw/workspace/LocalFileWebBrowser
```

### 安装依赖
```bash
cd /home/openclaw/.openclaw/workspace/LocalFileWebBrowser
npm install
```

### 前台启动
```bash
npm start
```

默认端口：
- `3210`

默认监听：
- `0.0.0.0`

### 后台启动（推荐）
```bash
cd /home/openclaw/.openclaw/workspace/LocalFileWebBrowser
nohup npm start > server.log 2>&1 &
```

### 查看进程
```bash
ps -ef | grep LocalFileWebBrowser
ps -ef | grep "node server/index.js"
```

### 查看日志
```bash
tail -f /home/openclaw/.openclaw/workspace/LocalFileWebBrowser/server.log
```

### 停止服务
先查 PID：
```bash
ps -ef | grep "node server/index.js"
```

然后结束进程：
```bash
kill <PID>
```

### 修改端口启动
```bash
PORT=3211 npm start
```

## 访问方式

### 虚拟机本机访问
```bash
http://127.0.0.1:3210
```

### 宿主机访问
```bash
http://<虚拟机IP>:3210
```

例如：
```bash
http://172.16.26.4:3210
```

### 端口连通性检查
如果宿主机打不开页面，可在虚拟机中检查：

```bash
ss -ltnp | grep 3210
curl http://127.0.0.1:3210
```

如果虚拟机本机能访问，但宿主机不能访问，优先检查：
- 虚拟机网络模式（桥接 / NAT / 端口映射）
- 虚拟机防火墙
- 宿主机到虚拟机 IP 是否可达

### 常见问题排查

#### 1. 页面打不开
检查服务是否仍在运行：
```bash
ps -ef | grep "node server/index.js"
```

#### 2. 端口被占用
```bash
ss -ltnp | grep 3210
```
可换端口启动：
```bash
PORT=3211 npm start
```

#### 3. 宿主机可以打开但内容异常
检查日志：
```bash
tail -f server.log
```

#### 4. Office 文件预览失败
优先确认文件本身未损坏，并查看服务日志中的报错信息。

## 安全边界

当前版本无鉴权，按需求设计为内网只读使用。

已做保护：
- 根目录固定
- 路径安全校验
- 禁止通过 `../` 跳出 workspace
- 只提供读取/预览/下载，不提供写操作

**注意：**
由于无鉴权，仅建议在可信内网环境使用，不建议直接暴露到公网。

## 已知限制

### Office 预览
- PPTX 目前为文本抽取式预览，不是版式还原
- DOCX 主要是正文和基础样式预览，不保证复杂排版完全一致
- XLS/XLSX 是轻量表格预览，复杂公式、图表、样式不完整

### 搜索
- 文件内搜索是前端高亮型搜索，主要服务于当前预览内容
- 对特别大的文档，搜索体验和性能仍有优化空间

### 功能边界
当前版本暂未提供：
- 鉴权
- 文件上传
- 文件编辑
- 删除/重命名
- 全局全文索引
- 高保真 Office 在线预览

## Git 工作流

项目已接入 Git，并已绑定远程仓库：

```bash
https://github.com/zr-smalldog/LocalFileWebBrowser.git
```

### 常用命令

查看状态：
```bash
git status
```

提交修改：
```bash
git add .
git commit -m "feat: your message"
```

推送到 GitHub：
```bash
git push
```

拉取远程更新：
```bash
git pull
```

## 下一步可迭代方向

- README 中补充接口文档
- 增加文件排序、筛选、分页
- 增加搜索结果上下跳转
- 优化 DOCX / PPTX / XLSX 预览效果
- 增加 PDF 支持
- 增加音视频支持
- 增加可选鉴权

## 备注

这是一个为当前 OpenClaw 工作环境定制的本地文件浏览器基线项目，目标是：

**快速查看工作产物，而不是成为一个重型在线 Office 系统。**
