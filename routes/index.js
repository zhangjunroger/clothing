const express = require('express');  
const router = express.Router();  
const AV = require('leancloud-storage');  

// 首页（登录页）  
router.get('/', (req, res) => {  
    res.render('login', { error: null });  
});  

// 登录页面  
router.get('/login', (req, res) => {  
    res.render('login', { error: null });  
});  

// 注册页面  
router.get('/register', (req, res) => {  
    res.render('register', { error: null });  
});  

// 注册处理  
router.post('/register', async (req, res) => {  
    try {  
        const { username, password, email, role } = req.body;  
        
        // 检查用户名是否已存在  
        const query = new AV.Query('_User');  
        query.equalTo('username', username);  
        const existingUser = await query.first();  
        
        if (existingUser) {  
            return res.status(400).json({  
                error: '用户名已存在'  
            });  
        }  

        const user = new AV.User();  
        user.set('username', username);  
        user.set('password', password);  
        user.set('email', email);  
        user.set('role', role); // 设置角色字段  

        await user.signUp();  
        
        // 注册成功  
        res.status(200).json({  
            success: true,  
            message: '注册成功'  
        });  

    } catch (error) {  
        console.error('注册错误:', error);  
        res.status(500).json({  
            error: error.message || '注册失败，请重试'  
        });  
    }  
});

// 登录处理  
router.post('/login', async (req, res) => {  
    try {  
        const { username, password } = req.body;  
        const user = await AV.User.logIn(username, password);  
        
        // 保存用户信息到session  
        req.session.user = {  
            id: user.id,  
            username: user.get('username'),  
            role: user.get('role')  
        };  
        
        res.redirect('/dashboard');  
    } catch (error) {  
        console.error('登录错误:', error);  
        res.render('login', { error: '用户名或密码错误' });  
    }  
});  

// 仪表板页面  
router.get('/dashboard', (req, res) => {  
    if (!req.session.user) {  
        return res.redirect('/login');  
    }  
    res.render('dashboard', { user: req.session.user });  
});  

// 退出登录  
router.get('/logout', (req, res) => {  
    req.session.destroy();  
    res.redirect('/login');  
});  

// 管理员用户管理页面  
router.get('/admin/users', async (req, res) => {  
    if (!req.session.user || req.session.user.role !== 'admin') {  
        return res.redirect('/login');  
    }  
    res.render('admin/users');  
});  

module.exports = router;