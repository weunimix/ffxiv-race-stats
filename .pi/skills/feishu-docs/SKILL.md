---
name: feishu-docs
description: >
  通过 MCP 读写飞书云文档。当运营要求查看、编辑、创建飞书文档/Wiki 时触发。
  触发词：飞书文档、飞书 Wiki、云文档、feishu、编辑文档、创建文档、文档内容。
---

# feishu-docs

飞书云文档的 MCP 操作指南。所有读写均通过 `feishu-docs` MCP server 完成。

---

## 核心概念

### 两种文档类型

| 类型 | `documentType` | URL 格式 | 说明 |
|------|---------------|---------|------|
| 普通文档 | `"document"` | `https://xxx.feishu.cn/docx/xxx` | 存在 Drive 文件夹中 |
| Wiki 文档 | `"wiki"` | `https://xxx.feishu.cn/wiki/xxx` | 存在知识库空间中 |

**关键差异：** Wiki 文档有两层 token —— `node_token`（节点 ID，URL 中可见）和 `obj_token`（实际文档 ID，不可见）。编辑操作必须用 `obj_token`。

### 获取文档 ID 的流程

对于 Wiki 链接（`/wiki/xxx`），URL 中的 token 是 `node_token`，**不能直接用于编辑**。必须先调用：

```json
// 第一步：获取文档信息，得到 obj_token
{
  "tool": "feishu_docs_get_feishu_document_info",
  "args": {
    "documentId": "<URL中的token>",
    "documentType": "wiki"
  }
}
// 返回中的 documentId / obj_token 才是编辑用的 ID
```

对于普通文档（`/docx/xxx`），URL 中的 token 就是 `documentId`，可以直接使用。

---

## MCP 工具速查

### 🔍 读取

| 工具 | 用途 | 关键参数 |
|------|------|---------|
| `get_feishu_document_info` | 获取文档元信息 | `documentId`, `documentType` |
| `get_feishu_document_blocks` | 获取文档全部 block 层级 | `documentId`, `documentType` |
| `search_feishu_documents` | 搜索文档 | `searchKey`, `searchType` |
| `get_feishu_root_folder_info` | 获取根目录/空间列表 | 无 |
| `get_feishu_folder_files` | 获取文件夹内容 | `folderToken` |
| `get_feishu_image_resource` | 下载图片 | `imageId`, `downloadTo` |

### ✏️ 写入

| 工具 | 用途 | 关键参数 |
|------|------|---------|
| `create_feishu_document` | 创建新文档 | `title`, `folderToken` 或 `wikiContext` |
| `batch_create_feishu_blocks` | 批量添加 blocks | `documentId`, `parentBlockId`, `index`, `blocks[]` |
| `batch_update_feishu_block_text` | 批量更新文本 | `documentId`, `updates[]` |
| `delete_feishu_document_blocks` | 删除 blocks | `documentId`, `parentBlockId`, `startIndex`, `endIndex` |
| `create_feishu_table` | 创建表格 | `documentId`, `parentBlockId`, `index`, `tableConfig` |
| `create_feishu_folder` | 创建文件夹 | `name`, `parentToken` |
| `upload_and_bind_image_to_block` | 上传图片并绑定 | `documentId`, `blockId`, `imageSource` |
| `fill_whiteboard_with_plantuml` | 白板绘图 | `documentId`, `whiteboardId`, `code` |

---

## 常见操作工作流

### 1. 读取 Wiki 文档内容

```
1. get_feishu_document_info(documentId=URL_TOKEN, documentType="wiki")
   → 获取 obj_token（即 documentId）、title
2. get_feishu_document_blocks(documentId=obj_token, documentType="wiki")
   → 获取 blocks[] 层级树
3. 解析 blocks：block_type=1 是页面标题，2=文本，3=标题，4=无序列表……
```

### 2. 在文档末尾追加文本

```
batch_create_feishu_blocks(
  documentId="<obj_token>",
  parentBlockId="<obj_token>",    ← 根级操作用文档 ID
  index=<children.length>,        ← 追加到末尾
  blocks=[{
    blockType: "text",
    options: {
      text: {
        textStyles: [{ text: "内容", style: {} }]
      }
    }
  }]
)
```

### 3. 更新已有 block 的文本

```
batch_update_feishu_block_text(
  documentId="<obj_token>",
  updates=[{
    blockId: "<block_id>",
    textElements: [{ text: "新内容", style: { bold: true } }]
  }]
)
```

### 4. 创建带内容的 Wiki 文档

```
create_feishu_document(
  title="文档标题",
  wikiContext: {
    spaceId: "<space_id>",            ← 从 get_feishu_root_folder_info 获取
    parentNodeToken: "<parent_token>"  ← 可选，指定父节点
  }
)
→ 返回 node_token 和 obj_token
→ 然后用 batch_create_feishu_blocks 填充内容
```

### 5. 在文档中插入标题

```
blocks: [{
  blockType: "heading",
  options: {
    heading: { level: 1, content: "一级标题" }
  }
}]
```

---

## ⚠️ 常见陷阱

1. **参数名是 `documentId`（camelCase），不是 `doc_token`、`doc_id` 或其他变体。**
2. **Wiki URL 的 token 是 node_token，不能用于编辑。** 必须先 `get_feishu_document_info` 拿到 `obj_token`。
3. **`parentBlockId` 用于根级操作时，用文档的 `documentId`（即 obj_token）。**
4. **index 从 0 开始，不包含标题 block。** 标题 block 不计入 children 的索引。
5. **文本样式用对象 `{bold: true}`，不用 Markdown 语法。**
6. **飞书文档 blocks 是树形结构。** 一个 block 可以有 children，需要用 `parentBlockId` 指定插入位置。

---

## Block 类型枚举

| `blockType` | `block_type`(数字) | 说明 |
|-------------|-------------------|------|
| - | 1 | 页面标题（根 block，不可删除） |
| `"text"` | 2 | 普通文本段落 |
| `"heading"` | 3 | 标题（level 1-9） |
| `"list"` | 4 | 无序列表 |
| `"list"` (ordered) | 5 | 有序列表 |
| `"code"` | 6 | 代码块 |
| - | 7 | 引用块 |
| `"image"` | 8 | 图片 |
| `"mermaid"` | - | Mermaid 图表 |
| `"whiteboard"` | - | 白板 |
