const express = require('express');  
const router = express.Router();  
const AV = require('leancloud-storage');  
const multer = require('multer');  
const xlsx = require('xlsx');  
const fs = require('fs'); // 文件系统模块  
const path = require('path');  

// 定义列名映射，将 Excel 表格中的中文列名映射到代码中的字段名  
const columnMapping = {  
  "物品编号": "itemNumber",  
  "物品名称": "itemName",  
  "规格": "specification",  
  "数量": "quantity",  
  "类别": "category",  
  "仓库位置": "warehouseLocation",  
  "备注": "remarks"  
};  

const app = express();  

// 设置 EJS 模板引擎  
app.set('view engine', 'ejs');  
app.set('views', path.join(__dirname, 'views'));  


router.get('/shenling', (req, res) => {  
  const user = req.session.user || {}; // 从 session 获取用户信息  
  res.render('shenling', { user }); // 将用户数据传递到模板  
});



// 路由：获取服装列表  
router.get('/clothing/list', async (req, res) => {  
    try {  
      const query = new AV.Query('Clothing');  
      query.limit(1000); // 设置最大返回数量  
      const results = await query.find();  
      const data = results.map(item => {  
        const attrs = item.toJSON();  
        attrs.id = item.objectId; // 获取对象的 id  
        return attrs;  
      });  
      res.json(data);  
    } catch (err) {  
      console.error(err);  
      res.status(500).json({ error: '获取服装列表失败' });  
    }  
});  


// 路由：获取申领列表  
router.get('/shenling/list', async (req, res) => {  
  try {  
          // 获取当前用户 ID（假设存储在 req.session.user 中）  
          const currentUser = req.session.user;  
          if (!currentUser || !currentUser.id) {  
              return res.status(401).json({ error: '用户未登录' });  
          }  
    
          const userId = currentUser.username; // 当前用户编号  
    
          // 创建 LeanCloud 查询  
          const query = new AV.Query('Shenling'); // Shenling 为您的 LeanCloud 表名  
          query.equalTo('userId', userId); // 查询 userId 等于当前用户编号的条目  
          query.descending('createdAt'); // 可选：按创建时间排序（最新记录在前）  
    
          // 执行查询  
          const results = await query.find();  
          const data = results.map(item => {  
          const attrs = item.toJSON();  
          attrs.id = item.objectId; // 获取对象的 id  
          return attrs;  
    });  
    res.json(data);  
  } catch (err) {  
    console.error(err);  
    res.status(500).json({ error: '获取申领列表失败' });  
  }  
}); 


// 路由：添加服装信息  
router.post('/shenling/save', async (req, res) => {  
  try {  

    // 2. 定义 Clothing 数据表  
    const Shenling = AV.Object.extend('Shenling');  
    
    // 4. 创建新服装记录  
    const shenling = new Shenling();  

    // 自动映射请求体中的字段到 Clothing 对象  
    Object.keys(req.body).forEach(key => {  
      
    shenling.set(key, String(req.body[key]) || ''); // 强制转换为字符串  

    });  

    // 5. 保存服装记录到数据库  
    const savedObject = await shenling.save();  
    const data = savedObject.toJSON();  
    data.id = savedObject.id; // 保存成功后返回记录 ID  

    // 6. 返回成功响应  
    res.json({ success: true, data });  

  } catch (err) {  
    // 处理未知错误  
    console.error(err);  
    res.status(500).json({ success: false, error: '申领失败' });  
  }  
});  


// 导出路由  
module.exports = router;