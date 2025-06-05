document.addEventListener('DOMContentLoaded', () => {
    const resetPasswordForm = document.getElementById('resetPasswordForm');
    const tokenInput = document.getElementById('token');
    const newPasswordInput = document.getElementById('newPassword');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const messageArea = document.getElementById('messageArea');

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

    // Message display helper
    function displayMessage(message, type) {
        if (messageArea) {
            messageArea.innerHTML = `<div class="alert alert-${type} alert-dismissible fade show" role="alert">
                                ${message}
                                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                              </div>`;
        } else {
            console.error("Message area not found.");
            alert(message); // Fallback
        }
    }

    function getTokenFromURL() {
        const queryParams = new URLSearchParams(window.location.search);
        const token = queryParams.get('token');
        if (token && tokenInput) {
            tokenInput.value = token;
            console.log("Token found in URL and populated:", token);
        }
    }
    getTokenFromURL();

    if (resetPasswordForm) {
        const submitButton = resetPasswordForm.querySelector('button[type="submit"]');
        resetPasswordForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            messageArea.innerHTML = '';

            const token = tokenInput.value.trim();
            const newPassword = newPasswordInput.value;
            const confirmPassword = confirmPasswordInput.value;

            if (!token) { displayMessage('重置令牌不能为空。', 'warning'); return; }
            if (!newPassword) { displayMessage('新密码不能为空。', 'warning'); return; }
            if (newPassword.length < 6) { displayMessage('新密码长度至少为6位字符。', 'warning'); return; }
            if (newPassword !== confirmPassword) { displayMessage('两次输入的密码不匹配。', 'warning'); return; }

            if(submitButton) showButtonLoading(submitButton, '正在重置...');

            try {
                const response = await fetch('/api/auth/reset-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', },
                    body: JSON.stringify({ token, newPassword }),
                });
                const result = await response.json();
                if (response.ok) {
                    displayMessage(result.message || '密码已成功重置。您现在可以尝试使用新密码登录。', 'success');
                    resetPasswordForm.reset();
                    if(submitButton) { // Keep button text as "密码已重置!" but still use hideButtonLoading to re-enable
                        submitButton.dataset.originalText = '密码已重置!'; // Update original text for this state
                        hideButtonLoading(submitButton);
                        // No further clicks desired, so keep it disabled or change text more permanently
                        submitButton.textContent = '密码已重置!'; // Ensure text is set
                        submitButton.disabled = true; // Keep disabled after success
                    }
                    tokenInput.disabled = true;
                    newPasswordInput.disabled = true;
                    confirmPasswordInput.disabled = true;
                } else {
                    displayMessage(result.message || '重置失败，请检查您的令牌或稍后再试。', 'danger');
                    if(submitButton) hideButtonLoading(submitButton);
                }
            } catch (error) {
                console.error('重置密码时出错:', error);
                displayMessage('网络错误或服务器无响应，请稍后再试。', 'danger');
                if(submitButton) hideButtonLoading(submitButton);
            }
        });
    }
});
