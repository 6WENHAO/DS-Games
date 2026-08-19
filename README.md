# DS-Games

DeepSeek 灰度节点生成的网页游戏合集，由多位创作者通过 AI 驱动开发。

## 在线访问

> 站点默认入口 = **第二轮灰测**首页；第一期可访问 `/第一期.html`。

| 入口 | 地址 |
|---|---|
| 游戏中心首页（全球，默认第二轮） | [dsgames-exm.pages.dev](https://dsgames-exm.pages.dev) |
| 游戏中心首页（国内，默认第二轮） | [dsgames.askhow.top](https://dsgames.askhow.top) |
| 第一期游戏场 | `/第一期.html` |

## 创作者 & 作品

| 作者 | 作品数 | 代表作 |
|---|---|---|
| UPLUZ | 8 | 灾害模拟器、节奏光剑 |
| kdzzzds | 7 | 我的世界+无人深空、拳皇3 |
| 冬眠の松鼠_ | 6 | 森林、炉石传说 |
| 梦回0 | 4 | StarRoamer、王者荣耀×和平精英 |
| 小小小名不是小明 | 4 | 双叉臂、enginsim引擎模拟 |
| 黑韬 | 3 | 卡门小剧场、幽灵诡计 |
| Augenstern_-__- | 3 | poolrooms、blackhole |
| 鱼村长233 | 2 | NES模拟器、音乐创建 |
| 离梦aajjkk | 2 | 4000小球测试 |
| stupid_scout | 2 | 钢铁前线 |
| 元の桑 | 1 | 华强买瓜 |
| phylossia | 1 | 保卫萝卜 |
| cph01 | 1 | voxelsky |
| PotnQ | 1 | 星穹熔炉 |

> 共 14 位创作者，45 款游戏

## 目录结构

```
├── {作者名}/               # 第一期：外层目录 = 作者名
│   └── {游戏名}/
│       ├── index.html      # 游戏入口
│       ├── 视频链接.txt     # B站视频链接
│       └── ...             # 游戏资源
├── 第二轮灰测/             # 第二轮灰测：匿名游戏（无作者/无视频）
│   ├── {游戏名}/
│   └── covers/             # HTML 截图封面
├── covers/                 # 第一期封面图片
├── index.html              # 第二轮灰测首页（默认入口）
└── 第一期.html              # 第一期游戏中心首页（原 index.html）
```

## 第二轮灰测

- 首页：`index.html`（站点默认入口；沿用一期视觉风格改为深色高级版，替换「作者/视频」为「匿名」，封面 = HTML 截图）
- 第一期首页：`第一期.html`（原 `index.html`，仍在顶部提供「第二轮灰测 ↗」互链）
- 目录：`第二轮灰测/{游戏名}/`，匿名提交，无作者、无视频链接字段
- 封面：截图放入 `第二轮灰测/covers/{游戏名}.png|jpg`
- 封面缺失自动显示占位（标题首字 + 渐变底），不破版
- 新增游戏：目录放入 `第二轮灰测/`，截图放入 `第二轮灰测/covers/`，再在 `index.html` 的 `games` 数组加一条（格式见文件内注释），最后提交推送（`git add -A`）

### 自动生成封面

> 依赖本机安装 Chrome（`/Applications/Google Chrome.app`）。截图会按入口 `file://` + SwiftShader 软件渲染生成 1600×900 封面，命名 = `第二轮灰测/` 下顶层名 + `.jpg`（已压缩优化），成功后自动回填 `index.html` 的 `thumb`；抓不到的条目保持占位。

```bash
python3 gen-covers.py             # 全量生成/刷新（并回填 thumb）
python3 gen-covers.py <关键词>     # 只生成封面名含关键词的游戏
```

- WebGL/启动慢的游戏若首轮空白，加大 `gen-covers.py` 里的 `VTB`/`SHOT_TIMEOUT` 再跑即可；个别实在不出的可手动截图放进 `covers/`
- 手动替换封面：直接覆盖 `第二轮灰测/covers/<同名>.jpg` 即可（无需改首页）

## 新增游戏

多人协作推荐流程：

```bash
# 1. 同步最新
git pull

# 2. 放入游戏文件
#    作者名/游戏名/index.html  （或 game.html / 任意 .html）
#    作者名/游戏名/视频链接.txt  （可选）

# 3. 一键添加（自动下载封面、写入条目、获取B站空间）
./add-game.sh

# 4. 提交推送
git add -A
git commit -m "add: 作者名/游戏名"
git push
```

> 部署后 Cloudflare Pages 和 腾讯云 EdgeOne 自动更新。

### 文件规范

| 文件 | 说明 |
|---|---|
| `index.html` / `game.html` | 游戏入口，优先识别 `index.html` |
| `视频链接.txt` | 包含 B站视频链接（可选） |
| `视频链接.txt` 示例 | `https://www.bilibili.com/video/BVxxxxxxxxx` |

### 封面命名

- 有视频链接 → `covers/BV号.jpg`（同视频自动复用）
- 无视频链接 → `covers/作者_游戏名.jpg`

### 手动获取 B站空间链接

通过视频 BV 号查询作者 UID：

```bash
BV="BVxxxxxxxxx"
curl -s "https://api.bilibili.com/x/web-interface/view?bvid=$BV" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); \
    uid=d['data']['owner']['mid']; print(f'https://space.bilibili.com/{uid}')"
```

## 友情链接

- [dsv4ga-news-gather](https://github.com/YunhaoFu/dsv4ga-news-gather) — DSV4 灰度新闻聚合

## 技术栈

- 纯 HTML/CSS/JS 静态页面
- Three.js 3D 渲染
- 部署于 Cloudflare Pages
