// public/js/admin_documents.js

const AdminDocuments = {
    isInitialized: false,
    isUploadFormInitialized: false,
    documents: [],

    init: function() {
        // console.log("AdminDocuments: Attempting to initialize document management (listing)...");
        if (this.isInitialized && document.getElementById('adminDocumentsTableBody')) {
            // console.log("AdminDocuments: Already initialized for listing. Refreshing documents.");
            this.loadDocuments();
            return;
        }

        this.adminSearchTerm = document.getElementById('adminSearchTerm');
        this.adminClassificationFilter = document.getElementById('adminClassificationFilter');
        this.adminSortBy = document.getElementById('adminSortBy');
        this.adminSortOrder = document.getElementById('adminSortOrder');
        this.adminSearchButton = document.getElementById('adminSearchButton');
        this.adminDocumentsTableBody = document.getElementById('adminDocumentsTableBody');
        this.adminDocLoadingIndicator = document.getElementById('adminDocLoadingIndicator');
        this.adminDocNoResults = document.getElementById('adminDocNoResults');

        if (!this.adminDocumentsTableBody || !this.adminDocLoadingIndicator || !this.adminDocNoResults) {
            console.error('AdminDocuments init: One or more DOM elements for document listing are missing. Cannot initialize listing.');
            this.isInitialized = false;
            return;
        }
        // console.log("AdminDocuments: Listing DOM elements found.");

        if (this.adminSearchButton) this.adminSearchButton.addEventListener('click', () => this.loadDocuments());
        if (this.adminSearchTerm) this.adminSearchTerm.addEventListener('keypress', (e) => { if (e.key === 'Enter') this.loadDocuments(); });
        if (this.adminClassificationFilter) this.adminClassificationFilter.addEventListener('change', () => this.loadDocuments());
        if (this.adminSortBy) this.adminSortBy.addEventListener('change', () => this.loadDocuments());
        if (this.adminSortOrder) this.adminSortOrder.addEventListener('change', () => this.loadDocuments());

        this.loadClassificationsForAdminFilter();
        this.loadDocuments();
        this.isInitialized = true;
        // console.log("AdminDocuments: Listing initialized successfully.");
    },

    initUploadForm: function() {
        // console.log("AdminDocuments: Attempting to initialize document upload form...");
        if (this.isUploadFormInitialized && document.getElementById('uploadDocumentForm')) {
            // console.log("AdminDocuments: Upload form already initialized. Refreshing classifications.");
            this.loadClassificationsForUploadForm();
            return;
        }

        this.uploadForm = document.getElementById('uploadDocumentForm');
        this.docTitleInput = document.getElementById('docTitle');
        this.documentFileInput = document.getElementById('documentFile');
        this.docClassificationSelect = document.getElementById('docClassification');
        this.uploadStatusDiv = document.getElementById('uploadStatus');

        if (!this.uploadForm || !this.docTitleInput || !this.documentFileInput || !this.docClassificationSelect || !this.uploadStatusDiv) {
            console.error('AdminDocuments initUploadForm: One or more DOM elements for the upload form are missing. Cannot initialize.');
            this.isUploadFormInitialized = false;
            return;
        }
        // console.log("AdminDocuments: Upload form DOM elements found.");

        this.uploadForm.addEventListener('submit', (e) => this.handleDocumentUpload(e));

        if (this.documentFileInput && this.docTitleInput) {
            this.documentFileInput.addEventListener('change', (event) => {
                const file = event.target.files[0];
                if (file && this.docTitleInput.value.trim() === '') {
                    let filenameWithoutExt = file.name.replace(/\.(pdf|docx?|txt|md|html?)$/i, '');
                    filenameWithoutExt = filenameWithoutExt.replace(/[_-]/g, ' ');
                    this.docTitleInput.value = filenameWithoutExt;
                }
            });
        }

        this.loadClassificationsForUploadForm();
        this.isUploadFormInitialized = true;
        // console.log("AdminDocuments: Upload form initialized successfully.");
    },

    loadClassificationsForAdminFilter: async function() {
        if (!this.adminClassificationFilter) {
            // console.log("[AdminDocuments] Admin classification filter element not found for admin filter.");
            return;
        }
        try {
            const classifications = await fetchAPI('/api/classifications/public', 'GET');
            this.adminClassificationFilter.innerHTML = '<option value="">所有分类</option>';
            if (classifications && Array.isArray(classifications)) {
                classifications.forEach(c => {
                    const option = document.createElement('option');
                    option.value = c.id;
                    option.textContent = window.escapeHTML(c.name);
                    this.adminClassificationFilter.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error loading classifications for admin filter:', error);
            if (typeof window.showToast === 'function') window.showToast('加载分类筛选失败: ' + error.message, 'error');
        }
    },

    loadClassificationsForUploadForm: async function() {
        if (!this.docClassificationSelect) {
            // console.log("[AdminDocuments] Document classification select for upload form not found.");
            return;
        }
        try {
            const classifications = await fetchAPI('/api/classifications/public', 'GET');
            this.docClassificationSelect.innerHTML = '<option value="">未分类</option>';
            if (classifications && Array.isArray(classifications)) {
                classifications.forEach(c => {
                    const option = document.createElement('option');
                    option.value = c.id;
                    option.textContent = window.escapeHTML(c.name);
                    this.docClassificationSelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error loading classifications for upload form:', error);
            if (typeof window.showToast === 'function') window.showToast('加载文档分类选项失败: ' + error.message, 'error');
        }
    },

    loadDocuments: async function() {
        if (!this.adminDocumentsTableBody || !this.adminDocLoadingIndicator || !this.adminDocNoResults) {
            console.error("AdminDocuments: Table body or indicators not ready for loadDocuments.");
            return;
        }
        this.adminDocLoadingIndicator.classList.remove('d-none');
        this.adminDocumentsTableBody.innerHTML = '';
        this.adminDocNoResults.classList.add('d-none');

        const searchTerm = this.adminSearchTerm ? this.adminSearchTerm.value : '';
        const classificationId = this.adminClassificationFilter ? this.adminClassificationFilter.value : '';
        const sortBy = this.adminSortBy ? this.adminSortBy.value : 'upload_date';
        const sortOrder = this.adminSortOrder ? this.adminSortOrder.value : 'DESC';

        let apiUrl = `/api/documents/admin?sortBy=${sortBy}&sortOrder=${sortOrder}`;
        if (searchTerm) apiUrl += `&searchTerm=${encodeURIComponent(searchTerm)}`;
        if (classificationId) apiUrl += `&classification_id=${classificationId}`;

        try {
            // console.log(`[AdminDocuments] Fetching admin documents from: ${apiUrl}`);
            const documents = await fetchAPI(apiUrl, 'GET');
            this.documents = documents;
            // console.log('[AdminDocuments] Documents received for admin list (count):', this.documents ? this.documents.length : 'null/undefined');
            // if(this.documents && this.documents.length > 0) console.log('[AdminDocuments] First document sample:', JSON.stringify(this.documents[0]));


            if (!Array.isArray(this.documents)) {
                console.error("AdminDocuments: Expected an array of documents, got:", this.documents);
                this.adminDocNoResults.textContent = '加载文档数据格式错误。';
                this.adminDocNoResults.classList.remove('d-none');
                return;
            }

            if (this.documents.length === 0) {
                this.adminDocNoResults.textContent = '未找到符合条件的文档。';
                this.adminDocNoResults.classList.remove('d-none');
            } else {
                this.documents.forEach(doc => this.renderDocumentRow(doc));
            }
        } catch (error) {
            console.error('Error loading admin documents:', error);
            this.adminDocNoResults.textContent = `加载文档列表失败: ${error.message}`;
            this.adminDocNoResults.classList.remove('d-none');
            if (typeof window.showToast === 'function') window.showToast(`加载文档列表失败: ${error.message}`, 'error');
        } finally {
            this.adminDocLoadingIndicator.classList.add('d-none');
        }
    },

    renderDocumentRow: function(doc) {
        if (!this.adminDocumentsTableBody) {
            console.error("AdminDocuments renderDocumentRow: adminDocumentsTableBody is null.");
            return;
        }
        if (!doc || typeof doc !== 'object') {
            console.error("AdminDocuments renderDocumentRow: Invalid document object provided.", doc);
            return;
        }

        const row = this.adminDocumentsTableBody.insertRow();
        row.insertCell().textContent = doc.id;

        const titleCell = row.insertCell();
        // **关键修改：仅当 is_html_converted 为 1 (true) 且 html_filename 存在时才创建链接**
        if (doc.is_html_converted === 1 && doc.html_filename) {
            const link = document.createElement('a');
            link.href = `/uploads/html/${window.escapeHTML(doc.html_filename)}`; // 确保路径正确
            link.textContent = window.escapeHTML(doc.title) || '无标题';
            link.target = '_blank';
            titleCell.appendChild(link);
        } else {
            titleCell.textContent = window.escapeHTML(doc.title) || '无标题';
            if (doc.is_html_converted === 0 && doc.original_filename) {
                const convertingBadge = document.createElement('span');
                convertingBadge.className = 'badge bg-info-subtle text-info-emphasis ms-2'; // Using Bootstrap 5.3 subtle badges
                convertingBadge.textContent = '处理中';
                titleCell.appendChild(convertingBadge);
            } else if (doc.is_html_converted === 1 && !doc.html_filename) {
                const errorBadge = document.createElement('span');
                errorBadge.className = 'badge bg-warning-subtle text-warning-emphasis ms-2';
                errorBadge.textContent = '转换信息缺失';
                titleCell.appendChild(errorBadge);
            }
        }
        if (doc.is_deleted) {
            const deletedBadge = document.createElement('span');
            deletedBadge.className = 'badge bg-danger-subtle text-danger-emphasis ms-2';
            deletedBadge.textContent = '已删除';
            titleCell.appendChild(deletedBadge);
        }

        row.insertCell().textContent = doc.uploader_name || 'N/A';
        row.insertCell().textContent = doc.classification_name || '未分类';
        row.insertCell().textContent = doc.upload_date ? new Date(doc.upload_date).toLocaleDateString() : 'N/A';

        const publicCell = row.insertCell();
        publicCell.className = 'text-center';
        publicCell.innerHTML = doc.is_public ? '<i class="bi bi-check-circle-fill text-success" title="是"></i>' : '<i class="bi bi-x-circle-fill text-muted" title="否"></i>';

        const convertedCell = row.insertCell();
        convertedCell.className = 'text-center';
        convertedCell.innerHTML = doc.is_html_converted ? '<i class="bi bi-check-circle-fill text-success" title="是"></i>' : '<i class="bi bi-hourglass-split text-warning" title="否/处理中"></i>';

        const actionsCell = row.insertCell();
        actionsCell.className = 'text-center';
        // 简化按钮，确保 onclick 事件能正确找到 AdminDocuments 对象
        actionsCell.innerHTML = `
            <button class="btn btn-sm btn-outline-primary btn-sm-custom me-1" onclick="window.AdminDocuments.editDocument(${doc.id})" title="编辑元数据"><i class="bi bi-pencil-square"></i></button>
            <a href="/api/documents/download/${doc.id}" class="btn btn-sm btn-outline-success btn-sm-custom me-1" title="下载原文"><i class="bi bi-download"></i></a>
            ${doc.is_deleted ?
            `<button class="btn btn-sm btn-outline-warning btn-sm-custom me-1" onclick="window.AdminDocuments.restoreDocument(${doc.id})" title="恢复文档"><i class="bi bi-arrow-counterclockwise"></i></button>
                 <button class="btn btn-sm btn-danger btn-sm-custom" onclick="window.AdminDocuments.deleteDocumentPermanently(${doc.id})" title="永久删除"><i class="bi bi-trash3-fill"></i></button>` :
            `<button class="btn btn-sm btn-outline-danger btn-sm-custom" onclick="window.AdminDocuments.deleteDocumentSoft(${doc.id})" title="移至回收站"><i class="bi bi-trash"></i></button>`
        }
        `;
    },

    handleDocumentUpload: async function(event) {
        event.preventDefault();
        if (!this.uploadForm || !this.uploadStatusDiv) {
            console.error("AdminDocuments handleDocumentUpload: Upload form or status div not found.");
            return;
        }

        const formData = new FormData(this.uploadForm);
        const submitButton = this.uploadForm.querySelector('button[type="submit"]');
        const originalButtonHTML = submitButton.innerHTML; // Store full HTML for icon
        submitButton.disabled = true;
        submitButton.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 上传中...`;
        this.uploadStatusDiv.innerHTML = `<div class="alert alert-info small p-2">文件上传中，请稍候...</div>`;

        try {
            // console.log("[AdminDocuments] Attempting to upload document...");
            const response = await fetchAPI('/api/documents/upload', 'POST', formData, true);
            // console.log("[AdminDocuments] Upload API response:", response);

            if (response && response.message && response.document && response.document.id) {
                if (typeof window.showToast === 'function') window.showToast(response.message || '文档上传请求已接受。', 'success');
                this.uploadStatusDiv.innerHTML = `<div class="alert alert-success small p-2">${window.escapeHTML(response.message)} 后台转换和缩略图生成可能需要一些时间。</div>`;
                this.uploadForm.reset();

                // **上传成功后，如果当前在文档管理列表，则刷新列表**
                // currentAdminSectionId is a global in admin_main.js
                if (typeof currentAdminSectionId !== 'undefined' && currentAdminSectionId === 'documentManagementSection') {
                    // console.log("[AdminDocuments] Upload successful, refreshing document list as it's the current section.");
                    // setTimeout(() => this.loadDocuments(), 1000); // 短暂延迟以等待后台初步处理
                    this.loadDocuments(); // 直接刷新
                } else {
                    // console.log("[AdminDocuments] Upload successful. Document list not current view, will refresh on next visit.");
                }
                if (typeof window.showToast === 'function') {
                    window.showToast('后台处理完成后，文档列表将更新。', 'info', 5000);
                }
            } else {
                console.error("[AdminDocuments] Upload API response invalid:", response);
                throw new Error("上传成功，但服务器返回数据格式不正确。");
            }

        } catch (error) {
            console.error('Error uploading document:', error);
            const errorMessage = error.message || '上传失败，请检查文件或联系管理员。';
            if (typeof window.showToast === 'function') window.showToast(errorMessage, 'error');
            this.uploadStatusDiv.innerHTML = `<div class="alert alert-danger small p-2">${window.escapeHTML(errorMessage)}</div>`;
        } finally {
            submitButton.disabled = false;
            submitButton.innerHTML = originalButtonHTML;
        }
    },

    editDocument: function(docId) {
        // console.log(`Editing document ID: ${docId}`);
        const doc = this.documents.find(d => d.id === docId);
        if (!doc) {
            if(typeof window.showToast === 'function') window.showToast('未找到要编辑的文档信息。', 'error');
            return;
        }

        // 确保上传表单模块已初始化并显示
        if (typeof showAdminSection === 'function') {
            showAdminSection('documentUploadSection');
        } else {
            console.error("showAdminSection function not available to switch view for editing.");
            return;
        }

        // 延迟一小段时间以确保 section 切换完成，DOM元素可用
        setTimeout(() => {
            const titleInput = document.getElementById('docTitle');
            const descriptionInput = document.getElementById('docDescription');
            const keywordsInput = document.getElementById('docKeywords');
            const authorInput = document.getElementById('docAuthor');
            const classificationSelect = document.getElementById('docClassification');
            const isPublicCheckbox = document.getElementById('docIsPublic');
            const uploadForm = document.getElementById('uploadDocumentForm'); // 确保这是上传表单的正确ID
            const documentFileInput = document.getElementById('documentFile');

            if (!uploadForm || !titleInput) {
                console.error("EditDocument: Upload form elements not found after switching section.");
                if(typeof window.showToast === 'function') window.showToast('无法加载编辑表单。', 'error');
                return;
            }

            if (titleInput) titleInput.value = doc.title || '';
            if (descriptionInput) descriptionInput.value = doc.description || '';
            if (keywordsInput) keywordsInput.value = doc.keywords || '';
            if (authorInput) authorInput.value = doc.author || '';
            if (classificationSelect) classificationSelect.value = doc.classification_id || '';
            if (isPublicCheckbox) isPublicCheckbox.checked = !!doc.is_public;

            // 禁用文件输入，因为我们不通过此表单替换文件
            if(documentFileInput) {
                documentFileInput.disabled = true;
                documentFileInput.required = false; // Not required for metadata update
                const fileLabel = document.querySelector('label[for="documentFile"]');
                if (fileLabel) fileLabel.innerHTML = '文件 (如需替换，请删除后重新上传)';
            }


            let docIdField = uploadForm.querySelector('input[name="documentId"]');
            if (!docIdField) {
                docIdField = document.createElement('input');
                docIdField.type = 'hidden';
                docIdField.name = 'documentId';
                uploadForm.appendChild(docIdField);
            }
            docIdField.value = docId;

            const submitButton = uploadForm.querySelector('button[type="submit"]');
            if (submitButton) {
                submitButton.innerHTML = '<i class="bi bi-save me-2"></i>更新文档信息';
                // 更改表单的 onsubmit 行为或添加新的更新按钮
                // For now, handleDocumentUpload will need to check for documentId
            }

            if(typeof window.showToast === 'function') window.showToast(`编辑文档: "${window.escapeHTML(doc.title)}" (仅元数据)`, 'info');
            // alert("注意：当前编辑功能仅支持修改文档的元数据。如需替换文件，请删除原文档后重新上传。");
        }, 100); // 100ms delay
    },

    deleteDocumentSoft: async function(docId) {
        if (!confirm(`确定要将ID为 ${docId} 的文档移至回收站吗？`)) return;
        try {
            const response = await fetchAPI(`/api/documents/${docId}`, 'DELETE');
            if(typeof window.showToast === 'function') window.showToast(response.message || '文档已移至回收站。', 'success');
            this.loadDocuments();
        } catch (error) {
            console.error(`Error soft deleting document ${docId}:`, error);
            if(typeof window.showToast === 'function') window.showToast(`删除失败: ${error.message}`, 'error');
        }
    },

    restoreDocument: async function(docId) {
        if (!confirm(`确定要恢复ID为 ${docId} 的文档吗？`)) return;
        try {
            const response = await fetchAPI(`/api/documents/${docId}/restore`, 'POST');
            if(typeof window.showToast === 'function') window.showToast(response.message || '文档已恢复。', 'success');
            this.loadDocuments();
        } catch (error) {
            console.error(`Error restoring document ${docId}:`, error);
            if(typeof window.showToast === 'function') window.showToast(`恢复失败: ${error.message}`, 'error');
        }
    },

    deleteDocumentPermanently: async function(docId) {
        if (!confirm(`警告：这将永久删除ID为 ${docId} 的文档及其所有关联文件，此操作无法撤销！确定要继续吗？`)) return;
        if (!confirm(`再次确认：您确定要永久删除此文档吗？`)) return;

        try {
            const response = await fetchAPI(`/api/documents/${docId}/permanent`, 'DELETE');
            if(typeof window.showToast === 'function') window.showToast(response.message || '文档已永久删除。', 'success');
            this.loadDocuments();
        } catch (error) {
            console.error(`Error permanently deleting document ${docId}:`, error);
            if(typeof window.showToast === 'function') window.showToast(`永久删除失败: ${error.message}`, 'error');
        }
    },

    clearTable: function() {
        if (this.adminDocumentsTableBody) this.adminDocumentsTableBody.innerHTML = '';
        this.documents = [];
        this.isInitialized = false; // Allow re-initialization if table is cleared (e.g., on logout)
        // console.log("AdminDocuments: Table cleared and marked as not initialized.");
    },
    getDocumentsCount: function() {
        return this.documents.length;
    }
};

// Make AdminDocuments globally accessible if not using ES modules
window.AdminDocuments = AdminDocuments;
