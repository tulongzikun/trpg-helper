# TRPG Helper

当前包含人物与怪物的数据契约，以及只读怪物图鉴的第一版。图鉴中的五个生物均为原创示例，动作需要人工裁定；图鉴不提供怪物编辑或战斗结算。

## 本地运行

需要 Node.js 及 pnpm。在项目根目录执行：

```sh
pnpm install --frozen-lockfile
pnpm dev
```

浏览终端显示的本地地址。`pnpm build` 构建生产版本，`pnpm test` 运行数据契约检查。怪物图鉴数据位于 `apps/web/src/data/monsters.json`，会在加载时通过 `packages/contracts/schemas/monster-entry.schema.json` 验证；不符合格式的条目会被跳过并显示错误。

搜索和筛选条件写入地址，便于复制和刷新后恢复。示例数据仅用于展示，规则包和数值不代表可自动运行的完整规则。
