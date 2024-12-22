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


router.get('/shenhe', (req, res) => {  
  const user = req.session.user || {}; // 从 session 获取用户信息  
  res.render('shenhe', { user }); // 将用户数据传递到模板  
});


// 路由：获取申领列表  
router.get('/shenhe/list', async (req, res) => {  
  try {  
     
          // 创建 LeanCloud 查询  
          const query = new AV.Query('Shenling'); // Shenling 为您的 LeanCloud 表名  
          query.equalTo('shenhezhuangtai', '未审核'); //   
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


// 路由：审核信息  
router.put('/shenhe/update/:id', async (req, res) => {  
  try {  

          // 2. 定义数据表  
    
          const id = req.params.id; // 要更新的记录 ID  
          const data_update = req.body;  
      

            // 3. 获取当前记录并更新  
            const query = new AV.Query('Shenling');  
            const item = await query.get(id); // 根据 ID 获取记录  
        
            // 更新字段  
 
            item.set('shenhezhuangtai', String(data_update['shenhezhuangtai']));  
          
              // 5. 保存审核记录到数据库  
              const savedObject = await item.save();  
              const data = savedObject.toJSON();  
              data.id = savedObject.id; // 保存成功后返回记录 ID  
          
              // 6. 返回成功响应  
              res.json({ success: true, data });  
          
            } catch (err) {  
              // 处理未知错误  
              console.error(err);  
              res.status(500).json({ success: false, error: '审核信息失败' }); 
            }  

        });

// 路由：更新库存信息  
router.put('/shenhe/update_kuchun/', async (req, res) => {  
  try {  
          const data_update = req.body;  
      
            // 3. 获取当前记录并更新  
            const query = new AV.Query('Clothing');
            query.equalTo('itemNumber', String(data_update.itemNumber));  
          // 执行查询  
          const results = await query.find();  
          const data = results.map(item => {  
          const attrs = item.toJSON();  
          attrs.id = item.objectId; // 获取对象的 id  
          return attrs;
        });  
      // 获取待修改的服装记录 
                
      const item_temp = await query.get(data[0].objectId); 
      // 转化为 JSON 格式，剥离多余的元数据  
      const item = item_temp.toJSON();  
      

      if (!item) {  
        // 如果找到相同编号的记录，则返回错误  
        return res.status(409).json({   
          success: false,   
          error: `当前编号 ${data_update.itemNumber} 物品不存在，无法同步更新库存！`   
        });  
      }  

      // 更新字段
      item_temp.set('quantity', String(parseInt(item['quantity'], 10)-parseInt(data_update.quantity_shenling, 10)));  
    
        // 5. 保存审核记录到数据库  
        const savedObject = await item_temp.save();  
        const data_saved = savedObject.toJSON();  
        data_saved.id = savedObject.id; // 保存成功后返回记录 ID  
    
        // 6. 返回成功响应  
        res.json({ success: true, data_saved });  
                    
  } catch (err) {  
    console.error(err);  
    res.status(500).json({ error: '获取物品库存信息失败' });  
  }  
});  

// 导出路由  
module.exports = router;