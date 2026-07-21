# DS-Games

DeepSeek 灰度节点生成的网页游戏合集，由多位创作者通过 AI 驱动开发。

## 在线访问

| 入口 | 地址 |
|---|---|
| 游戏中心首页（全球） | [dsgames-exm.pages.dev](https://dsgames-exm.pages.dev) |
| 游戏中心首页（国内） | [dsgames.askhow.top](https://dsgames.askhow.top) |

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
├── {作者名}/
│   └── {游戏名}/
│       ├── index.html      # 游戏入口
│       ├── 视频链接.txt     # B站视频链接
│       └── ...             # 游戏资源
├── covers/                 # 封面图片
└── index.html              # 游戏中心首页
```

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

## 技术栈

- 纯 HTML/CSS/JS 静态页面
- Three.js 3D 渲染
- 部署于 Cloudflare Pages
