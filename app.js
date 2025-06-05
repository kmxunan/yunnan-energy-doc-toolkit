// app.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan'); // HTTP request logger
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const flash = require('connect-flash');

// **导入 initializeDatabase 函数和 db 实例**
const { db, initializeDatabase } = require('./database/setup');

// 路由模块
const indexRouter = require('./routes/index');
const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');
const documentsRouter = require('./routes/documents');
const classificationsRouter = require('./routes/classifications');
const toolkitRouter = require('./routes/toolkitRoutes');
const siteSelectionRouter = require('./routes/siteSelectionRoutes');

const authMiddleware = require('./middleware/authMiddleware');

const app = express();

// 中间件配置
app.use(logger('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));
app.use(cookieParser(process.env.COOKIE_SECRET || 'a_very_strong_secret_cookie_parser_secret_key_123!'));

app.use(session({
  store: new SQLiteStore({
    db: 'sessions.sqlite',
    dir: path.join(__dirname, 'database'),
    table: 'sessions'
  }),
  secret: process.env.SESSION_SECRET || 'another_very_strong_secret_for_session_!@#$',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'lax'
  }
}));
app.use(flash());

// 静态文件服务
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// console.log(`[app.js] Serving static files from 'public' directory: ${path.join(__dirname, 'public')}`);
// console.log(`[app.js] Serving static files from '/uploads' route, mapping to directory: ${path.join(__dirname, 'uploads')}`);

// 路由配置
app.use('/', indexRouter);
app.use('/api/auth', authRouter);
app.use('/api/users', authMiddleware.isAuthenticated, authMiddleware.isAdmin, usersRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/classifications', classificationsRouter);
app.use('/api/toolkit', authMiddleware.isAuthenticated, toolkitRouter);
app.use('/api/site-selection', authMiddleware.isAuthenticated, siteSelectionRouter);

// 捕获404并转发到错误处理器
app.use(function(req, res, next) {
  const err = new Error('未找到页面');
  err.status = 404;
  // console.warn(`[app.js] 404 - 未找到: ${req.method} ${req.originalUrl}`);
  next(err);
});

// 全局错误处理器
app.use(function(err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  const status = err.status || 500;
  console.error(`[app.js 全局错误处理器] 状态: ${status}, 消息: "${err.message}", 请求: ${req.method} ${req.originalUrl}`);
  if (req.app.get('env') === 'development' && err.stack) {
    console.error(err.stack);
  }

  if (res.headersSent) {
    return next(err);
  }

  res.status(status).json({
    message: err.message || '服务器发生未知错误。',
    error: req.app.get('env') === 'development' ? { stack: err.stack, details: err.details || err.code } : {}
  });
});


// **在应用启动前初始化数据库**
// initializeDatabase()
//   .then(() => {
//     console.log('[app.js] 数据库初始化成功。应用即将启动...');
//     // 应用启动逻辑 (例如 app.listen) 应该在这里，或者通过 www 文件处理
//     // 如果您使用 bin/www 来启动服务器，则此处的 console.log 可能就足够了，
//     // 因为 www 文件会 require('./app') 并启动监听。
//   })
//   .catch(err => {
//     console.error("[app.js] 数据库初始化失败，应用无法启动:", err);
//     process.exit(1); // 初始化失败则退出
//   });
// 注意：如果您的启动脚本是 bin/www，它会 require('app')。
// 为了确保数据库在路由处理任何请求之前初始化，
// initializeDatabase() 的调用应该在模块导出之前完成，或者 www 脚本等待它完成。
// 对于当前结构，让 setup.js 在加载时同步（或通过顶层await）完成初始化，或者 app.js 等待 Promise 解析。
// 当前 setup.js 的 initializeDatabase 返回 Promise，所以 app.js 可以等待它。
// 但由于 app.js 被 www require，直接在顶层 await 可能不适用。
// 最好的方式是在 www 文件中处理这个Promise。
// 如果保持在 app.js 中，需要确保 www 等待。
// 考虑到简洁性，暂时保持 setup.js 在加载时执行，并依赖其内部的 serialize 来保证顺序。
// 如果问题依旧，我们需要调整 www 的启动方式或 setup.js 的导出/执行方式。

module.exports = app;
