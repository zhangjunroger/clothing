const express = require('express');
const router = express.Router();
const AV = require('leancloud-storage');
const multer = require('multer');
const fs = require('fs'); // 文件系统模块  
const path = require('path');



const app = express();

// 设置 EJS 模板引擎  
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));


router.get('/shenling', async (req, res) => {
  
  if (!req.session.user) {  
    return res.redirect('/login');  
}  
  
  const user = req.session.user || {}; // 从 session 获取用户信息

  try {
    const id = user.username;
    const query = new AV.Query('Firefighter');

    query.equalTo('number', String(id)); // 按 number 字段过滤  

    const firefighter = await query.first(); // 查询符合条件的第一条记录 

    if (!firefighter) {
      return res.status(404).json({ error: '未找到当前用户信息信息' });
    }
    // 确保余额保留两位小数
    const firefighter_data = firefighter.toJSON()
    const keyongyue = firefighter_data['keyongyue'] ? parseFloat(firefighter_data['keyongyue']).toFixed(2) : '0.00';
    res.render('shenling', { user, keyongyue }); // 将用户数据传递到模板   
  } catch (err) {
    console.error('获取当前用户信息失败，请重新登录或刷新重试：', err);
    res.status(500).json({ error: '服务器错误，请稍后重试！' });
  }
});



// 路由：获取服装列表  
router.get('/clothing/list', async (req, res) => {
  try {
    const query = new AV.Query('Clothing1');
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
    // 前端提交的订单数组  
    const { userId, Cost, Info } = req.body;

    // 1. 检查可用余额  
    // 这里假定 userId 等于 Firefighter 表 的 username  
    const query = new AV.Query('Firefighter');
    query.equalTo('number', userId);
    const firefighter = await query.first();

    if (!firefighter) {
      return res.status(404).json({ success: false, error: '未找到该用户的余额信息' });
    }
    const { keyongyue } = firefighter.toJSON();
    const balance = Number(keyongyue) || 0;

    // 如果费用总和超过余额  
    if (Cost > balance) {
      return res.status(400).json({ success: false, error: '余额不足，无法结算' });
    }

    // 2. 创建 Shenling 表记录（可创建多条，或根据业务一次性存一条）  
    const Shenling = AV.Object.extend('Shenling');

    // 4. 创建新服装记录  
    const shenling = new Shenling();

    // 自动映射请求体中的字段到 Clothing 对象  
    Object.keys(req.body).forEach(key => {

      if (key === 'ShenheTime') {  
        shenling.set(key, Number(req.body[key]) || 0); // 确保设为数字  
      } else {  
        shenling.set(key, req.body[key] || ''); // 其他字段强制转换为字符串  
      }  

    });

    // 5. 保存服装记录到数据库  
    const savedObject = await shenling.save();
    const data = savedObject.toJSON();
    data.id = savedObject.id; // 保存成功后返回记录 ID

    const items = JSON.parse(Info); // Info 是一个商品组成的数组
    // 遍历 Info，逐一修改相应商品中的库存  
    for (let item of items) {
      const { itemNumber, specification, quantity } = item;

      // 查询目标商品  
      const clothingQuery = new AV.Query('Clothing1');
      clothingQuery.equalTo('itemNumber', Number(itemNumber));
      const clothingItem = await clothingQuery.first();

      if (!clothingItem) {
        return res.status(404).json({
          success: false,
          error: `商品 [${itemNumber}] 不存在，无法修改库存`
        });
      }

      // 获取当前商品的尺码库存列表  
      const currentSizes = clothingItem.get('sizes'); // `sizes` 是一个 JSON 对象

      // 使用 find 定位对象  
      const sizeItem = currentSizes.find(item => item.size === specification);


      // 遍历前端提交的尺码列表，逐一修改库存  
      if (!sizeItem) {
        return res.status(400).json({
          success: false,
          error: `商品 [${itemNumber}] 的尺码 [${specification}] 库存信息不存在`
        });
      }

      const currentStock = sizeItem.quantity; // 当前库存数量  
      if (quantity > currentStock) {
        return res.status(400).json({
          success: false,
          error: `商品 [${itemNumber}] 尺码 [${specification}] 库存不足`
        });
      }

      // 减少库存  
      // 修改该对象的 quantity 值  
      if (sizeItem) {
        sizeItem.quantity -= quantity;
      } else {
        console.log(`未找到指定尺码: ${specification}`);
      }


      // 更新商品的库存信息  
      clothingItem.set('sizes', currentSizes); // 更新 `sizes` 字段  
      await clothingItem.save(); // 保存到数据库
      
      //更新单条目数据库
      const AllData = AV.Object.extend('AllData');  
      const record = new AllData();  

      // 假设 Firefighter 表里有 name / danwei 字段  
      record.set('name', firefighter.name || '');   // 姓名  
      record.set('danwei', firefighter.team || ''); // 单位(若无此字段可删)  
      
      record.set('wupinbianhao', item.itemNumber || '');  
      record.set('wupinmingcheng', item.itemName || '');  
      record.set('xinghao', item.specification || '');  
      record.set('danjia', item.price || 0);  
      record.set('shuliang', item.quantity || 0);  
      record.set('zonge', item.total);  
      
      record.set('dingdanhao', req.body['Number'] || '');  

      record.set('dingdanshijian', Number(req.body['Time']) || 0);  

      await record.save();  

    }

    // 3. 扣除用户的可用余额  
    const newBalance = balance - Cost;
    firefighter.set('keyongyue', String(newBalance));
    await firefighter.save();

    return res.json({
      success: true,
      message: '申领与结算成功',
      newBalance,
    });


  } catch (err) {
    // 处理未知错误  
    console.error(err);
    res.status(500).json({ success: false, error: '申领失败' });
  }

});


