# Live2D 新增与更新指南

日期：2026-10-22

本文说明如何给当前站点增加、替换或下线 Live2D 看板娘。实现是**本地 Cubism 2 运行时 + 本地模型文件**，不依赖 Live2D 官方 CDN，也不读取远程模型 API。

## 1. 当前加载链路

```text
components/layout/ClientWidgets.tsx
  └─ components/widgets/Live2D.tsx
       └─ <Script src="/live2d/jsdelivr/random/autoload.js?v=4" lazyOnload />
            ├─ /live2d/css/right.css
            ├─ /live2d/live2d.min.js                 Cubism 2 运行时
            ├─ /live2d/jsdelivr/random/waifu-tips.js?v=4
            ├─ /live2d/waifu-tips.json               提示语
            └─ initWidget({ cdnPath: "/live2d/" })
                 └─ /live2d/model_list.json          模型索引
                      └─ /live2d/model/<path>/index.json
```

关键文件：

| 文件 | 作用 |
|:---|:---|
| `public/live2d/model_list.json` | 模型分组、随机换装池、切换模型时的提示语 |
| `public/live2d/model/<path>/index.json` | 单个模型的资源清单（模型、贴图、动作、物理） |
| `public/live2d/waifu-tips.json` | 悬停/点击/节日/空闲提示 |
| `public/live2d/jsdelivr/random/autoload.js` | 启动参数、默认模型、工具按钮 |
| `public/live2d/jsdelivr/random/waifu-tips.js` | 模型加载器、切换模型/换装、提示语逻辑 |
| `public/live2d/live2d.min.js` | Cubism 2 运行时，非 Cubism 3/4 |
| `public/live2d/css/right.css` | 看板娘位置、提示框和深色模式样式 |

几个容易混淆的行为：

- **模型编号是数组下标，不是文件夹名。** `localStorage.modelId` 是 `model_list.json` 里 `models` 的外层下标，例如默认值 `20` 对应 `za/zastavam21_2104/normal` 所在分组。
- **一个外层数组 = 一个模型分组。** 组内第一个路径是“切换到该模型”时加载的默认形态；组内其余路径是“随机换装”池。
- **`switch-model` 切换分组**，按数组顺序循环；**`switch-texture` 从当前分组里随机挑一个路径**，不是只换贴图。因此组内可以放同一角色的不同服装/战损形态。
- **初始加载固定使用组内第一个路径。** `loadModel()` 使用 `models[id][0]`；`modelTexturesId` 会被写入 `localStorage`，但 CDN 模式不会用它决定初始形态。
- **只在桌面宽度显示。** `autoload.js` 里有 `screen.width >= 768` 判断；移动端和 `/garden` 路由不显示。

## 2. 文件布局

推荐按“系列 / 角色版本 / 形态”组织：

```text
public/live2d/model/
└── my-series/
    └── my-character/
        ├── normal/
        │   ├── index.json
        │   ├── model.moc
        │   ├── model.1024/
        │   │   └── texture_00.png
        │   ├── physics.json
        │   └── motions/
        │       ├── idle.mtn
        │       └── tap.mtn
        └── destroy/
            ├── index.json
            ├── model.moc
            ├── model.1024/
            │   └── texture_00.png
            └── motions/
                └── idle.mtn
```

`model_list.json` 里写的是**目录相对路径**，不是 `index.json` 的完整路径：

```json
"my-series/my-character/normal"
```

实际请求地址是：

```text
/live2d/model/my-series/my-character/normal/index.json
```

目录名区分大小写。生产环境通常是 Linux，`AN-94`、`HK416`、`UMP9` 这类现有目录必须保持大小写一致；Windows/macOS 本地能加载不代表线上能加载。

## 3. 新增一个模型

### 3.1 准备 Cubism 2 资源

当前运行时只支持 Cubism 2 的 `.moc` 和 `.mtn`：

- `model.moc`：Cubism 2 模型文件；Cubism 3/4 的 `.moc3` 不能直接加载。
- `texture_00.png`：贴图，放在 `index.json` 能引用到的相对路径下。
- `*.mtn`：动作文件；至少准备一个 idle 动作。
- `physics.json`：可选，物理摇摆。
- `pose.json`：可选，若模型本身提供。

不要直接把 Cubism 3 的 `.model3.json` 改成 `index.json` 使用；文件格式和运行时都不兼容。

### 3.2 编写 `index.json`

