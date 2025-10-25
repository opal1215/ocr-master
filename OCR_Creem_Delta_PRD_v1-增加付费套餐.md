# OCR 微付费闭环（增量版）PRD & 定价页文案草稿
**版本**：v1.0  
**日期**：2025-10-24 13:30  
**适用对象**：开发（Codex）、产品、运营

---

## 0. 背景 & 目标（Delta 说明）
- **已具备**：Google 登录；每账户 3 次免费试用；数据库基础；TXT/MD/HTML 导出；PaddleOCR‑VL 推理管线。
- **本次仅做增量**：
  1) 新增 **CSV / JSON** 导出；
  2) 接入 **Creem 支付**（微套餐为主）；
  3) **积分=页数** 扣费与 **24h 同文档免二扣**；
  4) 最小前端改动（余额条、购买弹窗、导出面板选项）。
- **硬性约束**：
  - 必须使用 **Creem** 完成支付闭环；
  - **利润 ≥ 10×**（已知成本：≈¥0.02/页 ≈ $0.00274/page；定价需 ≥ $0.03/页）；
  - 不采用超低价订阅（如 $1/$4）方案。

**MVP 成功指标（上线 30 天）**
- 试用转化率 ≥ 6%（免费 → 购买微套餐）；
- 退款率 < 2%；
- 平均首字节时间（导出命中缓存） < 2s。

---

## 1. 用户故事（精简）
- 作为学生/研究者，我把 PDF 上传后，需要一键导出 **CSV/JSON** 以做分析/写脚本。
- 作为个人开发者，我**不想订阅**，希望**小额一次性**购买 10 页/100 页即可。
- 作为轻度用户，当余额不足时，我希望**一键跳转支付**并回到导出页继续下载。

---

## 2. 定价 & 产品目录（符合 ≥10× 利润）
**计量**：1 页 = 1 积分（导出按文档页数扣费，首次成功导出后 24h 内同一文档任意格式不再扣费）。

### 2.1 微套餐（MVP 主推）
| SKU | Pages | Price | Unit |
|---|---:|---:|---:|
| MICRO_10 | 10 | $0.50 | $0.05/page |
| VALUE_100 | 100 | $3.00 | $0.03/page |
| PRO_500 | 500 | $15.00 | $0.03/page |

> 说明：全部 ≥$0.03/页；满足 ≥10× 利润目标。

### 2.2 （可选）订阅（仅当需要稳定现金流时）
| SKU | Monthly Pages | Price | Unit |
|---|---:|---:|---:|
| SUB_300 | 300/mo | $9 | $0.03/page |
| SUB_1000 | 1000/mo | $30 | $0.03/page |

> 备注：如不需要订阅，直接不在前端展示，仅保留数据库/后台占位即可。

### 2.3 Creem 商品映射
- 为以上 3–5 个 SKU 在 Creem 后台创建对应商品，记录 `creem_product_id`。
- 上线前将 `creem_product_id` 写入 `products` 表或配置文件。

---

## 3. 数据模型（Supabase）
新增/变更以下表：
- `products`：`id`, `sku`, `name`, `type` (`pack|subscription`), `pages` (int), `price_cents` (int), `currency` (`USD`), `creem_product_id`, `active` (bool)
- `orders`：`id`, `user_id`, `product_id`, `creem_checkout_id`, `amount_cents`, `currency`, `status` (`pending|completed|failed`), `created_at`
- `credits`：`user_id`, `balance` (int, default 0)
- `credit_ledger`：`id`, `user_id`, `delta` (int, +购入/-扣费), `reason` (`purchase|export|adjust`), `ref_order_id`, `created_at`
- `exports`：`id`, `user_id`, `doc_hash`, `pages`, `consumed` (bool), `cache_expire_at`, `created_at`

**索引**：`orders.status`、`credits.user_id`、`exports(user_id,doc_hash)`。  
**事务**：所有写入与扣费均包事务；`/api/verify` 幂等。

---

## 4. 环境变量
```bash
CREEM_API_KEY=...
CREEM_API_BASE=https://test-api.creem.io    # 上线切为正式域名
APP_BASE_URL=https://yourdomain.com
CREEM_MODE=test                              # test|live
```

---

## 5. 端到端流程（时序）
1. 用户上传 → 生成 `doc_hash`（sha256 文件内容）。
2. 进入导出面板选择格式（含 **CSV/JSON**）。
3. **计费点**：
   - 若命中 `exports(user_id, doc_hash)` 且 `cache_expire_at` 未过期 → 本次**不扣费**；
   - 否则：
     - 若在免费 3 页额度内 → 按现有逻辑扣试用；
     - 否则：尝试扣积分 → 余额不足则弹出购买。
4. 购买：前端 `POST /api/checkout` → 服务端创建 Creem checkout → 返回 `checkout_url` → 跳转支付。
5. 成功回跳 `GET /billing/success?checkout_id=...` → 前端调用 `GET /api/verify` → 服务端向 Creem 查询 → 成功则加积分、落订单、记账。
6. 回到导出，首次导出成功即写 `exports`（24h TTL）。

---

## 6. 后端接口（Next.js App Router 示例）
### 6.1 `POST /api/checkout`
- **入参**：`product_id`（或 `sku`）
- **流程**：服务端用 `x-api-key` 调 Creem 创建 checkout（`success_url=${APP_BASE_URL}/billing/success`）；写 `orders(pending)`；返回 `checkout_url`。
- **返回**：`{ checkout_url }`
- **错误**：`4xx`，并记录错误原因。

