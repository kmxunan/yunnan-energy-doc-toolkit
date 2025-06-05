document.addEventListener('DOMContentLoaded', () => {
    const userInfoNav = document.getElementById('userInfoNav');
    const usernameNav = document.getElementById('usernameNav');
    // const roleNav = document.getElementById('roleNav'); // Element for role is not in the shared navbar HTML
    const logoutButtonNav = document.getElementById('logoutButtonNav');
    const loginLinkNav = document.getElementById('loginLinkNav');

    // Ensure escapeHTML is available
    if (typeof escapeHTML !== 'function') {
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

    if (!userInfoNav || !usernameNav || !logoutButtonNav || !loginLinkNav) {
        // console.warn('Auth check: Some navbar auth elements not found. This might be normal for pages not using the full shared navbar.');
        return; // Exit if essential navbar elements aren't present
    }
    // Helper functions for button loading state (can be refactored to a global utility if used in many places)
    function showButtonLoading(buttonElement, loadingText = "处理中...") {
        if (!buttonElement) return;
        buttonElement.dataset.originalText = buttonElement.innerHTML; // Using innerHTML to save icon too
        buttonElement.disabled = true;
        buttonElement.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> ${loadingText}`;
    }

    function hideButtonLoading(buttonElement) {
        if (!buttonElement || !buttonElement.dataset.originalText) return;
        buttonElement.disabled = false;
        buttonElement.innerHTML = buttonElement.dataset.originalText;
    }

    fetch('/api/auth/me')
        .then(response => {
            if (response.status === 401) {
                return { user: null };
            }
            if (!response.ok) {
                if (response.headers.get("content-type")?.includes("application/json")) {
                    return response.json().then(errData => Promise.reject(new Error(errData.message || `Auth check HTTP error! Status: ${response.status}`)));
                }
                throw new Error(`Auth check HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data && data.user && data.user.username) {
                usernameNav.textContent = escapeHTML(data.user.username);
                userInfoNav.style.display = 'flex';
                loginLinkNav.style.display = 'none';

                logoutButtonNav.addEventListener('click', async () => {
                    showButtonLoading(logoutButtonNav, '登出中...');
                    try {
                        const logoutResponse = await fetch('/api/auth/logout', { method: 'POST' });
                        if (logoutResponse.ok) {
                            window.location.href = '/admin.html';
                        } else {
                            const err = await logoutResponse.json().catch(() => ({ message: '请稍后再试。' }));
                            alert(`登出失败: ${err.message}`);
                        }
                    } catch (err) {
                        console.error('Logout request failed:', err);
                        alert('登出请求失败，请检查网络连接。');
                    } finally {
                        hideButtonLoading(logoutButtonNav); // Ensure button is reset even if redirect fails or is delayed
                    }
                });
            } else {
                userInfoNav.style.display = 'none';
                loginLinkNav.style.display = 'block';
            }
        })
        .catch(error => {
             console.error('Error fetching auth status for navbar or during logout setup:', error.message);
             userInfoNav.style.display = 'none';
             loginLinkNav.style.display = 'block';
        });
});