以现有模型为模板最稳妥。最小示例：

```json
{
  "version": "Sample 1.0.0",
  "model": "model.moc",
  "textures": ["model.1024/texture_00.png"],
  "motions": {
    "idle": [
      { "file": "motions/idle.mtn", "fade_in": 0, "fade_out": 0 }
    ],
    "": [
      { "file": "motions/idle.mtn", "fade_in": 0, "fade_out": 0 }
    ],
    "tap_body": [
      { "file": "motions/tap.mtn", "fade_in": 1000, "fade_out": 0 }
    ]
  },
  "physics": "physics.json",
  "layout": {
    "center_x": 0,
    "center_y": -0.05,
    "width": 1.5
  },
  "hit_areas": [
    { "name": "body", "id": "D_REF.BODY" }
  ],
  "hit_areas_custom": {
    "head_x": [-0.35, 0.6],
    "head_y": [0.19, -0.2],
    "body_x": [-0.3, -0.25],
    "body_y": [0.3, -0.9]
  }
}
```

字段说明：

| 字段 | 说明 |
|:---|:---|
| `model` | `.moc` 文件相对路径 |
| `textures` | 贴图相对路径数组；路径相对于 `index.json` 所在目录 |
| `motions` | 动作分组；`idle` 和空字符串 `""` 常用作待机，`tap_body` 等对应触摸区域 |
| `physics` | 物理配置相对路径；没有可删除 |
| `layout.center_x` / `center_y` | 画面中心偏移，按模型实际构图微调 |
| `layout.width` | 显示宽度；模型太大/太小改这个值 |
| `hit_areas` | 触摸命中区域；至少保留 `body`，否则点击/触摸动作可能不触发 |
| `hit_areas_custom` | 自定义头部/身体点击范围，可按模型调整 |

注意：

- JSON 不能写注释。
- 所有路径都相对于 `index.json` 所在目录，不要写 `/live2d/...` 开头的绝对路径。
- `textures` 里的文件必须真实存在；缺贴图通常表现为黑块、空白或加载失败。
- 动作文件、物理文件如果写了路径但文件不存在，控制台会报 404；没有对应文件就删掉该字段或数组项。
- 模型贴图建议控制在 1024/2048 级别，避免单张过大导致首屏卡顿。

### 3.3 注册到 `model_list.json`

打开 `public/live2d/model_list.json`，它有两个数组：

```json
{
  "models": [
    ["fairy/air_attack", "fairy/air_attack/02"],
    ["AK12/ak12_0/normal", "AK12/ak12_0/destroy"]
  ],
  "messages": [
    "少女前线 Girls Frontline~ fairy",
    "少女前线 Girls Frontline~ AK12"
  ]
}
```

- `models`：每个元素是一个分组；组内第一个路径是默认形态，其余路径用于随机换装。
- `messages`：与 `models` **一一对应**，长度必须相同；切换模型时显示对应文案。

新增一个独立角色，在 `models` 末尾追加一组，并在 `messages` 末尾追加同下标的文案：

```json
{
  "models": [
    ["fairy/air_attack", "fairy/air_attack/02"],
    ["AK12/ak12_0/normal", "AK12/ak12_0/destroy"],
    [
      "my-series/my-character/normal",
      "my-series/my-character/destroy"
    ]
  ],
  "messages": [
    "少女前线 Girls Frontline~ fairy",
    "少女前线 Girls Frontline~ AK12",
    "我的新看板娘～"
  ]
}
```

只给现有角色加一套衣服/形态，就只往对应分组里追加路径，`messages` 不变：

```json
["AK12/ak12_0/normal", "AK12/ak12_0/destroy", "AK12/ak12_2402/normal"]
```

建议**追加到数组末尾**，不要插入或重排。`modelId` 是下标，插入/删除会让老访客的 `localStorage.modelId` 指向别的模型，甚至越界。

### 3.4 设置默认模型（可选）

`public/live2d/jsdelivr/random/autoload.js` 第 30-33 行：

```js
if (!localStorage.getItem("modelId")) {
  localStorage.setItem("modelId", "20");
  localStorage.setItem("modelTexturesId", "0");
}
```

- 新分组追加在末尾时，它的下标是原长度（例如原来 21 组，新组下标是 `21`）。
- 想让**首次访问**的访客默认看到新模型，把 `"20"` 改成新下标。
- 这个逻辑只在 `localStorage` 没有 `modelId` 时生效；已经访问过的访客仍会保留旧值。要强制所有访客重置，可在浏览器控制台执行：

