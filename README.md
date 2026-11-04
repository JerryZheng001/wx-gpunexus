# 算力市 · 微信小程序

按「算力市产品原型 V1」实现的 Taro 4 + React 18 + TypeScript 页面演示版。视觉已按用户提供的 `src/assets/截屏2026-11-04 16.52.15.png` 统一为浅灰背景、白色卡片和蓝色主色。微信小程序是主要交付端，H5 用于浏览器联调。

已于 2026-11-04 按当天 13:36 保存的最新版 HTML 同步发布表单、收藏分类、首页行情轮播、资产评估弹层与店铺管理入口，详见 [本次原型同步记录](docs/PROTOTYPE_UPDATE.md)。

配色变量位于 `src/styles/_theme.scss`（页面及原生 TabBar）与 `src/constants/theme.ts`（图表及轮播）。微信系统导航颜色配置在 `src/app.config.ts`；行情保留红涨绿跌，微信分享保留绿色。参考截图仅作为设计文件保存，不会被业务页面引用或打包。

## 启动

需要 Node.js 20 或以上（本次使用 Node.js 22）。

```bash
npm ci
npm run dev:weapp
```

微信开发者工具导入**本项目根目录** `/Users/max/WeChatProjects/miniprogram-1`。根目录 `project.config.json` 已配置 `miniprogramRoot: "dist/"`，并保留原项目 AppID；不需要在工具中额外“构建 npm”。首次导入前应先运行上面的编译命令。

```bash
npm run build:weapp   # 生成微信小程序到 dist/
npm run dev:h5       # 浏览器预览 http://127.0.0.1:10086
npm run build:h5      # 生成 H5 到 dist-h5/
npm run preview:h5    # 启动已构建 H5 的静态预览
npm run typecheck
npm run check:config
npm run check:weapp   # 检查已生成的微信路由和底部导航样式
npm test
```

CLI 命令使用 `--disable-global-config --no-check`，避免构建时读取个人全局插件、写入用户目录和拉取远程配置 Schema。`check:config` 使用 Taro 自带的本地 Schema 实际校验配置，并非跳过配置质量检查。开发构建关闭了依赖预编译，减少平台缓存与预编译版本差异。

## 已实现

- 五个主入口：首页、行情、发布、市场、我的，自定义底部导航。
- 首页行情轮播、我的关注、市场资讯、最新供需信息、资产评估说明弹层。
- 单卡 / 整机行情、型号搜索、关注列表、详情、日周月折线与 K 线切换。
- 市场按型号 / 关键词搜索，按售卖 / 租赁 / 需求、成色和核验状态筛选，价格升降序。
- 商品详情、店铺主页、店内搜索、店铺关注、微信分享入口。
- 售卖 / 租赁 / 需求动态表单：省市联动、名称与型号、分类、价格区间、交付周期、自定义成色及截止日期。
- 租赁包日 / 包周 / 包月 / 按量计费，现价与可选划线原价联动校验；本机自动草稿、图片选择 / 预览 / 移除、模拟提交。
- 发布管理：编辑、撤回、模拟审核通过、上 / 下架、续期、删除、状态统计。
- 收藏按全部 / 市场资讯 / 商品 / 行情筛选，行情关注计入总数；按日期展示足迹，新增记录保存标题快照，失效信息保留入口及移除操作。
- 企业 / 个人入驻表单、演示验证码、明确标注的模拟审核与我的店铺。
- 意见反馈、举报入口、平台联系说明和关于页面。

共 16 个路由页面。旧的微信原生初始模板已移除；原项目配置备份在 `docs/`，业务源码位于 `src/`，微信编译产物位于 `dist/`。

## 数据与接口

`src/services/fixtures.ts` 是原型示例数据，所有行情、供应商、评分与文章均不代表真实业务。`src/services/market.ts` 定义类型化的 `MarketService`，当前使用异步 Mock 实现；接口确定后在此替换为 `Taro.request`，页面无需直接耦合请求协议。

`src/store/index.ts` 使用 Zustand；收藏、关注、足迹、草稿、模拟发布、反馈及最小商家申请信息保存在本机 Storage（key：`suanlishi:demo:v1`）。不是登录账号数据，不跨设备同步。足迹最多保留 100 条，反馈最多 50 条；清除小程序缓存将恢复示例状态。

发布 / 反馈图片在微信端保存为本地文件，仅供本机预览，没有上传服务器。入驻证件号码、电话与证件图片只在当前表单内使用，不写入申请记录。请使用测试资料和示例图片。正式产品仍需接入账户登录、文件上传、短信、后台审核、隐私说明、客服及正式协议。

资产评估按原型提供三步引导和 PC 地址 `https://gpunexus.com/zh/banking/provider/gpu-assets`，支持复制链接；微信分享指向可自动打开评估弹层的小程序首页。未在本次验证外部网站服务。客服及联系电话仍未接入。模拟提交明确提示“仅保存在本机”，不会声称已提交真实平台。

发布联系方式仅保存在本机草稿及本人的演示发布记录，供编辑回填；详情页面和收藏 / 足迹快照不展示该字段。原有 v1 存储键保持不变，旧草稿补齐新字段，旧成色和城市值会做兼容转换。

行情图使用 ECharts 模块化引入（折线、K 线、Grid、Tooltip、Canvas renderer）与微信 Canvas 2D 适配，数据按型号和周期稳定生成。需在微信开发者工具和真机上进一步验收图表触摸交互与不同机型的 Canvas 表现。

## 目录

```text
config/                 Taro 编译配置
src/pages/              16 个业务页面及页面配置
src/components/         通用 UI、图片选择、弹层、Canvas 图表
src/custom-tab-bar/     自定义底部导航
src/services/           接口契约、Mock 数据
src/store/              共享状态与本机持久化
src/types/              业务类型
src/utils/              搜索、筛选、校验、导航、图表数据
src/assets/             本地 PNG 图标和行情缩略图
scripts/check-config.cjs 离线 Taro 配置校验
tests/                  业务逻辑与模拟接口测试
```
