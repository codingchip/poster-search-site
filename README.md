
<<<<<<< HEAD
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

### 当前正式海报

已确认参数对应可见文字区域。当前使用 `nameLayerCoordinateMode: "content"`，先扣除索引四周留白，再映射到海报。这里用全部姓名坐标框的外包范围近似可见字形边界，不是逐像素识别；仍应抽查左右上下姓名并微调，构建测试通过不等于设计稿中的每个姓名都完整可见。

- 原图：项目上级目录中的 `2026主视觉（海大迎新）10mx3.5m.jpg`，17717×6201 像素。原图不复制到网站或提交到仓库。
- 在线资源：`public/poster/2026.dzi` 与完整的 `public/poster/2026_files/`，两项必须一起提交。
- 姓名字样区域（海报像素）：`x=1659.6`、`y=1566.6`、`width=14368.1`、`height=2489.3`。
- 按用户提供的可见文字区域进行横纵独立缩放；这里的 X/Y 均以区域左上角为基准，不是 PS 变换框的中心坐标。
- 瓦片为 512 像素 PNG，边缘重叠 1 像素，保留原图最高分辨率。PNG 不会恢复原 JPEG 已丢失的细节，但不会再次引入有损编码。

重新生成时先安装依赖，并指定新的输出名称，避免覆盖已有瓦片：

```powershell
npm.cmd install
npm.cmd run poster:build -- "A:\programs\newstudents\2026主视觉（海大迎新）10mx3.5m.jpg" 2026-v2
```

生成后把 `poster.json` 的 `tileSourceUrl` 改为 `poster/2026-v2.dzi`。更换分辨率或姓名层位置时，同步修改宽高和区域参数。该命令只生成资源，不自动修改配置；重复使用已存在的输出名称会报错，原图不变。

`npm.cmd test` 会检查打包后的海报尺寸、每一级 PNG 瓦片是否齐全，以及姓名索引的坐标范围。先抽查实际海报中的姓名框，再发布。

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

修改 `public/config/poster.json`，不要修改 `dist/config/poster.json`（下一次构建会覆盖它）。四个值均为最终海报像素：

- `x`：文字区域左边缘距离海报左边缘；增大后框选整体向右。
- `y`：文字区域上边缘距离海报上边缘；增大后框选整体向下。
- `width`：文字区域宽度；左边缘固定，增大后右侧框选向右展开。
- `height`：文字区域高度；上边缘固定，增大后下方框选向下展开。

当前配置：

```json
{
  "nameLayerCoordinateMode": "content",
  "nameLayerRegion": {
    "x": 1659.6,
    "y": 1566.6,
    "width": 14368.1,
    "height": 2489.3
  }
}
```

`content`：参数对应去掉透明留白后的可见文字范围，适用于当前海报。网站从索引自动计算姓名范围。
`canvas`：参数对应整个 3600×1200 源画布（含留白）；为兼容旧配置，省略模式时也是此行为。

建议先调 `x/y` 纠正整体偏移，再调 `width/height` 纠正越靠右/下偏差越大的情况，并用左、右、上、下和中间不同姓名验证。不要为纠正一处偏移去修改 `poster.width/height`，它们必须仍是图片真实尺寸 17717×6201。

运行 `npm.cmd run dev`（通常 5173）时，保存 JSON 后刷新网页即可。使用 `npm.cmd run preview`（通常 4173）时，要先执行 `npm.cmd run build` 再刷新，才能读取新配置；不需要重新生成瓦片。线上版本需提交并重新部署。

Photoshop 中对完整姓名字样进行缩放和平移后，可以直接填写这个区域；横向和纵向可分别缩放。不要对姓名层做旋转、拆分重排、透视、弯曲或液化，否则当前矩形坐标映射无法保持准确。

## 海报加载与重试

查看器会优先显示预览图，再按当前缩放位置加载高清图块。状态栏显示当前视野的加载进度；“当前视野图块已加载”不代表整张海报的所有层级均已下载。

- 图块请求最多同时进行 6 个，单次超时 60 秒。失败后每隔 2 秒自动重试，最多额外重试 3 次。
- 海报描述文件（DZI）打开失败后，分别等待 2、4、8 秒自动重试；仍失败时提示手动重试。
- 点击“重试高清”会重新初始化查看器，重新请求失败图块，同时保留当前缩放、位置和已选姓名框。按钮有 1.5 秒防连点间隔。
- 图块失败提示会保留到对应图块成功或手动重试，以免低清预览加载完成后掩盖高清加载失败。网络持续不可用时，重试不能保证成功。

参数位于 `src/viewer-recovery.mjs` 的 `TILE_RETRY_OPTIONS`。修改后重新构建、提交并部署即可，无需重新生成海报或姓名坐标。

## 隐私提醒

纯静态关键词搜索要求把姓名索引下载到访客设备，因此公开部署后，完整姓名集合可以被技术人员获取。正式上线前应确认姓名公开授权；如果不希望公开完整名单，需要改成有服务端的精确姓名查询方案。
=======
>>>>>>> da3965357a37ed4b18b8d8e9251a34824cbbfa25
