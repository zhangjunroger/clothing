const express = require('express');  
const router = express.Router();  
const AV = require('leancloud-storage');  

// 统计报表页面  
router.get('/', (req, res) => {  
    res.render('reports', { user: req.session.user });  
});  

// 获取报表数据  
router.get('/data', async (req, res) => {  
    // TODO: 实现获取统计数据逻辑  
    res.json([]);  
});  

module.exports = router;