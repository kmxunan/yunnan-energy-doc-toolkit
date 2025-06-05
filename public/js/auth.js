// public/js/auth.js

// jwt_decode 将通过 <script> 标签从 CDN 引入，并成为全局可用函数

window.escapeHTML = function(str) {
    if (str === null || str === undefined) {
        return '';
    }
    return String(str).replace(/[&<>"']/g, function (match) {
        return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[match];
    });
};

window.showToast = function(message, type = 'info', duration = 3500) {
    // console.log(`[showToast] Message: ${message}, Type: ${type}`);
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
        console.warn('Toast container "toastContainer" not found in the DOM. Using alert as fallback.');
        alert(`${type.toUpperCase()}: ${message}`);
        return;
    }

    const toastId = `toast-${Date.now()}`;
    const toastElement = document.createElement('div');
    toastElement.id = toastId;
    toastElement.className = `toast align-items-center text-white border-0 fade`;
    let bgColorClass = 'bg-primary';
    let iconHtml = '<i class="bi bi-info-circle-fill me-2"></i>';

    if (type === 'success') {
        bgColorClass = 'bg-success';
        iconHtml = '<i class="bi bi-check-circle-fill me-2"></i>';
    }
    if (type === 'error') {
        bgColorClass = 'bg-danger';
        iconHtml = '<i class="bi bi-exclamation-triangle-fill me-2"></i>';
    }
    if (type === 'warning') {
        bgColorClass = 'bg-warning text-dark';
        iconHtml = '<i class="bi bi-exclamation-circle-fill me-2"></i>';
    }

    toastElement.classList.add(bgColorClass);
    toastElement.setAttribute('role', 'alert');
    toastElement.setAttribute('aria-live', 'assertive');
    toastElement.setAttribute('aria-atomic', 'true');

    const toastBody = document.createElement('div');
    toastBody.className = 'd-flex p-3';
    toastBody.innerHTML = `<div class="toast-body flex-grow-1">${iconHtml} ${window.escapeHTML(message)}</div>
                           <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>`;

    toastElement.appendChild(toastBody);
    toastContainer.appendChild(toastElement);

    if (typeof bootstrap !== 'undefined' && typeof bootstrap.Toast === 'function') {
        const bsToast = new bootstrap.Toast(toastElement, { delay: duration, autohide: true });
        bsToast.show();
        toastElement.addEventListener('hidden.bs.toast', () => {
            toastElement.remove();
        });
    } else {
        console.error('Bootstrap Toast component not available. Toast will not function correctly.');
        toastElement.classList.add('show');
        setTimeout(() => {
            toastElement.classList.remove('show');
            setTimeout(() => toastElement.remove(), 150);
        }, duration);
    }
};


function getApiBaseUrl() {
    return '';
}

async function fetchAPI(apiUrl, method = 'GET', body = null, isFormData = false) {
    const fullUrl = `${getApiBaseUrl()}${apiUrl}`;
    const options = {
        method,
        headers: {},
        credentials: 'omit',
    };

    if (body) {
        if (isFormData) {
            options.body = body;
        } else {
            options.headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(body);
        }
    }

    const token = localStorage.getItem('token');
    if (token) {
        options.headers['Authorization'] = `Bearer ${token}`;
    }

    // console.log(`Auth.js: 发起 API 请求: ${options.method} ${fullUrl}`);

    try {
        const response = await fetch(fullUrl, options);
        let responseData;
        const contentType = response.headers.get("content-type");

        if (contentType && contentType.indexOf("application/json") !== -1) {
            responseData = await response.json();
        } else {
            const textResponse = await response.text();
            try {
                responseData = JSON.parse(textResponse);
            } catch (e) {
                if (!response.ok) {
                    responseData = { message: textResponse || response.statusText, status: response.status, _isErrorText: true };
                } else {
                    responseData = textResponse;
                }
            }
        }

        // console.log(`Auth.js: API 响应状态: ${response.status} for ${options.method} ${fullUrl}. Response data (first 300 chars):`, JSON.stringify(responseData).substring(0, 300));

        if (!response.ok) {
            const errorMessage = (responseData && responseData.message) ? responseData.message : `请求失败，状态码: ${response.status}`;
            const error = new Error(errorMessage);
            error.status = response.status;
            error.response = responseData;
            if (responseData && responseData._isErrorText) {
                error.errorText = responseData.message;
            }
            throw error;
        }
        return responseData;
    } catch (error) {
        // console.error(`Fetch API 调用失败 for ${method} ${fullUrl}:`, error.message);
        if (!error.status) {
            error.message = `网络错误或请求无法完成: ${error.message || '请检查网络连接或服务器是否正在运行。'}`;
        } else if (error.errorText) {
            const match = error.errorText.match(/<pre>(.*?)<\/pre>/is) || error.errorText.match(/<title>(.*?)<\/title>/is);
            let detailMessage = match ? match[1].trim() : error.errorText.substring(0,150).trim() + '...';
            const htmlErrorMatch = error.errorText.match(/<h1>(.*?)<\/h1>(?:.*<pre>([\s\S]*?)<\/pre>)?/is);
            if (htmlErrorMatch) {
                detailMessage = htmlErrorMatch[1].trim();
                if (htmlErrorMatch[2]) {
                    detailMessage += `: ${htmlErrorMatch[2].trim().split('\n')[0]}`;
                }
            }
            if (detailMessage.toLowerCase().includes('<html')) {
                detailMessage = `服务器返回了非预期的响应 (状态 ${error.status})。`;
            }
            error.message = `服务器错误 (状态 ${error.status}): ${detailMessage.substring(0,250)}`;
        }
        if (error.message && error.message.toLowerCase().includes("failed to fetch")) {
            error.message = "网络连接失败或服务器无响应。请检查您的网络连接，并稍后再试。";
        }
        throw error;
    }
}

