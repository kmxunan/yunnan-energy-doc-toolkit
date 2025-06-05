// public/js/home.js

// 确保 showToast 和 escapeHTML 函数已在 auth.js 或其他先加载的脚本中定义
// 如果没有，这里可以放一个简化的版本，但强烈建议统一管理API请求和辅助函数

if (typeof showToast !== 'function') {
    window.showToast = function(message, type = 'info', duration = 3000) {
        console.warn(`showToast not globally defined. Fallback: ${type} - ${message}`);
        alert(`${type.toUpperCase()}: ${message}`);
    }
}
if (typeof escapeHTML !== 'function') {
    window.escapeHTML = function(str) {
        if (str === null || str === undefined) return '';
        return String(str).replace(/[&<>"']/g, match => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[match]);
    }
}
// fetchAPI 函数应该由 auth.js 提供并全局可用。

document.addEventListener('DOMContentLoaded', async () => {
    const classificationFilter = document.getElementById('classificationFilter');
    const searchTermInput = document.getElementById('searchTerm');
    const sortBySelect = document.getElementById('sortBy');
    const sortOrderSelect = document.getElementById('sortOrder');
    const searchButton = document.getElementById('searchButton');

    if (classificationFilter) {
        // *** 确保调用的是 /api/classifications/public ***
        await loadClassifications(classificationFilter, '/api/classifications/public');
    } else {
        console.warn("分类筛选器 'classificationFilter' 未在DOM中找到。");
    }

    await fetchAndDisplayPublicDocuments();

    if (searchButton) {
        searchButton.addEventListener('click', fetchAndDisplayPublicDocuments);
    }
    if (classificationFilter) {
        classificationFilter.addEventListener('change', fetchAndDisplayPublicDocuments);
    }
    if (searchTermInput) {
        searchTermInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                fetchAndDisplayPublicDocuments();
            }
        });
    }
    if (sortBySelect) {
        sortBySelect.addEventListener('change', fetchAndDisplayPublicDocuments);
    }
    if (sortOrderSelect) {
        sortOrderSelect.addEventListener('change', fetchAndDisplayPublicDocuments);
    }
});

async function loadClassifications(selectElement, apiUrl) {
    if (!selectElement) {
        console.error("loadClassifications: selectElement 为空");
        return;
    }
    if (typeof fetchAPI !== 'function') {
        console.error('loadClassifications: fetchAPI is not defined. Ensure auth.js is loaded before home.js and defines fetchAPI globally.');
        showToast('页面初始化错误 (API)，请刷新或联系管理员。', 'error');
        return;
    }
    // console.log(`[home.js] loadClassifications called with apiUrl: ${apiUrl}`);
    try {
        const classifications = await fetchAPI(apiUrl, 'GET'); // 使用传入的 apiUrl
        // console.log('[home.js] Classifications received:', classifications);

        if (!classifications || !Array.isArray(classifications)) {
            console.error('加载分类数据格式不正确:', classifications);
            showToast('加载分类数据格式不正确，可能需要刷新页面。', 'error');
            return;
        }

        selectElement.innerHTML = '<option value="">所有分类</option>';
        classifications.forEach(classification => {
            const option = document.createElement('option');
            option.value = classification.id;
            option.textContent = escapeHTML(classification.name);
            selectElement.appendChild(option);
        });
    } catch (error) {
        console.error(`加载分类列表时出错 (URL: ${apiUrl}):`, error);
        showToast(`加载分类列表时出错: ${error.message}`, 'error');
    }
}

async function fetchAndDisplayPublicDocuments() {
    const classificationFilter = document.getElementById('classificationFilter');
    const searchTermInput = document.getElementById('searchTerm');
    const sortBySelect = document.getElementById('sortBy');
    const sortOrderSelect = document.getElementById('sortOrder');
    const documentsGrid = document.getElementById('documentsGrid');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const noResultsMessage = document.getElementById('noResultsMessage');

    if (!documentsGrid || !loadingIndicator || !noResultsMessage) {
        console.error('缺少必要的DOM元素 (documentsGrid, loadingIndicator, or noResultsMessage)。请检查HTML结构。');
        return;
    }
    if (typeof fetchAPI !== 'function') {
        console.error('fetchAndDisplayPublicDocuments: fetchAPI is not defined. Ensure auth.js is loaded before home.js and defines fetchAPI globally.');
        showToast('页面初始化错误 (API)，请刷新或联系管理员。', 'error');
        return;
    }

    loadingIndicator.classList.remove('d-none');
    documentsGrid.innerHTML = '';
    noResultsMessage.classList.add('d-none');

    const classificationId = classificationFilter ? classificationFilter.value : '';
    const searchTerm = searchTermInput ? searchTermInput.value.trim() : '';
    const sortBy = sortBySelect ? sortBySelect.value : 'upload_date';
    const sortOrder = sortOrderSelect ? sortOrderSelect.value : 'DESC';

    let apiUrl = `/api/documents/public?sortBy=${encodeURIComponent(sortBy)}&sortOrder=${encodeURIComponent(sortOrder)}`;
    if (classificationId) {
        apiUrl += `&classification_id=${encodeURIComponent(classificationId)}`;
    }
    if (searchTerm) {
        apiUrl += `&searchTerm=${encodeURIComponent(searchTerm)}`;
    }
    // console.log(`[home.js] fetchAndDisplayPublicDocuments called with apiUrl: ${apiUrl}`);

    try {
        const documents = await fetchAPI(apiUrl, 'GET');
        // console.log('[home.js] Documents received:', documents);

        if (!documents || !Array.isArray(documents)) {
            console.error('获取公开文档数据格式不正确:', documents);
            showToast('获取公开文档数据格式不正确，可能需要刷新页面。', 'error');
            documentsGrid.innerHTML = '<p class="text-danger">获取文档数据格式错误，请稍后再试。</p>';
            return;
        }

        if (documents.length === 0) {
            noResultsMessage.classList.remove('d-none');
        } else {
            documents.forEach(doc => {
                const cardElement = createDocumentCard(doc);
                const col = document.createElement('div');
                col.className = 'col';
                col.appendChild(cardElement);
                documentsGrid.appendChild(col);
            });
        }
    } catch (error) {
        console.error('获取或显示公开文档时出错:', error);
        showToast(`获取公开文档时出错: ${error.message}`, 'error');
        documentsGrid.innerHTML = `<div class="col-12 text-center"><p class="text-danger">加载文档失败，请稍后再试或联系管理员。</p></div>`;
    } finally {
        loadingIndicator.classList.add('d-none');
    }
}