router.delete('/shenling/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // 获取要删除的 Shenling 记录  
    const Shenling = AV.Object.extend('Shenling');
    const query = new AV.Query('Shenling');

    query.equalTo('Number', id);
    const record = await query.first();

    if (!record) {
      return res.status(404).json({ success: false, error: '订单不存在' });
    }

    // 取出相关数据  
    const userId = record.get('userId');
    const totalCost = record.get('Cost');
    const Info = record.get('Info');

    // 删除该订单记录  
    await record.destroy();

    // 如果需要退还余额，则查询 Firefighter 并加回金额  
    // （若需求不需要退还，可省略此部分）  
    const Firefighter = AV.Object.extend('Firefighter');
    const ffQuery = new AV.Query('Firefighter');
    ffQuery.equalTo('number', userId);
    const ffRecord = await ffQuery.first();
    let newBalance_display = parseFloat(ffRecord.get('keyongyue') || '0');

    if (ffRecord) {
      const oldBalance = parseFloat(ffRecord.get('keyongyue') || '0');
      const newBalance = Number(oldBalance) + Number(totalCost);
      newBalance_display = newBalance;
      ffRecord.set('keyongyue', String(newBalance));
      await ffRecord.save();
    }

    const items = JSON.parse(Info); // Info 是一个商品组成的数组
    // 遍历 Info，逐一修改相应商品中的库存  
    for (let item of items) {
      const { itemNumber, specification, quantity } = item;

      // 查询目标商品  
      const clothingQuery = new AV.Query('Clothing1');
      clothingQuery.equalTo('itemNumber', Number(itemNumber));
      const clothingItem = await clothingQuery.first();

      if (!clothingItem) {
        return res.status(404).json({
          success: false,
          error: `商品 [${itemNumber}] 不存在，无法修改库存`
        });
      }

      // 获取当前商品的尺码库存列表  
      const currentSizes = clothingItem.get('sizes'); // `sizes` 是一个 JSON 对象

      // 使用 find 定位对象  
      const sizeItem = currentSizes.find(item => item.size === specification);


      // 遍历前端提交的尺码列表，逐一修改库存  
      if (!sizeItem) {
        return res.status(400).json({
          success: false,
          error: `商品 [${itemNumber}] 的尺码 [${specification}] 库存信息不存在`
        });
      }

      const currentStock = sizeItem.quantity; // 当前库存数量  
      if (quantity > currentStock) {
        return res.status(400).json({
          success: false,
          error: `商品 [${itemNumber}] 尺码 [${specification}] 库存不足`
        });
      }

      // 减少库存  
      // 修改该对象的 quantity 值  
      if (sizeItem) {
        sizeItem.quantity += quantity;
      } else {
        console.log(`未找到指定尺码: ${specification}`);
      }


      // 更新商品的库存信息  
      clothingItem.set('sizes', currentSizes); // 更新 `sizes` 字段  
      await clothingItem.save(); // 保存到数据库  
    }


    /***********************************************  
     * 新增：删除 AllData 中对应此订单号的所有记录  
     ***********************************************/  
    const allDataQuery = new AV.Query('AllData');  
    // 假设订单号存到 AllData 的 dingdanhao 字段  
    allDataQuery.equalTo('dingdanhao', id);  

    const allDataRecords = await allDataQuery.find();  
    if (allDataRecords && allDataRecords.length > 0) {  
      // 批量删除  
      await AV.Object.destroyAll(allDataRecords);  
    }  

    // 6. 返回成功响应  
    return res.json({ success: true, newBalance_display, message: '订单已取消' });
  } catch (err) {
    console.error('取消订单失败:', err);
    return res.status(500).json({ success: false, error: '取消订单失败' });
  }
});


// 导出路由  
module.exports = router;