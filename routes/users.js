// routes/users.js  
const express = require('express');  
const router = express.Router();  
const AV = require('leancloud-storage');  
const { requireAdmin } = require('../middlewares/auth');  

// 为所有用户管理路由添加管理员权限检查  
router.use('/users', requireAdmin);  

// 用户列表页面  
router.get('/users', async (req, res) => {  
    try {  
        // 创建查询对象  
        const query = new AV.Query('_User');  
        
        // 设置查询条件（可选）  
        // query.notEqualTo('username', req.session.user.username); // 排除当前用户  

        // 获取所有用户  
        const users = await query.find();  
        console.log('Found users:', users.length); // 调试日志  

        // 转换用户数据为普通对象  
        const userList = users.map(user => ({  
            id: user.id,  
            username: user.get('username'),  
            email: user.get('email') || '未设置邮箱',  
            role: user.get('role') || 'user',  
            createdAt: user.createdAt  
        }));  

        console.log('Processed users:', userList); // 调试日志  

        // 渲染页面  
        res.render('users/index', {   
            users: userList,  
            currentUser: req.session.user,  
            path: '/users'  
        });  
    } catch (error) {  
        console.error('获取用户列表失败:', error);  
        res.render('users/index', {   
            users: [],  
            currentUser: req.session.user,  
            path: '/users',  
            error: '获取用户列表失败: ' + error.message  
        });  
    }  
});  

// 处理删除用户  
router.post('/users/:id/delete', async (req, res) => {  
    try {  
        // 确保不能删除管理员账号  
        const query = new AV.Query('_User');  
        const userToDelete = await query.get(req.params.id);  
        
        if (userToDelete.get('role') === 'admin') {  
            return res.status(403).json({ error: '不能删除管理员账号' });  
        }  

        if (userToDelete.id === req.session.user.id) {  
            return res.status(403).json({ error: '不能删除自己的账号' });  
        }  

        await userToDelete.destroy();  
        res.redirect('/users');  
    } catch (error) {  
        console.error('删除用户失败:', error);  
        res.status(500).json({ error: '删除用户失败: ' + error.message });  
    }  
});  

module.exports = router;