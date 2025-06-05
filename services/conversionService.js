// services/conversionService.js
const fs = require('fs');
const path = require('path');

// 简单的 HTML 转义函数 (Node.js 环境)
function escapeHTMLNode(str) {
    if (str === null || str === undefined) {
        return '';
    }
    // 基本的转义，对于文件名和简单文本足够
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

const conversionService = {
    /**
     * 模拟将上传的文档转换为HTML。
     * @param {number} docId - 文档ID.
     * @param {string} uploadedFilePath - 上传文件在服务器上的完整临时路径 (例如 'uploads/original/xyz.pdf').
     * @param {string} storedOriginalFilename - 存储在数据库中的原始文件名 (例如 'report.pdf').
     * @returns {Promise<string|null>} 生成的HTML文件名 (例如 'xyz.html') 或 null (如果失败).
     */
    convertToHtml: async function(docId, uploadedFilePath, storedOriginalFilename) {
        // console.log(`[conversionService STUB V4] DocID: ${docId}, UploadedFilePath: ${uploadedFilePath}, StoredOriginalFilename: ${storedOriginalFilename}`);

        if (!uploadedFilePath || typeof uploadedFilePath !== 'string' || !fs.existsSync(uploadedFilePath)) {
            console.error(`[conversionService STUB V4] 错误: convertToHtml 缺少有效的 filePath 参数或文件不存在。收到的 filePath: ${uploadedFilePath}`);
            return null;
        }
        if (!storedOriginalFilename || typeof storedOriginalFilename !== 'string') {
            console.error(`[conversionService STUB V4] 错误: convertToHtml 缺少有效的 storedOriginalFilename 参数。收到的 storedOriginalFilename: ${storedOriginalFilename}`);
            return null;
        }

        const fileExtension = path.extname(uploadedFilePath).toLowerCase();
        const htmlDir = path.join(__dirname, '..', 'uploads', 'html'); // HTML文件存储目录

        if (!fs.existsSync(htmlDir)) {
            try {
                fs.mkdirSync(htmlDir, { recursive: true });
                // console.log(`[conversionService STUB V4] HTML 目录已创建: ${htmlDir}`);
            } catch (err) {
                console.error(`[conversionService STUB V4] 创建HTML目录 ${htmlDir} 失败:`, err);
                return null;
            }
        }

        // 使用上传时 multer 生成的唯一文件名 (stored_filename) 作为基础，以确保唯一性
        const baseOutputFilename = path.basename(uploadedFilePath, path.extname(uploadedFilePath));
        const htmlFilename = `${baseOutputFilename}.html`;
        const htmlOutputPath = path.join(htmlDir, htmlFilename);

        await new Promise(resolve => setTimeout(resolve, 150)); // 模拟处理延迟

        const titleForHtml = escapeHTMLNode(path.basename(storedOriginalFilename, path.extname(storedOriginalFilename)));

        let htmlContent = `
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${titleForHtml}</title>
          <style>
              body { font-family: sans-serif; line-height: 1.6; padding: 20px; margin: 0 auto; max-width: 800px; }
              h1 { color: #333; }
              p { color: #555; }
              .stub-info { background-color: #f0f0f0; border-left: 5px solid #007bff; padding: 10px; margin-top: 20px; }
          </style>
      </head>
      <body>
          <h1>${titleForHtml} (HTML 预览 - 存根内容)</h1>
          <div class="stub-info">
              <p>这是文档 ID <strong>${docId}</strong> 的模拟 HTML 转换结果。</p>
              <p>原始文件名: <strong>${escapeHTMLNode(storedOriginalFilename)}</strong></p>
              <p>服务器存储文件名 (用于生成此HTML): <strong>${escapeHTMLNode(path.basename(uploadedFilePath))}</strong></p>
              <p>文件类型: <strong>${fileExtension}</strong></p>
              <p><strong>注意:</strong> 此页面内容为自动生成的存根，并非实际文件内容。</p>
          </div>
      </body>
      </html>`;

        try {
            fs.writeFileSync(htmlOutputPath, htmlContent);
            // console.log(`[conversionService STUB V4] 模拟 HTML 转换已保存到: ${htmlOutputPath}`);
            return htmlFilename; // 返回相对于 'uploads/html' 的文件名
        } catch (error) {
            console.error(`[conversionService STUB V4] 写入存根 HTML 文件 ${htmlOutputPath} 失败:`, error);
            return null;
        }
    }
};

module.exports = conversionService;
