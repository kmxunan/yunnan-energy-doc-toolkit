/**
 * public/js/admin_users.js
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

// Ensure escapeHTML 函数可用
if (typeof escapeHTML !== 'function') {
    console.warn("escapeHTML function is not globally defined. Defining a basic one for AdminUsers.");
    window.escapeHTML = function(str) { // Assign to window if it's meant to be globally accessible from other scripts
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    };
}


const AdminUsers = {
    allUsers: [],
    usersTableBody: null,
    userListStatusP: null,

    init: function() {
        console.log("AdminUsers: Initializing user management module...");
        this.usersTableBody = document.getElementById('usersTableBody');
        this.userListStatusP = document.getElementById('userListStatus');

        if (!this.usersTableBody || !this.userListStatusP) {
            console.error("用户管理相关的DOM元素 (usersTableBody 或 userListStatusP) 未找到。");
            return;
        }
        this.loadUsers();
    },

    loadUsers: async function() {
        this.userListStatusP.textContent = '正在加载用户列表...';
        this.userListStatusP.className = 'message alert alert-info';
        this.userListStatusP.style.display = 'block';

        try {
            const fetchFunction = typeof fetchAPI === 'function' ? fetchAPI : (window.AuthModule && window.AuthModule.fetchAPI);
            if (!fetchFunction) {
                throw new Error("fetchAPI 函数未定义。请确保 auth.js 或 admin_main.js 已正确加载并暴露该函数。");
            }
            this.allUsers = await fetchFunction('/api/auth/users', 'GET');
            this.userListStatusP.style.display = 'none'; // Hide on success before render
            this.renderUsersTable(this.allUsers);
        } catch (error) {
            console.error('加载用户列表失败:', error);
            this.userListStatusP.textContent = `加载用户列表失败: ${error.message}`;
            this.userListStatusP.className = 'message alert alert-danger';
            if (this.usersTableBody) this.usersTableBody.innerHTML = '<tr><td colspan="5" class="error-message">无法加载用户数据。</td></tr>';
        }
    },

    renderUsersTable: function(users) {
        if (!this.usersTableBody) return;
        this.usersTableBody.innerHTML = '';

        if (!users || users.length === 0) {
            this.usersTableBody.innerHTML = '<tr><td colspan="5">暂无其他用户。</td></tr>';
            return;
        }
        const currentUserFromSession = (typeof getCurrentUser === 'function' ? getCurrentUser() : (window.AuthModule ? window.AuthModule.getCurrentUser() : null));
        users.forEach(user => {
            const row = this.usersTableBody.insertRow();
            const isAdminUser = user.username === 'admin';
            const isCurrentUser = currentUserFromSession && currentUserFromSession.id === user.id;
            row.innerHTML = `
                <td>${user.id}</td>
                <td>${escapeHTML(user.username)}</td>
                <td>
                    <select class="form-select form-select-sm user-role-select" data-userid="${user.id}" ${isAdminUser ? 'disabled' : ''} title="${isAdminUser ? '不能修改admin用户的角色' : '选择角色'}">
                        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>admin (管理员)</option>
                        <option value="project_manager" ${user.role === 'project_manager' ? 'selected' : ''}>project_manager (项目经理/分析师)</option>
                        <option value="regular_user" ${user.role === 'regular_user' ? 'selected' : ''}>regular_user (普通用户)</option>
                    </select>
                    <button class="btn btn-sm btn-outline-success ms-2 save-role-btn" data-userid="${user.id}" style="display:none;" title="保存角色更改">保存</button>
                </td>
                <td>${new Date(user.created_at).toLocaleString()}</td>
                <td class="actions-cell">
                    <button class="btn btn-sm btn-outline-danger delete-user-btn" data-userid="${user.id}" ${isAdminUser || isCurrentUser ? 'disabled' : ''} title="${isAdminUser ? '不能删除admin用户' : (isCurrentUser ? '不能删除当前登录的管理员' : '删除此用户')}">删除</button>
                </td>
            `;
        });
        this.addUserTableButtonListeners();
    },

    addUserTableButtonListeners: function() {
        if (!this.usersTableBody) return;
        this.usersTableBody.querySelectorAll('.user-role-select').forEach(select => {
            select.removeEventListener('change', this.handleRoleSelectChange.bind(this)); // Prevent duplicates
            select.addEventListener('change', this.handleRoleSelectChange.bind(this));
        });
        this.usersTableBody.querySelectorAll('.save-role-btn').forEach(button => {
            button.removeEventListener('click', this.handleSaveRoleClick.bind(this)); // Prevent duplicates
            button.addEventListener('click', this.handleSaveRoleClick.bind(this));
        });
        this.usersTableBody.querySelectorAll('.delete-user-btn').forEach(button => {
            button.removeEventListener('click', this.handleDeleteUserClick.bind(this)); // Prevent duplicates
            button.addEventListener('click', this.handleDeleteUserClick.bind(this));
        });
    },

    handleRoleSelectChange: function(event) {
        const selectElement = event.target;
        const userId = selectElement.dataset.userid;
        const saveButton = this.usersTableBody.querySelector(`.save-role-btn[data-userid="${userId}"]`);
        if (saveButton) {
            saveButton.style.display = 'inline-block';
        }
    },

    handleSaveRoleClick: async function(event) {
        const button = event.target.closest('button');
        const userId = button.dataset.userid;
        const selectElement = this.usersTableBody.querySelector(`.user-role-select[data-userid="${userId}"]`);
        const newRole = selectElement.value;

        if (!confirm(`确定要将用户 ID: ${userId} 的角色更改为 "${newRole}" 吗？`)) {
            return;
        }
        this.userListStatusP.textContent = `正在更新用户 ${userId} 的角色...`;
        this.userListStatusP.className = 'message alert alert-info';
        this.userListStatusP.style.display = 'block';
        showButtonLoading(button, '保存中...');

        try {
            const fetchFunction = typeof fetchAPI === 'function' ? fetchAPI : (window.AuthModule && window.AuthModule.fetchAPI);
            if (!fetchFunction) throw new Error("fetchAPI 函数未定义。");
            await fetchFunction(`/api/auth/users/${userId}/role`, 'PUT', { role: newRole });
            this.userListStatusP.textContent = `用户 ${userId} 的角色已成功更新为 ${newRole}！`;
            this.userListStatusP.className = 'message alert alert-success';
            button.style.display = 'none';
            const userInCache = this.allUsers.find(u => u.id == userId);
            if (userInCache) userInCache.role = newRole;
        } catch (error) {
            console.error(`更新用户 ${userId} 角色失败:`, error);
            this.userListStatusP.textContent = `更新用户角色失败: ${error.message || '未知错误'}`;
            this.userListStatusP.className = 'message alert alert-danger';
            const originalUser = this.allUsers.find(u => u.id == userId);
            if (originalUser) selectElement.value = originalUser.role;
        } finally {
            hideButtonLoading(button);
        }
    },

    handleDeleteUserClick: async function(event) {
        const button = event.target.closest('button');
        const userId = button.dataset.userid;
        const userToDelete = this.allUsers.find(u => u.id == userId);

        if (!userToDelete) { alert("错误：未找到要删除的用户信息。"); return; }
        if (userToDelete.username === 'admin') { alert("不能删除 'admin' 用户！"); return; }
        const currentUserFromSession = (typeof getCurrentUser === 'function' ? getCurrentUser() : (window.AuthModule ? window.AuthModule.getCurrentUser() : null));
        if (currentUserFromSession && currentUserFromSession.id == userId) {
            alert("不能删除当前登录的管理员账户！"); return;
        }
        if (!confirm(`确定要删除用户 ID: ${userId} (用户名: ${escapeHTML(userToDelete.username)}) 吗？此操作不可恢复！`)) {
            return;
        }
        this.userListStatusP.textContent = `正在删除用户 ${userId}...`;
        this.userListStatusP.className = 'message alert alert-info';
        this.userListStatusP.style.display = 'block';
        showButtonLoading(button, '删除中...');

        try {
            const fetchFunction = typeof fetchAPI === 'function' ? fetchAPI : (window.AuthModule && window.AuthModule.fetchAPI);
            if (!fetchFunction) throw new Error("fetchAPI 函数未定义。");
            await fetchFunction(`/api/auth/users/${userId}`, 'DELETE');
            this.userListStatusP.textContent = `用户 ${userId} 已成功删除！`;
            this.userListStatusP.className = 'message alert alert-success';
            this.loadUsers();
        } catch (error) {
            console.error(`删除用户 ${userId} 失败:`, error);
            this.userListStatusP.textContent = `删除用户失败: ${error.message || '未知错误'}`;
            this.userListStatusP.className = 'message alert alert-danger';
        } finally {
             // Button will be removed on table re-render, but hide loading if it's still there
            hideButtonLoading(button);
        }
    }
};
window.AdminUsers = AdminUsers;