```js
localStorage.removeItem("modelId");
localStorage.removeItem("modelTexturesId");
location.reload();
```

如果确实需要“发布后所有访客统一换默认模型”，应新增一个配置版本键（例如 `live2d-config-version`），版本变化时清掉 `modelId`；当前代码没有这个机制，不要只改 `"20"` 就期待老访客变化。

### 3.5 本地验证新增模型

```bash
cd Kirameku
pnpm dev
```

打开 `http://localhost:3000`，把浏览器宽度调到 768px 以上，然后：

1. 打开 DevTools → Application → Local Storage，清除 `modelId`、`modelTexturesId`、`waifu-display`。
2. 刷新页面，确认默认模型加载。
3. 点右侧工具条的“切换模型”，确认能循环到新分组，且文案来自 `messages` 对应下标。
4. 点“随机换装”，确认能从新分组里随机到不同路径。
5. 在 Network 面板确认以下请求都是 200，没有 404：
   - `/live2d/model_list.json`
   - `/live2d/model/<path>/index.json`
   - `index.json` 里引用的 `.moc`、贴图、`.mtn`、`physics.json`
6. 鼠标移到看板娘、点看板娘、点导航链接，确认提示语正常。

提交前可以先用 Node 做一次静态校验：

```bash
cd Kirameku
node -e '
const fs = require("fs");
const path = require("path");
const root = "public/live2d";
const list = JSON.parse(fs.readFileSync(path.join(root, "model_list.json"), "utf8"));
const hard = [];
const soft = [];

if (list.models.length !== list.messages.length) {
  hard.push("models 与 messages 长度不一致");
}

list.models.forEach((group, i) => {
  if (!Array.isArray(group) || group.length === 0) {
    hard.push(`models[${i}] 不是非空数组`);
    return;
  }
  group.forEach((modelPath) => {
    const dir = path.join(root, "model", modelPath);
    const indexFile = path.join(dir, "index.json");
    if (!fs.existsSync(indexFile)) {
      hard.push(`缺少 ${indexFile}`);
      return;
    }
    const index = JSON.parse(fs.readFileSync(indexFile, "utf8"));
    for (const file of [index.model, ...(index.textures || [])].filter(Boolean)) {
      const target = path.join(dir, file);
      if (!fs.existsSync(target)) hard.push(`缺少 ${target}`);
    }
    if (index.physics && !fs.existsSync(path.join(dir, index.physics))) {
      soft.push(`缺少物理文件 ${path.join(dir, index.physics)}`);
    }
    for (const motion of Object.values(index.motions || {})) {
      for (const item of motion) {
        if (item && item.file && !fs.existsSync(path.join(dir, item.file))) {
          soft.push(`缺少动作文件 ${path.join(dir, item.file)}`);
        }
      }
    }
  });
});

if (hard.length) {
  console.error("发现阻塞问题：");
  hard.forEach((item) => console.error(`- ${item}`));
  process.exit(1);
}
if (soft.length) {
  console.warn(`警告：${soft.length} 个可选动作/物理文件缺失（历史模型可忽略）`);
  soft.slice(0, 10).forEach((item) => console.warn(`- ${item}`));
}
console.log(`OK: ${list.models.length} 个分组，${list.models.flat().length} 个模型路径`);
'
```

> 仓库里的部分历史模型本身就缺少量动作文件（例如 `kp31/kp31_1103/normal` 引用了不存在的 `motions/christmas.mtn`），所以脚本把动作/物理缺失列为警告，模型和贴图缺失才是阻塞错误。新增模型应尽量做到零警告。

## 4. 更新已有模型

### 4.1 只替换资源，不改路径

最省事的方式：保持目录和文件名不变，直接覆盖：

- `model.moc`
- 贴图（例如 `model.1024/texture_00.png`）
- `motions/*.mtn`
- `physics.json`

`model_list.json` 不需要改。部署后注意缓存，见第 6 节。

### 4.2 新增一套衣服/形态

1. 在角色目录下新建形态目录，例如 `AK12/ak12_2402/normal`。
2. 放入该形态自己的 `index.json`、`.moc`、贴图、动作。
3. 把路径追加到 `model_list.json` 对应分组的末尾。
4. `messages` 不变（文案是分组级的）。
5. 验证“随机换装”能命中新路径，初始加载仍然是组内第一个路径。

