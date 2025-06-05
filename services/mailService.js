// services/mailService.js

/**
 * 发送密码重置邮件的占位函数。
 * TODO: 实现真实的邮件发送逻辑 (例如使用 nodemailer)。
 * @param {string} to 收件人邮箱
 * @param {string} username 用户名
 * @param {string} resetLink 重置链接
 * @returns {Promise<void>}
 */
async function sendPasswordResetEmail(to, username, resetLink) {
    console.log('--- 邮件服务 (占位) ---');
    console.log(`收件人: ${to}`);
    console.log(`用户名: ${username}`);
    console.log(`重置链接: ${resetLink}`);
    console.log('注意: 当前邮件服务为占位实现，邮件并未真实发送。');

    // 示例：使用 nodemailer (需要先 npm install nodemailer)
    /*
    const nodemailer = require('nodemailer');

    // 配置邮件传输器 (根据您的邮件服务提供商进行配置)
    const transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST || 'smtp.example.com',
      port: process.env.MAIL_PORT || 587,
      secure: (process.env.MAIL_PORT === '465'), // true for 465, false for other ports
      auth: {
        user: process.env.MAIL_USER, // 您的邮箱账户
        pass: process.env.MAIL_PASS, // 您的邮箱密码或授权码
      },
    });

    const mailOptions = {
      from: `"云南能源文档工具集" <${process.env.MAIL_FROM || 'noreply@example.com'}>`,
      to: to,
      subject: '密码重置请求 - 云南能源文档工具集',
      html: `
        <p>您好 ${username},</p>
        <p>您请求了密码重置。请点击以下链接设置新密码（链接1小时内有效）：</p>
        <p><a href="${resetLink}" target="_blank" style="color: #007bff; text-decoration: none;">${resetLink}</a></p>
        <p>如果您没有请求密码重置，请忽略此邮件。</p>
        <hr>
        <p style="font-size: 0.9em; color: #666;">此邮件为系统自动发送，请勿直接回复。</p>
      `,
      // text: `您好 ${username},\n\n您请求了密码重置。请复制以下链接到浏览器地址栏设置新密码（链接1小时内有效）：\n${resetLink}\n\n如果您没有请求密码重置，请忽略此邮件。`
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log('密码重置邮件已发送 (模拟)。');
    } catch (error) {
      console.error('发送密码重置邮件失败:', error);
      throw new Error('发送密码重置邮件失败，请稍后再试或联系管理员。');
    }
    */

    return Promise.resolve(); // 模拟异步操作成功
}

module.exports = {
    sendPasswordResetEmail,
};
