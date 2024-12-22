// middlewares/auth.js

// 检查是否登录
const requireLogin = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    next();
};

// 检查是否是管理员
const requireAdmin = (req, res, next) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).render('error', {
            message: '权限不足',
            error: { status: 403, stack: '只有管理员才能访问此页面' },
            currentUser: req.session.user
        });
    }
    next();
};

module.exports = {
    requireLogin,
    requireAdmin
};