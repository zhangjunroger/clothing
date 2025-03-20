// routes/admin.js  

const express = require('express');  
const router = express.Router();  
const AV = require('leancloud-storage');  

// 用户管理界面  
router.get('/users', (req, res) => {
    if (!req.session.user) {  
        return res.redirect('/login');  
    }    
    res.render('admin/users');  // 渲染 views/admin/users.ejs  
});  

// 获取用户列表  
router.get('/users-list', async (req, res) => {  
    try {  
        const query = new AV.Query('_User'); // '_User' 是 LeanCloud 的用户表  
        query.limit(1000); // 设置查询上限  
        const users = await query.find();
        console.log('查询到的用户数据:', users);   

        // 格式化用户信息发送给前端  
        const userList = users.map(user => ({  
            id: user.id,  
            username: user.get('username'),  
            email: user.get('email'), 
            role: user.get('role'),  
            createdAt: user.createdAt  
        }));  

        res.json(userList);  
    } catch (error) {  
        console.error('获取用户列表失败:', error);  
        res.status(500).json({ error: '获取用户列表失败' });  
    }  
});  

// 删除用户  
router.delete('/users/:id', async (req, res) => {  
    try {  
        const userId = req.params.id;  
        const user = AV.Object.createWithoutData('_User', userId);  
        await user.destroy();  
        res.json({ success: true });  
    } catch (error) {  
        console.error('删除用户失败:', error);  
        res.status(500).json({ error: '删除用户失败' });  
    }  
});  

// 注册新用户  
router.post('/users', async (req, res) => {  
    try {  
        const { username, password, email, role } = req.body;  

        // 验证字段  
        if (!username || !password || !email) {  
            return res.status(400).json({ error: '用户名、密码和邮箱为必填项' });  
        }  

        const user = new AV.User();  
        user.set('username', username);  
        user.set('password', password); 
        user.set('role', role);  
        user.set('email', email);  

        await user.signUp();  
        res.json({ success: true });  
    } catch (error) {  
        console.error('注册用户失败:', error);  
        res.status(500).json({ error: error.message || '注册用户失败' });  
    }  
});  

module.exports = router;