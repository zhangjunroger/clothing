const express = require('express');  
const AV = require('leancloud-storage');  
const router = express.Router();  


router.get('/inventory', (req, res) => {  
    res.render('inventory');  
  });


// 获取库存列表，支持条件搜索
router.post('/inventory/list', async (req, res) => {
  try {
    const { itemNumber, itemName, specification, quantity, category, warehouseLocation } = req.body;
    const query = new AV.Query('Clothing');

    if (itemNumber) query.equalTo('itemNumber', itemNumber);
    if (itemName) query.contains('itemName', itemName);
    if (specification) query.contains('specification', specification);
    if (quantity) query.equalTo('quantity', quantity);
    if (category) query.contains('category', category);
    if (warehouseLocation) query.contains('warehouseLocation', warehouseLocation);

    const results = await query.find();

    const data = results.map(item => {
      return {
        id: item.id,
        itemNumber: item.get('itemNumber'),
        itemName: item.get('itemName'),
        specification: item.get('specification'),
        quantity: item.get('quantity'),
        category: item.get('category'),
        warehouseLocation: item.get('warehouseLocation'),
        remarks: item.get('remarks')
      };
    });

    res.json(data);
  } catch (error) {
    console.error('获取库存列表失败：', error);
    res.status(500).json({ error: '获取库存列表失败' });
  }
});

// 获取单个库存信息
router.get('/inventory/get/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const query = new AV.Query('Clothing');
    const item = await query.get(id);

    res.json({
      id: item.id,
      itemNumber: item.get('itemNumber'),
      itemName: item.get('itemName'),
      specification: item.get('specification'),
      quantity: item.get('quantity'),
      category: item.get('category'),
      warehouseLocation: item.get('warehouseLocation'),
      remarks: item.get('remarks')
    });
  } catch (error) {
    console.error('获取库存信息失败：', error);
    res.status(500).json({ error: '获取库存信息失败' });
  }
});


// 更新库存信息  
router.put('/inventory/update/:id', async (req, res) => {  
    try {  
      const id = req.params.id; // 要更新的记录 ID  
      const {  
        itemNumber,           // 物品编号  
        itemName,             // 物品名称  
        specification,        // 规格  
        quantity,             // 数量  
        category,             // 分类  
        warehouseLocation,    // 仓库位置  
        remarks,              // 备注  
      } = req.body;  
  
      // 1. 检查编号是否唯一（除去当前记录外）  
      const numberQuery = new AV.Query('Clothing');  
      numberQuery.equalTo('itemNumber', itemNumber); // 查询是否有相同的编号  
      numberQuery.notEqualTo('objectId', id); // 排除当前记录  
  
      // 执行查询  
      const existingItem = await numberQuery.first();  
  
      // 2. 如果找到重复记录，返回错误信息  
      if (existingItem) {  
        return res.json({  
          success: false,  
          error: '物品编号已存在，请修改！',  
        });  
      }  
  
      // 3. 获取当前记录并更新  
      const query = new AV.Query('Clothing');  
      const item = await query.get(id); // 根据 ID 获取记录  
  
      // 更新字段  
      item.set('itemNumber', itemNumber);  
      item.set('itemName', itemName);  
      item.set('specification', specification);  
      item.set('quantity', quantity); // 确保数量是整数  
      item.set('category', category);  
      item.set('warehouseLocation', warehouseLocation);  
      item.set('remarks', remarks);  
  
      // 保存更新  
      await item.save();  
  
      // 4. 返回成功信息  
      res.json({ success: true });  
    } catch (error) {  
      console.error('更新库存信息失败：', error);  
      res.status(500).json({ error: '更新库存信息失败' });  
    }  
  });

// 删除库存信息
router.delete('/inventory/delete/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const item = AV.Object.createWithoutData('Clothing', id);
    await item.destroy();

    res.json({ success: true });
  } catch (error) {
    console.error('删除库存信息失败：', error);
    res.status(500).json({ error: '删除库存信息失败' });
  }
});

module.exports = router;