async function checkAuthState() {
    const authStatusEl = document.getElementById('authStatus');
    const mobileAuthStatusEl = document.getElementById('mobileAuthStatus');
    const adminAuthStatusTopEl = document.getElementById('adminAuthStatus');
    const logoutButton = document.getElementById('logoutButton');
    const adminLogoutButton = document.getElementById('adminLogoutButton');
    const mobileLogoutButton = document.getElementById('mobileLogoutButton');
    const loginLinkContainer = document.getElementById('loginLinkContainer');

    // console.log('[checkAuthState] 开始检查认证状态...');
    try {
        const user = await fetchAPI('/api/auth/me', 'GET');
        // console.log('[checkAuthState] /api/auth/me 响应 (原始):', user);
        // console.log('[checkAuthState] /api/auth/me 响应 (JSON):', JSON.stringify(user));

        if (user && typeof user === 'object' && user.id !== undefined && user.username && user.role) {
            const commonText = `欢迎, ${window.escapeHTML(user.username)} (${window.escapeHTML(user.role)})`;
            if (authStatusEl) authStatusEl.textContent = commonText;
            if (adminAuthStatusTopEl) adminAuthStatusTopEl.textContent = commonText;
            if (mobileAuthStatusEl) mobileAuthStatusEl.textContent = commonText;

            if (logoutButton) logoutButton.classList.remove('d-none');
            if (adminLogoutButton) adminLogoutButton.classList.remove('d-none');
            if (mobileLogoutButton) mobileLogoutButton.classList.remove('d-none');

            if (loginLinkContainer) loginLinkContainer.classList.add('d-none');

            const userDetail = JSON.parse(JSON.stringify(user)); // Deep clone
            // console.log('[checkAuthState] 用户已认证, 准备派发 userLoggedIn 事件, detail:', userDetail);
            document.dispatchEvent(new CustomEvent('userLoggedIn', { detail: userDetail }));
            return userDetail; // Return the cloned user object
        } else {
            // console.warn('[checkAuthState] /api/auth/me 返回的数据不是有效的用户对象或缺少关键字段:', user);
            localStorage.removeItem('token');
            throw new Error('用户未认证或返回的用户数据无效。');
        }
    } catch (error) {
        // console.warn('[checkAuthState] 检查用户状态失败或用户未认证 (catch block):', error.message, 'Status:', error.status);
        if (error.status !== 401) {
            console.error('[checkAuthState] API调用时发生非401错误:', error);
        }
        localStorage.removeItem('token');

        if (authStatusEl) authStatusEl.textContent = '';
        if (adminAuthStatusTopEl) adminAuthStatusTopEl.textContent = '未登录';
        if (mobileAuthStatusEl) mobileAuthStatusEl.textContent = '请登录';


        if (logoutButton) logoutButton.classList.add('d-none');
        if (adminLogoutButton) adminLogoutButton.classList.add('d-none');
        if (mobileLogoutButton) mobileLogoutButton.classList.add('d-none');

        if (loginLinkContainer) loginLinkContainer.classList.remove('d-none');
        // console.log('[checkAuthState] 用户未认证, 派发 userLoggedOut 事件');
        document.dispatchEvent(new Event('userLoggedOut'));
        return null;
    }
}