### 4.3 删除或下线模型

1. 从 `model_list.json` 的对应分组里删除路径。
2. 如果整个分组都不要了，删除该分组，并**同步删除 `messages` 同下标的文案**。
3. 删除 `public/live2d/model/<path>/` 下的文件。
4. 注意下标变化：删除中间分组会让后面所有分组的 `modelId` 前移。老访客的 `localStorage.modelId` 可能指向错误模型；发布说明里提醒用户清除 `modelId`，或新增配置版本键做自动重置。
5. 如果删除的是默认分组（当前是下标 20），必须同步修改 `autoload.js` 里的默认值。

## 5. 提示语与文案

### 5.1 `model_list.json` 的 `messages`

- `messages[n]` 在切换到第 `n` 个模型分组时显示。
- 长度必须和 `models` 相同；缺项会显示 `undefined` 或没有提示。
- 文案是纯文本/HTML 片段，最终通过 `innerHTML` 写入提示框。只写自己可控的内容，不要拼接用户输入。
- 换行可用 `<br>`；重点词可用 `<span>...</span>`（现有样式会高亮）。

### 5.2 `waifu-tips.json`

结构：

```json
{
  "mouseover": [
    { "selector": "#live2d", "text": ["干嘛呢你～", "鼠标放错地方了！"] }
  ],
  "click": [
    { "selector": "nav a", "text": ["要去 <span>{text}</span> 逛逛吗？"] }
  ],
  "seasons": [
    { "date": "01/01", "text": "元旦了呢，今年是 {year} 年～" },
    { "date": "12/24-12/25", "text": "圣诞快乐！" }
  ],
  "time": [
    { "hour": "6-7", "text": "早上好！" }
  ],
  "message": {
    "default": ["好久不见～", "快来逗我玩吧！"],
    "console": "哈哈，你打开了控制台～",
    "copy": "转载要记得加上出处哦！",
    "visibilitychange": "哇，你终于回来了～"
  }
}
```

可用字段：

| 字段 | 行为 |
|:---|:---|
| `mouseover` | 鼠标移到匹配元素时随机显示一条；`selector` 交给 `closest()` 匹配 |
| `click` | 点击匹配元素时随机显示一条 |
| `seasons` | 按 `MM/DD` 或 `MM/DD-MM/DD` 日期范围追加到空闲提示；`{year}` 会替换为当前年份 |
| `time` | 当前加载器保留了该字段，但欢迎语实际由 `getTimeGreeting()` 根据首页/文章页、来源和访客位置生成；改 `time` 不会改变欢迎语 |
| `message.default` | 空闲时循环显示的文案数组 |
| `message.console` | 打开控制台时显示 |
| `message.copy` | 复制页面内容时显示 |
| `message.visibilitychange` | 页面重新可见时显示 |

占位符：

- `{text}`：匹配元素的 `innerText`，常用于导航链接和文章标题。
- `{year}`：当前年份，仅节日文案使用。

选择器建议：

- 看板娘本体：`#live2d`
- 工具按钮：`#waifu-tool-switch-model`、`#waifu-tool-switch-texture`、`#waifu-tool-hitokoto` 等
- 站点导航：`nav a[href='/posts']`、`a[href^='/posts/']`、`footer a`
- 通配按钮：`button`

不要删除 `mouseover`、`click`、`seasons`、`message` 这些顶层字段；`setupTips()` 会直接遍历它们，缺字段会导致提示初始化报错。

## 6. 缓存与运行时版本

Live2D 资源都在 `public/live2d/` 下，由 Next 静态文件服务提供；生产环境前面可能还有 Nginx/CDN 缓存。更新后如果页面仍是旧模型/旧提示，按下面顺序排查：

1. **浏览器硬刷新**：macOS `Cmd+Shift+R`，Windows `Ctrl+Shift+R`。
2. **清 Local Storage**：删除 `modelId`、`modelTexturesId`、`waifu-display`；如果换了目录结构，旧的 `modelId` 可能越界。
3. **提升脚本版本号**：
   - `components/widgets/Live2D.tsx`：`/live2d/jsdelivr/random/autoload.js?v=4`
   - `public/live2d/jsdelivr/random/autoload.js`：`waifu-tips.js?v=4`
   - 两处一起改成新版本（例如 `v=5`），让浏览器重新拉取启动脚本和提示脚本。
