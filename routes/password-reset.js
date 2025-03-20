const AV = require('leancloud-storage');
const express = require('express');
const router = express.Router();

// 发送验证码
router.post('/api/send-verification-code', async (req, res) => {
    try {
        const { email } = req.body;
        
        // 验证邮箱格式
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: '邮箱格式不正确' });
        }

        try {
            // 在LeanCloud中查询用户
            const query = new AV.Query('_User');
            query.equalTo('email', email);
            const user = await query.first();

            if (!user) {
                return res.status(404).json({ error: '未找到该邮箱对应的用户' });
            }

            // 发送密码重置邮件
            await AV.User.requestPasswordReset(email);

            // 返回部分隐藏的邮箱
            const maskedEmail = email.replace(/(?<=.{3}).(?=[^@]*@)/g, '*');
            
            res.json({ 
                success: true, 
                maskedEmail 
            });
        } catch (error) {
            console.error('发送重置邮件错误:', error);
            res.status(500).json({ 
                error: error.message || '发送重置邮件失败' 
            });
        }
    } catch (error) {
        console.error('处理发送验证码错误:', error);
        res.status(500).json({ error: '处理失败' });
    }
});

// 重新发送验证码
router.post('/api/resend-verification-code', async (req, res) => {
    try {
        const { email } = req.body;
        
        // 验证邮箱格式
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: '邮箱格式不正确' });
        }

        try {
            // 在LeanCloud中查询用户
            const query = new AV.Query('_User');
            query.equalTo('email', email);
            const user = await query.first();

            if (!user) {
                return res.status(404).json({ error: '未找到该邮箱对应的用户' });
            }

            // 重新发送密码重置邮件
            await AV.User.requestPasswordReset(email);

            res.json({ success: true });
        } catch (error) {
            console.error('重新发送重置邮件错误:', error);
            res.status(500).json({ 
                error: error.message || '重新发送重置邮件失败' 
            });
        }
    } catch (error) {
        console.error('处理重新发送验证码错误:', error);
        res.status(500).json({ error: '处理失败' });
    }
});

// 重置密码（通过邮件链接）
router.post('/api/reset-password', async (req, res) => {
    try {
        const { email, newPassword } = req.body;
        
        // 验证邮箱格式
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: '邮箱格式不正确' });
        }
        
        // 验证密码
        if (newPassword.length < 6) {
            return res.status(400).json({ error: '密码长度必须至少为6个字符' });
        }
        
        try {
            // 在LeanCloud中查询用户
            const query = new AV.Query('_User');
            query.equalTo('email', email);
            const user = await query.first();

            if (!user) {
                return res.status(404).json({ error: '用户未找到' });
            }

            // 直接更新密码
            user.set('password', newPassword);
            await user.save(null, { useMasterKey: true });
            
            res.json({ 
                success: true, 
                message: '密码重置成功' 
            });
        } catch (error) {
            console.error('重置密码错误:', error);
            res.status(500).json({ 
                error: error.message || '重置密码失败' 
            });
        }
    } catch (error) {
        console.error('处理重置密码错误:', error);
        res.status(500).json({ error: '处理失败' });
    }
});

module.exports = router;