async function handleLogin(event) {
    event.preventDefault();
    const username = event.target.username.value;
    const password = event.target.password.value;
    const loginMessageEl = document.getElementById('loginMessage');
    const loginButton = event.target.querySelector('button[type="submit"]');
    const originalButtonText = loginButton ? loginButton.textContent : '登录';

    if(loginButton) {
        loginButton.disabled = true;
        loginButton.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 登录中...`;
    }
    if(loginMessageEl) loginMessageEl.textContent = '';

    try {
        // console.log('[handleLogin] 尝试登录，用户名:', username);
        const data = await fetchAPI('/api/auth/login', 'POST', { username, password });
        // console.log('[handleLogin] /api/auth/login 成功响应 (原始 data):', JSON.stringify(data));

        // ** 关键检查: 确保 data.user 是一个包含 id, username, role 的有效对象 **
        if (data && data.token && data.user &&
            typeof data.user === 'object' &&
            data.user.id !== undefined &&
            typeof data.user.username === 'string' && data.user.username.trim() !== '' &&
            typeof data.user.role === 'string' && data.user.role.trim() !== '') {

            localStorage.setItem('token', data.token);

            const userToDispatch = JSON.parse(JSON.stringify(data.user));
            // console.log('[handleLogin] 登录API成功, 准备派发 userLoggedIn 事件, detail (来自 data.user):', userToDispatch);
            document.dispatchEvent(new CustomEvent('userLoggedIn', { detail: userToDispatch }));

            // Update UI elements immediately for better UX
            const user = data.user;
            const commonText = `欢迎, ${window.escapeHTML(user.username)} (${window.escapeHTML(user.role)})`;

            const authStatusEl = document.getElementById('authStatus');
            const adminAuthStatusTopEl = document.getElementById('adminAuthStatus');
            const mobileAuthStatusEl = document.getElementById('mobileAuthStatus');
            const adminUsernameDisp = document.getElementById('adminUsernameDisplay');

            if (authStatusEl) authStatusEl.textContent = commonText;
            if (adminAuthStatusTopEl) adminAuthStatusTopEl.textContent = commonText;
            if (mobileAuthStatusEl) mobileAuthStatusEl.textContent = commonText;
            if (adminUsernameDisp) adminUsernameDisp.textContent = window.escapeHTML(user.username);

            const logoutButtons = document.querySelectorAll('#logoutButton, #adminLogoutButton, #mobileLogoutButton');
            logoutButtons.forEach(btn => { if(btn) btn.classList.remove('d-none'); });

            const loginLinkCont = document.getElementById('loginLinkContainer');
            if (loginLinkCont) loginLinkCont.classList.add('d-none');

            if (typeof window.showToast === 'function') {
                window.showToast(data.message || '登录成功！', 'success');
            } else {
                alert(data.message || '登录成功！');
            }
        } else {
            console.error('[handleLogin] 登录API响应无效或缺少关键用户信息: data.token=', data.token, '; data.user=', JSON.stringify(data.user));
            const serverMessage = data && data.message ? data.message : '服务器返回数据格式错误或用户信息不完整。';
            throw new Error(`登录失败：${serverMessage}`);
        }

    } catch (error) {
        console.error('Auth.js: 登录失败 (handleLogin catch):', error.message, error);
        const errorMessage = error.message || '登录失败，请重试。';
        if(loginMessageEl) {
            loginMessageEl.textContent = errorMessage;
            loginMessageEl.className = 'text-danger mt-2 small';
        }
        if (typeof window.showToast === 'function') {
            window.showToast(errorMessage, 'error');
        } else {
            alert(errorMessage);
        }
    } finally {
        if(loginButton) {
            loginButton.disabled = false;
            loginButton.textContent = originalButtonText;
        }
    }
}

async function handleLogout() {
    // console.log('[handleLogout] 开始登出...');
    try {
        await fetchAPI('/api/auth/logout', 'POST');
        localStorage.removeItem('token');
        // console.log('[handleLogout] Token已移除。');

        await checkAuthState();

        if (typeof window.showToast === 'function') {
            window.showToast('您已成功登出。', 'info');
        } else {
            alert('您已成功登出。');
        }
    } catch (error) {
        console.error('Auth.js: 登出失败:', error);
        if (typeof window.showToast === 'function') {
            window.showToast(`登出时发生错误: ${error.message}`, 'error');
        } else {
            alert(`登出时发生错误: ${error.message}`);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // console.log("Auth.js: DOMContentLoaded, 尝试绑定事件。");
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    const logoutButtons = document.querySelectorAll('#logoutButton, #mobileLogoutButton, #adminLogoutButton');
    logoutButtons.forEach(button => {
        if (button) {
            button.addEventListener('click', handleLogout);
        }
    });

    if (typeof window.authStateCheckedByAuthCheck === 'undefined') {
        // console.log("Auth.js: DOMContentLoaded, authStateCheckedByAuthCheck is undefined, calling checkAuthState().");
        checkAuthState();
        window.authStateCheckedByAuthCheck = true;
    } else {
        // console.log("Auth.js: DOMContentLoaded, authStateCheckedByAuthCheck is defined.");
    }
});