4. **`model_list.json` / `waifu-tips.json` 没有版本参数**：它们由 `waifu-tips.js` 直接 `fetch()`。如果 CDN 强缓存导致更新不生效，可在部署时刷新这两个文件的缓存，或临时在 `waifu-tips.js` 的 fetch 地址后加 `?v=<版本>`（记得同步文档和下次更新）。
5. **CDN 缓存**：确认 Nginx/CDN 对 `/live2d/*` 的缓存策略；模型文件可以长缓存，但更新时应主动刷新或改名。

运行时更新：

- 当前 `live2d.min.js` 是 Cubism 2 运行时，替换它属于高风险变更；先用一个测试模型验证 `loadlive2d`、动作、物理和点击命中都正常。
- 升级到 Cubism 3/4 不能只换 `live2d.min.js`：需要新的 core、`.model3.json`、`.moc3`，并改写 `waifu-tips.js` 的加载逻辑。当前项目没有这套适配。
- 修改 `waifu-tips.js` 属于 vendor 脚本改动，提交前至少跑一次桌面端完整交互验证。

## 7. 授权、体积与性能

`public/live2d/` 当前约 **216 MB**，Git 跟踪约 **1178** 个文件，主要是模型和贴图。新增模型前注意：

- **确认授权**：现有模型包含《少女前线》等角色素材。新增/替换模型前确认素材许可、署名和再分发条件；不要把来源不明的模型提交到仓库。
- **控制体积**：优先压缩贴图、删除未使用的动作/形态；单个模型建议控制在几 MB 到十几 MB，避免拖慢首屏和 Git 仓库。
- **按需加载**：看板娘本身是 `lazyOnload`，不会阻塞首屏；但模型文件过大仍会影响桌面端交互。
- **移动端**：宽度小于 768px 不加载，避免移动流量；不要为了“全端显示”直接删掉这个判断，除非同时评估 Canvas 性能和流量。

## 8. 常见问题

| 现象 | 排查 |
|:---|:---|
| 页面没有看板娘 | 宽度是否 ≥ 768px；是否在 `/garden`；Local Storage 是否设置了 `waifu-display`；Network 里 `autoload.js` 是否 200 |
| `index.json` 404 | `model_list.json` 里的路径是否指向目录而不是 `index.json`；目录大小写是否匹配 |
| 模型黑块/空白 | `textures` 路径是否相对 `index.json` 正确；贴图是否真实存在；贴图尺寸是否超出运行时限制 |
| 控制台报 `.moc` 解析失败 | 文件是否是 Cubism 2 `.moc`；Cubism 3 `.moc3` 需要另一套运行时 |
| 点击没有动作 | `hit_areas` 是否包含 `body` 等区域；`motions.tap_body` 是否存在；动作文件是否 404 |
| 模型太大/太小/位置偏 | 调整 `index.json` 的 `layout.width`、`center_x`、`center_y` |
| 切换模型后提示 `undefined` | `messages` 与 `models` 长度不一致，或新分组漏了文案 |
| 切换模型后模型不对/越界 | `modelId` 是下标；插入/删除分组后老 `localStorage` 失效，清除 `modelId` |
| 改了文件但页面没变化 | 硬刷新；清 Local Storage；提升 `?v=`；检查 CDN/Nginx 缓存 |
| 随机换装总是同一个 | 分组里只有一个路径，或浏览器缓存了旧 `model_list.json` |
| 提示语不显示 | `waifu-tips.json` JSON 是否合法；`mouseover`/`click`/`seasons`/`message` 字段是否齐全；选择器是否匹配当前 DOM |

## 9. 提交前检查清单

- [ ] 新模型是 Cubism 2 `.moc` + `.mtn`，不是 `.moc3`。
- [ ] `public/live2d/model/<path>/index.json` 存在，`model`、`textures`、`motions`、`physics` 引用全部存在。
- [ ] 路径大小写与生产 Linux 一致。
- [ ] `model_list.json` 的 `models` 与 `messages` 长度相同。
- [ ] 新分组追加在末尾，或已同步处理 `modelId` 下标迁移。
- [ ] 默认模型下标与 `autoload.js` 一致（如果改了默认）。
- [ ] 桌面端 ≥768px 能加载、切换模型、随机换装、悬停/点击提示正常。
- [ ] 移动端和 `/garden` 不显示看板娘。
- [ ] 文档/授权/体积已确认，未提交来源不明的素材。
- [ ] `pnpm typecheck`、`pnpm test`、`pnpm build` 通过。
