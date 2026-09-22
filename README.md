# 百业AI工作台

一个参考“左侧创作工作台 + 右侧生成流程”形态实现的本地 AI 做图应用。当前接入了 `xjjuhe.site` 的 OpenAI 兼容图像接口，密钥只在 Node 服务端使用。

## 已完成

- 商品底图：参考图、尺寸、多场景批量生成
- 商品详情页：商品信息、卖点、多详情模块
- 海外电商：平台、地区、语言、主图/信息图/场景图等
- 设计海报：文字描述、参考图、海报模板
- 趣味玩法：3D 手办、动漫、粘土、油画、像素、杂志封面
- `gpt-image-2.5` / `gpt-image-2` / `nano_banana_2` 模型切换
- 异步任务轮询、进度、失败信息、超时保护和重试
- 本地草稿箱（仅保存参数与结果 URL，不保存用户原图）
- 桌面端与移动端响应式布局

图像类菜单已接入统一生图流程；视频生成、视频解析、商品解析和数字人入口会打开上游模型控制台。GitHub Pages 仅托管静态前端，无法运行 Node 接口代理；要让图像流程在公开网址真正生成图片，需要另行部署 `server/`。

## 本地启动

```bash
npm install
cp .env.example .env.local
# 编辑 .env.local，填写 XJJUHE_API_KEY
npm run dev
```

开发页面：`http://127.0.0.1:5173`

## 生产启动

```bash
npm run build
npm start
```

生产页面：`http://127.0.0.1:8787`

## GitHub Pages 静态部署

```bash
npm run build:pages
```

该命令会使用 `/my-website/` 作为静态资源根路径，并将结果生成到 `docs/`。GitHub Pages 只托管前端静态文件，不会运行 `server/` 中的 Node 接口代理。公开页面会明确显示“静态演示版”，而不会将密钥写入浏览器代码。

## 自检

```bash
npm run check
```

该命令会运行 Node 单元测试和 Vite 生产构建。

## 安全说明

- `.env.local` 已被 Git 忽略，不要将密钥改成 `VITE_*` 变量。
- 前端只访问本地 `/api/*`；第三方密钥只由 `server/image-api.js` 附加到上游请求。
- 参考图会在当次生成时传给图像接口，不会写入本地草稿。
- 上游结果 URL 可能有时效，请及时下载有价值的图片。