### 6.2 `GET /api/verify?checkout_id=...`
- **流程**：查询 Creem checkout；`status==="completed"` 时开启事务：
  1) `orders → completed`；
  2) 给 `credits.balance += product.pages`；
  3) 写 `credit_ledger(+delta)`；
- **幂等**：重复请求不可重复加分。
- **返回**：`{ ok:true, balance }` 或 `409 NOT_COMPLETED`。

### 6.3 计费工具 `chargeForDoc(userId, docHash, pages)`
- 若 24h 缓存存在 → `charged:false`；
- 否则在事务内扣余额、记 `credit_ledger(-delta)`、写/更新 `exports`（TTL=24h）。

---

## 7. 导出规范（CSV / JSON）
### 7.1 CSV（RFC 4180）
- 分隔符`,`；换行 `\r\n`；UTF‑8（无 BOM）。
- 含逗号/引号/换行的字段：整字段双引号包裹，内部 `"` → `""`。
- **列**：
  - `page`（int）
  - `block_type`（`text|table|equation|figure`）
  - `bbox`（`x1,y1,x2,y2`）
  - `content`（字符串；表格见下）
  - `table_row_index`（int?）
  - `table_col_index`（int?）
- **表格两模式**：
  - **A** 单元格逐行（默认）：每个 cell 输出一行，并写入行/列索引；
  - **B** 整表 JSON 字符串：完整表格以 JSON 序列化后存入 `content`。
- **验收**：Excel/Sheets 打开不串列；含逗号/换行段落列对齐。

### 7.2 JSON（机器消费）
- 顶层：
  - `meta`: `{ doc_hash, page_count, created_at }`
  - `pages`: `[{ page_no, width, height, blocks }]`
- `block`：`type`、`bbox`、`text`（当 type=text）、`table.rows`（二维数组）、`latex`、`caption`（可选）。
- **选项**：`includeBBox`（默认 true）。
- **验收**：提供 JSON Schema；导出结果通过校验；下游 `JSON.parse` 可直接使用。

---

## 8. 前端改动（最小）
- **BalanceBar**（顶部）：显示余额、按钮“Recharge”。
- **PurchaseModal**：列出 3 个套餐（10/$0.5、100/$3、500/$15），点击即 `POST /api/checkout` → 跳 `checkout_url`。
- **ExportPanel**：新增 **CSV/JSON**；CSV 模式 A/B 切换；JSON 的 `includeBBox/latex` 勾选。
- **/billing/success**：读取 `checkout_id`；调用 `/api/verify`；展示“到账 + 新余额 + 返回继续导出”。

---

## 9. 非功能 & 安全
- Creem API Key 仅服务端可见；所有支付/加分逻辑在服务端完成。
- 删除功能：用户可一键删除已上传文档与导出记录。
- 监控：Creem 接口失败率 > 2%/5min 告警；`/api/verify` 错误 > 5 次/小时告警。

---

## 10. 测试计划
- **单元测试**：
  - CSV：转义（逗号/引号/换行）、空表/大表；
  - JSON：Schema 校验、极长文本、混合 block。
- **集成测试**：
  - `POST /api/checkout` 成功返回 URL；失败路径。
  - `GET /api/verify` 幂等性（重复调用不重复加分）。
- **E2E（Playwright）**：
  1) 上传 3 页 → 用免费额度导出；
  2) 余额不足 → 弹出购买 → 购买 10 页（test 模式）→ 回跳成功页 `/api/verify` → 余额 +10；
  3) 同一文档 24h 内重复导出任意格式不再扣分；
  4) 新文档导出正常扣分。

---

## 11. 里程碑 & 交付
- **D1–D2**：建表与种子数据（3 套餐 SKU）；导出模块（CSV/JSON）；
- **D3**：Creem 接入（checkout/verify）；
- **D4**：前端（余额条/购买弹窗/导出面板）；
- **D5**：联调与 E2E；
- **D6**：灰度上线（test→live）。

---

## 12. 定价页文案（草稿）
**标题**：超高精度 OCR，一次就对。  
**副标题**：TXT / MD / HTML / CSV / JSON 一键导出。隐私友好，零门槛上手。

**价格**
- Free：3 页试用
- Micro Pack：10 页 $0.5（一次性）
- Value Pack：100 页 $3
- Pro Pack：500 页 $15

**常见问题**
- **CSV/JSON 有什么用？** CSV 适合表格分析；JSON 适合自动化脚本。
- **会重复扣费吗？** 同一文档 24h 内任意格式不重复扣费。
- **我的数据安全吗？** 文件仅用于输出，不做训练；可一键删除。

---

## 13. 给 Codex 的实施要点（摘要）
- 新建 `lib/exporters/csv.ts`、`lib/exporters/json.ts`；集中导出入口 `lib/exporters/index.ts`，对接现有导出控制器。
- 计费工具 `chargeForDoc(userId, docHash, pages)`：实现 24h 免二扣。
- Creem 封装 `lib/creem.ts`：`createCheckout`、`getCheckoutStatus`；新增 `/api/checkout` 与 `/api/verify`。
- 前端：`BalanceBar`、`PurchaseModal`、`ExportPanel`（新增 CSV/JSON 与选项）、`/billing/success`。
- 测试：单测 CSV/JSON；集成支付；E2E 串全链路。
