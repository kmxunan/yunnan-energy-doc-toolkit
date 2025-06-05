/**
 * public/js/admin_classifications.js
 */

// Helper functions for button loading state
function showButtonLoading(buttonElement, loadingText = "处理中...") {
    if (!buttonElement) return;
    buttonElement.dataset.originalText = buttonElement.innerHTML;
    buttonElement.disabled = true;
    buttonElement.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> ${loadingText}`;
}

function hideButtonLoading(buttonElement) {
    if (!buttonElement || buttonElement.dataset.originalText === undefined) return;
    buttonElement.disabled = false;
    if (buttonElement.dataset.originalText) {
       buttonElement.innerHTML = buttonElement.dataset.originalText;
    }
}

// Ensure escapeHTML is available (copied from admin_documents.js for standalone use if needed)
if (typeof escapeHTML !== 'function') {
    console.warn("escapeHTML function is not globally defined in admin_classifications.js. Defining a basic one.");
    window.escapeHTML = function(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    };
}


// DOM 元素引用
let createClassificationForm, classificationNameInput, parentClassificationSelect;
let createClassificationStatusP, classificationsTableBody, classificationListStatusP;
let docClassificationUploadSelect, editDocClassificationSelect;

let allClassifications = [];

const AdminClassifications = {
    init: function() {
        createClassificationForm = document.getElementById('createClassificationForm');
        classificationNameInput = document.getElementById('classificationName');
        parentClassificationSelect = document.getElementById('parentClassification');
        createClassificationStatusP = document.getElementById('createClassificationStatus');
        classificationsTableBody = document.getElementById('classificationsTableBody');
        classificationListStatusP = document.getElementById('classificationListStatus');
        docClassificationUploadSelect = document.getElementById('docClassificationUpload');
        editDocClassificationSelect = document.getElementById('editDocClassification');

        if (createClassificationForm) {
            createClassificationForm.addEventListener('submit', this.handleCreateClassification.bind(this));
        } else {
            console.warn("创建分类表单 'createClassificationForm' 未找到。");
        }
        this.loadClassifications();
    },

    loadClassifications: async function() {
        if (classificationListStatusP) {
            classificationListStatusP.textContent = '正在加载分类...';
            classificationListStatusP.className = 'message alert alert-info';
            classificationListStatusP.style.display = 'block';
        }
        try {
            const fetchFunction = typeof fetchAPI === 'function' ? fetchAPI : (window.AuthModule && window.AuthModule.fetchAPI);
            if (!fetchFunction) throw new Error("fetchAPI 函数未定义。");
            allClassifications = await fetchFunction('/api/classifications', 'GET');
            if (classificationListStatusP) classificationListStatusP.style.display = 'none';
            this.renderClassificationsTable(allClassifications);
            this.populateParentClassificationSelects(allClassifications);
        } catch (error) {
            console.error('加载分类列表失败:', error);
            if (classificationListStatusP) {
                classificationListStatusP.textContent = `加载分类失败: ${error.message}`;
                classificationListStatusP.className = 'message alert alert-danger';
            }
            if (classificationsTableBody) classificationsTableBody.innerHTML = '<tr><td colspan="4" class="error-message">无法加载分类数据。</td></tr>';
        }
    },

    renderClassificationsTable: function(classifications) {
        if (!classificationsTableBody) return;
        classificationsTableBody.innerHTML = '';
        if (!classifications || classifications.length === 0) {
            classificationsTableBody.innerHTML = '<tr><td colspan="4">暂无分类。</td></tr>';
            return;
        }
        classifications.forEach(cls => {
            const row = classificationsTableBody.insertRow();
            row.innerHTML = `
                <td>${cls.id}</td>
                <td>${escapeHTML(cls.name)}</td>
                <td>${cls.parent_id ? cls.parent_id : '无 (顶级)'}</td>
                <td class="actions-cell">
                    <button class="btn btn-sm btn-outline-primary me-1 edit-classification-btn" data-id="${cls.id}" data-name="${escapeHTML(cls.name)}" data-parentid="${cls.parent_id || ''}">编辑</button>
                    <button class="btn btn-sm btn-outline-danger delete-classification-btn" data-id="${cls.id}">删除</button>
                </td>
            `;
        });
        this.addTableButtonListeners();
    },

    populateParentClassificationSelects: function(classifications, selectedParentId = null) {
        const selects = [parentClassificationSelect, docClassificationUploadSelect, editDocClassificationSelect];
        selects.forEach(selectElement => {
            if (!selectElement) return;
            const currentValue = selectElement.value;
            selectElement.innerHTML = `<option value="">-- ${selectElement === parentClassificationSelect ? '设为顶级分类' : '无分类'} --</option>`;
            if (classifications && classifications.length > 0) {
                classifications.forEach(cls => {
                    if (selectElement === parentClassificationSelect && window.editingClassificationId && cls.id === window.editingClassificationId) {
                        return;
                    }
                    const option = document.createElement('option');
                    option.value = cls.id;
                    option.textContent = `${escapeHTML(cls.name)} (ID: ${cls.id})`;
                    if (selectedParentId && cls.id === selectedParentId) {
                        option.selected = true;
                    }
                    selectElement.appendChild(option);
                });
            }
            if (selectedParentId !== null) {
                selectElement.value = selectedParentId;
            } else if (currentValue && selectElement.querySelector(`option[value="${currentValue}"]`)) {
                selectElement.value = currentValue;
            }
        });
    },

    handleCreateClassification: async function(event) {
        event.preventDefault();
        if (!classificationNameInput || !parentClassificationSelect || !createClassificationStatusP) return;
        const name = classificationNameInput.value.trim();
        const parent_id = parentClassificationSelect.value ? parseInt(parentClassificationSelect.value, 10) : null;
        if (!name) {
            createClassificationStatusP.textContent = '分类名称不能为空。';
            createClassificationStatusP.className = 'message alert alert-warning';
            createClassificationStatusP.style.display = 'block';
            return;
        }
        const submitButton = createClassificationForm.querySelector('button[type="submit"]');
        showButtonLoading(submitButton, '创建中...');
        createClassificationStatusP.textContent = '正在创建分类...';
        createClassificationStatusP.className = 'message alert alert-info';
        createClassificationStatusP.style.display = 'block';
        try {
            const fetchFunction = typeof fetchAPI === 'function' ? fetchAPI : (window.AuthModule && window.AuthModule.fetchAPI);
            if (!fetchFunction) throw new Error("fetchAPI 函数未定义。");
            const result = await fetchFunction('/api/classifications', 'POST', { name, parent_id });
            createClassificationStatusP.textContent = result.message || '分类创建成功！';
            createClassificationStatusP.className = 'message alert alert-success';
            classificationNameInput.value = '';
            parentClassificationSelect.value = '';
            this.loadClassifications();
        } catch (error) {
            console.error('创建分类失败:', error);
            createClassificationStatusP.textContent = `创建分类失败: ${error.message || '未知错误'}`;
            createClassificationStatusP.className = 'message alert alert-danger';
        } finally {
            if(submitButton) hideButtonLoading(submitButton);
        }
    },

    addTableButtonListeners: function() {
        classificationsTableBody.querySelectorAll('.edit-classification-btn').forEach(button => {
            button.removeEventListener('click', AdminClassifications.handleEditClassificationClick); // Prevent duplicates
            button.addEventListener('click', AdminClassifications.handleEditClassificationClick.bind(AdminClassifications));
        });
        classificationsTableBody.querySelectorAll('.delete-classification-btn').forEach(button => {
            button.removeEventListener('click', AdminClassifications.handleDeleteClassificationClick); // Prevent duplicates
            button.addEventListener('click', AdminClassifications.handleDeleteClassificationClick.bind(AdminClassifications));
        });
    },

    handleEditClassificationClick: async function(event) {
        const button = event.target.closest('button');
        const id = button.dataset.id;
        const classification = allClassifications.find(c => c.id == id);
        if (!classification) { alert('未找到分类信息。'); return; }

        const newName = prompt("输入新的分类名称:", classification.name);
        if (newName === null || newName.trim() === "") return;

        window.editingClassificationId = parseInt(id);
        this.populateParentClassificationSelects(allClassifications, classification.parent_id ? parseInt(classification.parent_id) : null);
        delete window.editingClassificationId;

        // For this prompt-based edit, direct button loading isn't straightforward.
        // Status will be shown in classificationListStatusP.
        await this.updateClassification(id, newName.trim(), classification.parent_id, button);
    },

    updateClassification: async function(id, name, parent_id, buttonElement) {
        if (classificationListStatusP) {
            classificationListStatusP.textContent = `正在更新分类 ${id}...`;
            classificationListStatusP.className = 'message alert alert-info';
            classificationListStatusP.style.display = 'block';
        }
        if(buttonElement) showButtonLoading(buttonElement, '更新中...');
        try {
            const fetchFunction = typeof fetchAPI === 'function' ? fetchAPI : (window.AuthModule && window.AuthModule.fetchAPI);
            if (!fetchFunction) throw new Error("fetchAPI 函数未定义。");
            await fetchFunction(`/api/classifications/${id}`, 'PUT', { name, parent_id });
            if (classificationListStatusP) {
                classificationListStatusP.textContent = '分类更新成功！';
                classificationListStatusP.className = 'message alert alert-success';
            }
            this.loadClassifications();
        } catch (error) {
            console.error(`更新分类 ${id} 失败:`, error);
            if (classificationListStatusP) {
                classificationListStatusP.textContent = `更新分类失败: ${error.message}`;
                classificationListStatusP.className = 'message alert alert-danger';
            }
        } finally {
            if(buttonElement) hideButtonLoading(buttonElement);
        }
    },

    handleDeleteClassificationClick: async function(event) {
        const button = event.target.closest('button');
        const id = button.dataset.id;
        if (!confirm(`确定要删除分类 ID: ${id} 吗？\n注意：其下的文档将变为“无分类”，其子分类将变为顶级分类。`)) {
            return;
        }
        if (classificationListStatusP) {
            classificationListStatusP.textContent = `正在删除分类 ${id}...`;
            classificationListStatusP.className = 'message alert alert-info';
            classificationListStatusP.style.display = 'block';
        }
        showButtonLoading(button, '删除中...');
        try {
            const fetchFunction = typeof fetchAPI === 'function' ? fetchAPI : (window.AuthModule && window.AuthModule.fetchAPI);
            if (!fetchFunction) throw new Error("fetchAPI 函数未定义。");
            await fetchFunction(`/api/classifications/${id}`, 'DELETE');
            if (classificationListStatusP) {
                classificationListStatusP.textContent = '分类删除成功！';
                classificationListStatusP.className = 'message alert alert-success';
            }
            this.loadClassifications();
        } catch (error) {
            console.error(`删除分类 ${id} 失败:`, error);
            if (classificationListStatusP) {
                classificationListStatusP.textContent = `删除分类失败: ${error.message}`;
                classificationListStatusP.className = 'message alert alert-danger';
            }
        } finally {
            hideButtonLoading(button); // Button will be gone after table re-render, but good practice.
        }
    }
};

window.AdminClassifications = AdminClassifications;