function createDocumentCard(doc) {
    const card = document.createElement('div');
    card.className = 'card h-100 document-card shadow-sm';

    const thumbnailContainer = document.createElement('div');
    thumbnailContainer.className = 'card-img-top-container';

    if (doc.thumbnail_path) {
        const img = document.createElement('img');
        // 假设 thumbnail_path 已经是相对于 public 目录的正确路径，例如 'thumbnails/doc1.png'
        // 或者，如果它是存储在 /uploads/thumbnails/ 下，则应为 `/uploads/thumbnails/${escapeHTML(doc.thumbnail_path)}`
        // 根据您的实际文件结构调整此路径
        let imgSrc = doc.thumbnail_path;
        if (!imgSrc.startsWith('/') && !imgSrc.startsWith('http')) {
            imgSrc = `/${imgSrc}`; // 假设它应该是根相对路径
        }
        img.src = escapeHTML(imgSrc);
        img.alt = escapeHTML(doc.title);
        img.className = 'card-img-top';
        img.onerror = function() {
            this.parentElement.innerHTML = `<i class="bi bi-image-alt card-img-placeholder"></i>`;
        };
        thumbnailContainer.appendChild(img);
    } else {
        thumbnailContainer.innerHTML = `<i class="bi bi-image-alt card-img-placeholder"></i>`;
    }
    card.appendChild(thumbnailContainer);

    const cardBody = document.createElement('div');
    cardBody.className = 'card-body d-flex flex-column';

    const titleElement = doc.html_filename ?
        document.createElement('a') :
        document.createElement('h5');

    titleElement.className = `card-title fw-semibold mb-1 ${doc.html_filename ? 'text-decoration-none' : ''}`;
    titleElement.textContent = escapeHTML(doc.title) || '无标题文档';
    if (doc.html_filename) {
        // 假设HTML文件在 public/uploads/html/ 目录下
        titleElement.href = `/uploads/html/${escapeHTML(doc.html_filename)}`;
        titleElement.target = '_blank';
    }

    const infoContainer = document.createElement('div');
    infoContainer.className = 'mb-2 small text-muted';

    let infoHtml = '';
    if (doc.classification_name) {
        infoHtml += `<span class="badge bg-primary-subtle text-primary-emphasis me-2 mb-1">${escapeHTML(doc.classification_name)}</span>`;
    }
    const uploadDate = doc.upload_date ? new Date(doc.upload_date).toLocaleDateString('zh-CN') : '未知日期';
    infoHtml += `<span class="me-2 mb-1"><i class="bi bi-calendar3 me-1"></i>${uploadDate}</span>`;
    if (doc.author) {
        infoHtml += `<span class="mb-1"><i class="bi bi-person me-1"></i>${escapeHTML(doc.author)}</span>`;
    }
    infoContainer.innerHTML = infoHtml;

    const descriptionP = document.createElement('p');
    descriptionP.className = 'card-text small flex-grow-1';
    descriptionP.textContent = doc.description ? `${escapeHTML(doc.description.substring(0, 120))}...` : '暂无描述';
    descriptionP.title = doc.description || '';

    const keywordsDiv = document.createElement('div');
    keywordsDiv.className = 'mt-1 mb-3 small text-muted';
    keywordsDiv.innerHTML = doc.keywords ? `<i class="bi bi-tags me-1"></i>关键词: ${escapeHTML(doc.keywords)}` : '';

    cardBody.appendChild(titleElement);
    cardBody.appendChild(infoContainer);
    cardBody.appendChild(descriptionP);
    if (doc.keywords) cardBody.appendChild(keywordsDiv);

    const cardFooter = document.createElement('div');
    cardFooter.className = 'card-footer bg-transparent border-top-0 pt-0 mt-auto';

    if (doc.html_filename) {
        const previewLink = document.createElement('a');
        previewLink.href = `/uploads/html/${escapeHTML(doc.html_filename)}`;
        previewLink.target = '_blank';
        previewLink.className = 'btn btn-sm btn-outline-primary me-2';
        previewLink.innerHTML = '<i class="bi bi-eye me-1"></i>在线预览';
        cardFooter.appendChild(previewLink);
    }
    if (doc.id && doc.original_filename) {
        const downloadLink = document.createElement('a');
        downloadLink.href = `/api/documents/download/${doc.id}`;
        downloadLink.className = 'btn btn-sm btn-outline-success';
        downloadLink.innerHTML = '<i class="bi bi-download me-1"></i>下载原文';
        cardFooter.appendChild(downloadLink);
    }

    cardBody.appendChild(cardFooter);
    card.appendChild(cardBody);
    return card;
}
