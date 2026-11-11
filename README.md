# TRPG Helper

当前包含人物与怪物的数据契约，以及只读怪物图鉴。未导入外部数据时显示五个原创示例；导入后也可以查看本地的外部数据。动作需要人工裁定；图鉴不提供怪物编辑或战斗结算。

## 本地运行

需要 Node.js 及 pnpm。在项目根目录执行：

```sh
pnpm install --frozen-lockfile
pnpm dev
```

浏览终端显示的本地地址。`pnpm build` 构建生产版本，`pnpm test` 运行数据契约检查。怪物图鉴数据位于 `apps/web/src/data/monsters.json`，会在加载时通过 `packages/contracts/schemas/monster-entry.schema.json` 验证；不符合格式的条目会被跳过并显示错误。

搜索和筛选条件写入地址，便于复制和刷新后恢复。示例数据仅用于展示，规则包和数值不代表可自动运行的完整规则。

## 导入参考站点数据

运行 `pnpm import:monsters`，脚本检查参考站点《怪物图鉴2025》的目录，将识别的数据卡保存到 `apps/web/src/data/imported-monsters.json`，并生成 `import-report.json`。这两个文件只保存在本地，不纳入 Git；分享或发布数据前需确认来源、译文及相关内容的使用权限。运行期间需要网络连接，日常使用图鉴则读取本地数据。

导入脚本位于 `scripts/import-monsters.cjs`。抓取或基础字段校验发生错误时，脚本写入报告但不覆盖已有数据。页面上可查看原始数据卡文本和来源链接。自动解析可能遗漏条件、动作结构或家族级的栖息地；应以来源为准，所有能力均标记为人工裁定，不能用作自动战斗结算。
