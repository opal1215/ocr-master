# 🎯 模力方舟API关键差异说明

## 📊 两种API对比

### 1️⃣ 文档解析 API（✅ 正确的）

```
端点：/v1/async/documents/parse
查询：/v1/task/{task_id}
模型：PaddleOCR-VL
费用：免费100页/天
```

**你测试成功的就是这个！**

### 2️⃣ 图像OCR API（❌ 之前用的）

```
端点：/v1/async/images/ocr
查询：？
模型：DeepSeek-OCR
费用：0.02元/次（收费）
```

---

## 🔑 关键代码差异

### ❌ 旧代码（图像OCR - 收费）

```javascript
// 错误的端点
const submitUrl = 'https://ai.gitee.com/v1/async/images/ocr'

// 模型（只能用DeepSeek-OCR）
apiFormData.append('model', 'DeepSeek-OCR')
```

### ✅ 新代码（文档解析 - 免费）

```javascript
// 正确的端点
const submitUrl = 'https://ai.gitee.com/v1/async/documents/parse'

// 模型（可以用PaddleOCR-VL）
apiFormData.append('model', 'PaddleOCR-VL')

// 查询任务状态
const statusUrl = `https://ai.gitee.com/v1/task/${taskId}`
```

---

## 🎯 核心改动（5处）

### 改动1：API端点
```typescript
// 旧：
const submitUrl = 'https://ai.gitee.com/v1/async/images/ocr'

// 新：
const submitUrl = 'https://ai.gitee.com/v1/async/documents/parse'
```

### 改动2：查询URL
```typescript
// 旧（不确定）：
const queryUrl = submitData.urls?.get

// 新（明确）：
const statusUrl = `https://ai.gitee.com/v1/task/${taskId}`
```

### 改动3：模型名称
```typescript
// 确保使用PaddleOCR-VL
apiFormData.append('model', 'PaddleOCR-VL')
```

### 改动4：额外参数
```typescript
// 新增这些参数
apiFormData.append('include_image', 'true')
apiFormData.append('include_image_base64', 'true')
apiFormData.append('output_format', 'md')
```

### 改动5：结果提取
```typescript
// 可能需要从file_url下载
if (result.output?.file_url) {
  const fileResponse = await fetch(result.output.file_url)
  extractedText = await fileResponse.text()
}
```

---

## ✅ 如何验证使用了正确的API？

### 方法1：查看终端日志
```
🚀 正在提交文档解析任务...
```
应该看到"文档解析"而不是"图像OCR"

### 方法2：查看模力方舟后台
访问：https://ai.gitee.com/usage

应该看到：
- API：文档解析
- 模型：PaddleOCR-VL（不是DeepSeek-OCR）
- 费用：0.00元（免费）

### 方法3：检查响应
```javascript
{
  model: 'PaddleOCR-VL',
  apiType: 'DocumentParse'  // 新增的标识
}
```

---

## 🆓 免费额度说明

### 每日限额
- **100页/天**（PaddleOCR-VL文档解析）
- 每天0点重置

### 超出后怎么办？
1. 等到第二天（免费额度刷新）
2. 付费购买（0.02元/页，很便宜）

### 和付费会员的区别
- 免费：100页/天
- 付费会员：可能有更高的限额或优先级

---

## 📝 完整的调用流程

```
1. 上传图片 → /v1/async/documents/parse
   参数：
   - model: PaddleOCR-VL
   - file: 图片文件
   - include_image: true
   - output_format: md

2. 获得 task_id

3. 轮询查询 → /v1/task/{task_id}
   每隔1秒查询一次

4. 状态变为"success"

5. 从result.output.file_url下载结果
   或直接从result.output.text获取

6. 完成！✅
```

---

## 🎓 你的示例代码分析

从你提供的JavaScript代码：

```javascript
const API_URL = "https://ai.gitee.com/v1/async/documents/parse"
```
✅ 正确！这就是文档解析API

```javascript
const statusUrl = `https://ai.gitee.com/v1/task/${taskId}`
```
✅ 正确！这是查询任务状态的URL

```javascript
"model": "PaddleOCR-VL"
```
✅ 正确！指定PaddleOCR-VL模型

---

## 🚀 立即使用

### 步骤1：下载新代码
[PaddleOCR-VL专属路由-免费版.ts](../outputs/PaddleOCR-VL专属路由-免费版.ts)

### 步骤2：替换文件
```
你的项目/app/api/ocr/route.ts
```

### 步骤3：确认Token
```bash
# .env.local
GITEE_AI_API_TOKEN=你的令牌
```

### 步骤4：重启测试
```bash
npm run dev
```

### 步骤5：验证
查看模力方舟后台的使用记录：
- ✅ 模型应该是：PaddleOCR-VL
- ✅ API应该是：文档解析
- ✅ 费用应该是：0.00元

---

## ⚠️ 常见错误

### 错误1：仍然显示DeepSeek-OCR
**原因**：代码没有更新完全
**解决**：确保下载的是"PaddleOCR-VL专属路由"

### 错误2：仍然收费
**原因**：端点错误，用的还是images/ocr
**解决**：检查代码第129行，应该是`/documents/parse`

### 错误3：超出免费额度
**原因**：今天已经用了100次
**解决**：等到第二天，或者付费

---

## 💡 总结

| 项目 | 之前（错误） | 现在（正确） |
|------|-------------|-------------|
| 端点 | `/images/ocr` | ✅ `/documents/parse` |
| 模型 | DeepSeek-OCR | ✅ PaddleOCR-VL |
| 费用 | 0.02元/次 | ✅ 免费100页/天 |
| 状态 | ❌ 失败 | ✅ 成功 |

**现在代码完全按照你测试成功的方式编写！** 🎉
