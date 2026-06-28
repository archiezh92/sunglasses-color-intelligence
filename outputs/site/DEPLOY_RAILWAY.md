# Railway 部署教程

这个目录已经是前后端分离的静态数据站：

- 前端：`outputs/site/index.html`、`app.css`、`app.js`
- 数据层：`outputs/site/data/catalog.json`、`outputs/site/data/insights.json`
- 服务入口：项目根目录的 `server.mjs`
- Railway 启动命令：`npm start`

## 方式 A：从 GitHub 部署

1. 把整个项目目录提交到 GitHub。
2. 打开 Railway，选择 `New Project`。
3. 选择 `Deploy from GitHub repo`。
4. 选择这个仓库。
5. Railway 会识别 `package.json`。
6. 确认 Start Command 是：

```bash
npm start
```

7. 部署完成后，打开 Railway 生成的域名即可。

## 方式 B：用 Railway CLI

1. 安装并登录 Railway CLI。
2. 在项目根目录运行：

```bash
railway login
railway init
railway up
```

3. 如果 Railway 没自动识别启动命令，在项目 Settings 里设置：

```bash
npm start
```

## 更新数据

当前部署不依赖你电脑 home 目录里的四个原始 HTML，云端只读取：

```text
outputs/site/data/catalog.json
outputs/site/data/insights.json
```

后续如果品牌上新，有两种更新方式：

1. 本地重新生成数据，再提交/上传：

```bash
npm run build:all
```

2. 未来接真正后端 API：

把 `outputs/site/app.js` 里的：

```js
fetch('./data/catalog.json')
fetch('./data/insights.json')
```

替换成：

```js
fetch('/api/catalog')
fetch('/api/insights')
```

建议后端接口结构：

- `GET /api/catalog`
- `GET /api/insights`
- `POST /api/import-brand`
- `POST /api/reclassify`

## 注意

Railway 会通过环境变量 `PORT` 指定端口，`server.mjs` 已经兼容：

```js
process.env.PORT || 3000
```

所以不要在 Railway 上写死端口。
