const express = require('express');
const AV = require('leancloud-storage');
const router = express.Router();
const multer = require('multer');
const fs = require('fs'); // 文件系统模块  


router.get('/inventory', (req, res) => {
  res.render('inventory');
});


// 配置 multer，用于处理文件上传  
const upload = multer({ dest: 'uploads/' });

// 获取库存列表，支持条件搜索
router.post('/inventory/list', async (req, res) => {
  try {
    const { itemNumber, itemName, price, category, warehouseLocation } = req.body;
    const query = new AV.Query('Clothing');

    console.log(itemNumber)
    console.log(itemName)    

    if (itemNumber) query.equalTo('itemNumber', itemNumber);
    if (itemName) query.contains('itemName', itemName);
    if (price) query.equalTo('price', price);
    if (category) query.contains('category', category);
    if (warehouseLocation) query.contains('warehouseLocation', warehouseLocation);

    const results = await query.find();

    const data = results.map(item => {
      return {
        id: item.id,
        itemNumber: item.get('itemNumber'),
        itemName: item.get('itemName'),
        itemPic: item.get('itemPic'),
        sizes: item.get('sizes'),
        price: item.get('price'),
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
      itemPic: item.get('itemPic'),
      sizes: item.get('sizes'),
      price: item.get('price'),
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
router.put('/inventory/update/:id', upload.single('itemPic'), async (req, res) => {
  try {
    const id = req.params.id; // 要更新的记录 ID  
    const {
      itemNumber,           // 物品编号  
      itemName,             // 物品名称
      itemPic,             // 物品名称   
      sizes,             // 尺码与数量
      price,             // 单价   
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

    console.log(req.body)

    // 3. 获取当前记录并更新  
    const query = new AV.Query('Clothing');
    const item = await query.get(id); // 根据 ID 获取记录  

    // 更新字段  
    item.set('itemNumber', itemNumber);
    item.set('itemName', itemName);

    // 如果有新文件，则上传到 LeanCloud 并替换  
    let fileUrl = item.get('itemPic'); // 默认继续用旧的  
    if (req.file) {
      const fileBuffer = fs.readFileSync(req.file.path);
      const avFile = new AV.File(req.file.originalname, fileBuffer);
      await avFile.save();
      fileUrl = avFile.url();
      fs.unlinkSync(req.file.path);
    }

    console.log(fileUrl)
    console.log(sizes)
    console.log(JSON.parse(sizes))
    console.log(JSON.parse(sizes) || '')                        

    // 设置图片 URL  
    item.set('itemPic', fileUrl || ''); // 如果没有上传图片，默认为空字符串   

    item.set('sizes', JSON.parse(sizes) || '');
    item.set('price', price);
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