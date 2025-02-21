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


// 路由：获取申领列表  
router.get('/shenhe/Yilist', async (req, res) => {  
  try {  
     
          // 创建 LeanCloud 查询  
          const query1 = new AV.Query('Shenling');  
          const query2 = new AV.Query('Shenling');  
          query1.equalTo('shenhezhuangtai', '已审核'); // 查询已审核  
          query2.startsWith('shenhezhuangtai', '未通过'); // 查询所有未通过状态
          // 合并查询（OR）  
          const query = AV.Query.or(query1, query2);   
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
    res.status(500).json({ error: '获取已审核列表失败' });  
  }  
}); 


// 路由：审核信息  
router.post('/shenhe/approve', async (req, res) => {  
  const { orders, status } = req.body;  

  if (!orders || !Array.isArray(orders) || orders.length === 0) {  
    return res.status(400).json({ success: false, error: '订单列表不能为空！' });  
  }  

  try {  
    const query = new AV.Query('Shenling');  
    query.containedIn('Number', orders); // 查询选中的订单  
    const results = await query.find();  

    for (const record of results) {
      if (status.startsWith('未通过')) {  
          await handleRejectedOrder(record, status); // 更新余额和库存逻辑  
      }  
    
      record.set('shenhezhuangtai', status); // 更新审核状态（已审核或未通过）  
      await record.save();  
    }  

    res.json({ success: true, message: '订单状态更新成功！' });  
  } catch (err) {  
    console.error(err);  
    res.status(500).json({ success: false, error: '订单状态更新失败！' });  
  }  
});

async function handleRejectedOrder(order, reason) {  
  const userId = order.get('userId'); // 获取消防员 ID  
  const cost = parseFloat(order.get('Cost')); // 获取订单金额  

  // 1. 更新消防员余额  
  const Firefighter = AV.Object.extend('Firefighter'); // 假设消防员表为 Firefighter  
  const firefighterQuery = new AV.Query(Firefighter);  
  firefighterQuery.equalTo('number', userId); // 根据消防员编号查询消防员记录  
  const firefighter = await firefighterQuery.first();  

  if (!firefighter) {  
    throw new Error(`无法找到与订单用户 ID [${userId}] 对应的消防员记录`);  
  }  

  // 退还金额到可用余额  
  const currentBalance = parseFloat(firefighter.get('keyongyue') || '0'); // 获取现有余额  
  firefighter.set('keyongyue', (currentBalance + cost).toString()); // 更新余额  
  await firefighter.save();  

  // 2. 恢复商品库存  
  const items = JSON.parse(order.get('Info')); // 解析订单商品列表  
  for (const item of items) {  
    await restoreItemStock(item); // 恢复每件商品的库存  
  }  

  console.log(`订单 [${order.id}] 未通过处理完成：余额退还，库存已恢复。`);  
}


async function restoreItemStock(item) {  
  const { itemNumber, specification, quantity } = item;  

  const Clothing = AV.Object.extend('Clothing'); // 假设商品表为 Clothing  
  const query = new AV.Query(Clothing);  
  query.equalTo('itemNumber', itemNumber); // 按商品编号查找记录  
  const clothingItem = await query.first();  

  if (!clothingItem) {  
    throw new Error(`商品 [${itemNumber}] 不存在，无法恢复库存`);  
  }  

  const currentSizes = clothingItem.get('sizes'); // 获取商品的尺码库存 (JSON 对象)  
  const sizeItem = currentSizes.find(size => size.size === specification);  

  if (!sizeItem) {  
    throw new Error(`商品 [${itemNumber}] 的尺码 [${specification}] 不存在库存记录`);  
  }  

  // 恢复库存  
  sizeItem.quantity += quantity; // 增加库存  
  clothingItem.set('sizes', currentSizes); // 更新商品库存  
  await clothingItem.save();  

  console.log(`商品 [${itemNumber}] 的尺码 [${specification}] 库存已恢复 +${quantity}`);  
}

router.post('/shenhe/approveAll', async (req, res) => {  
  const { status } = req.body;  

  try {  
    const query = new AV.Query('Shenling');  
    query.equalTo('shenhezhuangtai', '未审核'); // 查询所有未审核订单  
    const results = await query.find();  

    for (const record of results) {  
      record.set('shenhezhuangtai', status); // 更新审核状态  
      await record.save();  
    }  

    res.json({ success: true, message: '所有订单状态更新成功！' });  
  } catch (err) {  
    console.error(err);  
    res.status(500).json({ success: false, error: '批量更新状态失败！' });  
  }  
});


// 导出路由  
module.exports = router;