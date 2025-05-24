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
  if (!req.session.user) {  
    return res.redirect('/login');  
}    
  const user = req.session.user || {}; // 从 session 获取用户信息  
  res.render('shenhe', { user }); // 将用户数据传递到模板  
});


// 路由：获取申领列表  
router.get('/shenhe/list', async (req, res) => {  
  try {
    const {
      userName,
      userTeam,
      Number,
      startTime,
      endTime
    } = req.query; // 从查询参数获取搜索条件      
    
    // 创建 LeanCloud 查询  
    const query = new AV.Query('Shenling'); // Shenling 为您的 LeanCloud 表名 
    
    
    // 添加搜索条件  
    if (userName) {
      query.equalTo('userName', userName);
    }
    if (userTeam) {
      query.contains('userTeam', userTeam);
    }
    if (Number) {
      query.equalTo('Number', Number);
    }

    if (startTime || endTime) {
      // 需要确保 `price` 字段为数字类型  
      if (startTime) {
        query.greaterThanOrEqualTo('Time', parseInt(startTime, 10));
      }
      if (endTime) {
        query.lessThanOrEqualTo('Time', parseInt(endTime, 10));
      }
    } 
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
      // 获取当前时间  
      const currentTime = new Date();  
      record.set('shenhezhuangtai', status); // 更新审核状态（已审核或未通过）
      record.set('ShenheTime', currentTime.getTime()); // 写入审核时间  
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

  const Clothing = AV.Object.extend('Clothing1'); // 假设商品表为 Clothing  
  const query = new AV.Query(Clothing);  
  query.equalTo('itemNumber', Number(itemNumber)); // 按商品编号查找记录  
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

    if (!results || results.length === 0) {  
      return res.status(400).json({ success: false, error: '没有未审核订单！' });  
    }  
    
    // 获取当前时间  
    const currentTime = new Date();  

    for (const record of results) {  
      record.set('shenhezhuangtai', status); // 更新审核状态
      record.set('ShenheTime', currentTime.getTime()); // 写入审核时间
      await record.save();  
    }  

    res.json({ success: true, message: '所有订单状态更新成功！' });  
  } catch (err) {  
    console.error(err);  
    res.status(500).json({ success: false, error: '批量更新状态失败！' });  
  }  
});


router.get('/shenhe_reports/generate', async (req, res) => {
  try {
    const { number, name, itemInfoSearch, startyear, endyear, shenhestartyear, shenheendyear, minprice, maxprice, state, sortField, sortOrder } = req.query;

    // 根据不同报表类型查询数据  
    let report = [];

    // 查询变更记录表  
    const query = new AV.Query('Shenling');

    if (number) query.equalTo('Number', String(number));
    if (name) query.equalTo('userName', name);

    if (itemInfoSearch) query.contains('Info', `"itemNumber":"${itemInfoSearch}"`);  


    if (startyear) {  
      // 创建 Date 对象，并获取开始时间的时间戳  
      const startDate = new Date(startyear + 'T00:00:00'); // 使用 T 连接符，以确保兼容 ISO 格式  
      const startOfDay = startDate.getTime(); // 获取时间戳  
      query.greaterThanOrEqualTo('Time', startOfDay);  
    }  
  
    if (endyear) {  
      // 创建 Date 对象，并获取结束时间的时间戳  
      const endDate = new Date(endyear + 'T23:59:59'); // 使用 T 连接符，以确保兼容 ISO 格式  
      const endOfDay = endDate.getTime(); // 获取时间戳  
      query.lessThanOrEqualTo('Time', endOfDay);  
    }  

    if (shenhestartyear) {  
      // 创建 Date 对象，并获取开始时间的时间戳  
      const shenhestartDate = new Date(shenhestartyear + 'T00:00:00'); // 使用 T 连接符，以确保兼容 ISO 格式  
      const shenhestartOfDay = shenhestartDate.getTime(); // 获取时间戳  
      query.greaterThanOrEqualTo('ShenheTime', shenhestartOfDay);  
  }  
  
  if (shenheendyear) {  
      // 创建 Date 对象，并获取结束时间的时间戳  
      const shenheendDate = new Date(shenheendyear + 'T23:59:59'); // 使用 T 连接符，以确保兼容 ISO 格式  
      const shenheendOfDay = shenheendDate.getTime(); // 获取时间戳  
      query.lessThanOrEqualTo('ShenheTime', shenheendOfDay);  
  }  


    if (minprice) query.greaterThanOrEqualTo('Cost', Number(minprice));
    if (maxprice) query.lessThanOrEqualTo('Cost', Number(maxprice));

    if (state) query.contains('shenhezhuangtai', `${state}`);   

    // 应用排序  
    if (sortField) {
      if (sortOrder === 'desc') {
        query.descending(sortField);
      } else {
        query.ascending(sortField);
      }
    } else {
      query.ascending('Number');
    }

    // 执行查询  
    const results = await query.find();
    report = results.map(item => item.toJSON());

    res.json({
      success: true,
      report: report
    });
  } catch (err) {
    console.error('打印报表失败:', err);
    res.status(500).json({ success: false, error: '打印报表失败' });
  }
});

// 导出路由  
module.exports = router;