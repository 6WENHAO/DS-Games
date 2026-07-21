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

1. 在对应作者目录下创建游戏文件夹
2. 放入 `index.html`（或对应的入口 html）和 `视频链接.txt`
3. 在 `index.html` 的 `games` 数组中添加条目：

```js
{ title: "游戏名", author: "作者名", tag: "标签",
  gameUrl: "https://dsgames-exm.pages.dev/作者名/游戏名/index.html",
  videoUrl: "https://www.bilibili.com/video/BV号",
  thumb: "covers/封面.jpg" }
```

4. 下载封面到 `covers/` 目录
5. 提交并推送，Cloudflare Pages 自动部署

## 封面下载

```bash
BV="BVxxxxxxxxx"
curl -s "https://api.bilibili.com/x/web-interface/view?bvid=$BV" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['pic'])" \
  | xargs -I {} curl -sL -o covers/封面名.jpg {}
```

## 技术栈

- 纯 HTML/CSS/JS 静态页面
- Three.js 3D 渲染
- 部署于 Cloudflare Pages
