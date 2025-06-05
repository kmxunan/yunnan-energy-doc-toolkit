document.addEventListener('DOMContentLoaded', () => {
    const requestResetForm = document.getElementById('requestResetForm');
    const usernameInput = document.getElementById('username');
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

    if (requestResetForm) {
        const submitButton = requestResetForm.querySelector('button[type="submit"]');
        requestResetForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            messageArea.innerHTML = '';
            const username = usernameInput.value.trim();

            if (!username) {
                displayMessage('用户名不能为空。', 'warning');
                return;
            }

            if(submitButton) showButtonLoading(submitButton, '正在处理...');

            try {
                const response = await fetch('/api/auth/request-password-reset', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ username }),
                });

                const result = await response.json();

                if (response.ok) {
                    displayMessage(result.message || '如果您的账户存在，密码重置指令（目前显示在服务器控制台）已发送。', 'success');
                    usernameInput.value = '';
                } else {
                    displayMessage(result.message || '请求失败，请稍后再试。', 'danger');
                }
            } catch (error) {
                console.error('请求密码重置时出错:', error);
                displayMessage('网络错误或服务器无响应，请稍后再试。', 'danger');
            } finally {
                if(submitButton) hideButtonLoading(submitButton);
            }
        });
    }
});
