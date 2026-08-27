# 新生姓名海报查询站

面向手机和微信公众号内置浏览器的纯静态姓名查询页面。姓名搜索、坐标定位、海报拖动与缩放均在浏览器端完成，不需要服务器或数据库，可直接部署到 GitHub Pages。

## 本地运行

```powershell
cd A:\programs\newstudents\poster-search-site
npm.cmd install
npm.cmd run dev
```

浏览器打开终端显示的地址（通常是 `http://localhost:5173/`）。生产构建与预览：

```powershell
npm.cmd run build
npm.cmd run preview
```

## 部署到 GitHub Pages

项目已包含 `.github/workflows/deploy.yml`。把项目提交并推送到 GitHub 仓库的 `main` 分支后：

1. 打开仓库的 **Settings → Pages**。
2. 在 **Build and deployment → Source** 中选择 **GitHub Actions**。
3. 打开 **Actions** 查看自动部署进度。
4. 部署完成后，从 Pages 页面打开网址。

构建会自动识别仓库名并生成正确的子目录资源路径。例如仓库叫 `poster-search-site`，网址可以是 `https://用户名.github.io/poster-search-site/`。如果使用自定义路径，可在构建时设置 `VITE_BASE_PATH`。

## 更新姓名坐标

默认读取上级目录的 `欢迎新同学！-姓名坐标索引.json`，并压缩为手机端索引：

```powershell
npm.cmd run data:build
```

也可以指定其他坐标文件：

```powershell
node scripts/build-name-index.mjs "A:\完整路径\姓名坐标索引.json"
```

生成文件为 `public/data/name-index.json`，构建后会原样复制到 `dist/data/name-index.json`。

## 替换正式海报

编辑 `public/config/poster.json`。配置中的本地文件路径可写成 `/poster/poster.webp` 或 `poster/poster.webp`，网站会自动补上 GitHub Pages 的仓库子路径。

### 普通图片模式

适用于手机端优化后的 WebP/JPEG 预览图：

```json
{
  "poster": {
    "mode": "image",
    "imageUrl": "/poster/poster.webp",
    "tileSourceUrl": "",
    "width": 16000,
    "height": 9000
  }
}
```

将图片放到 `public/poster/poster.webp`。

### 超大海报瓦片模式（推荐）

长边达到 16000 像素时，手机直接解码整张图片可能占用数百 MB 内存。建议把海报转换为 Deep Zoom 或 IIIF 瓦片，然后设置：

```json
{
  "poster": {
    "mode": "tiles",
    "imageUrl": "",
    "tileSourceUrl": "/poster/2026.dzi",
    "width": 16000,
    "height": 9000
  }
}
```

把 `.dzi` 和对应瓦片目录一起放入 `public/poster/`。网页支持瓦片按需加载、拖动、鼠标滚轮缩放、手机双指缩放和双击放大。

## 姓名字样在最终海报中的位置

`nameLayerRegion` 表示 3600×1200 姓名字样被放入最终海报后的像素范围：

```json
{
  "nameLayerRegion": {
    "x": 1200,
    "y": 2400,
    "width": 13600,
    "height": 4533
  }
}
```

只要 Photoshop 中对姓名字样进行等比例缩放和平移，就可以直接填写这个区域。不要对姓名层做透视、弯曲或液化，否则矩形坐标无法保持准确。

## 隐私提醒

纯静态关键词搜索要求把姓名索引下载到访客设备，因此公开部署后，完整姓名集合可以被技术人员获取。正式上线前应确认姓名公开授权；如果不希望公开完整名单，需要改成有服务端的精确姓名查询方案。
