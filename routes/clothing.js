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
  "缩略图": "itemPic",
  "尺码与数量": "sizes",
  "单价": "price",
  "类别": "category",
  "年份": "warehouseLocation",
  "备注": "remarks"
};

// 路由：访问服装管理页面  
router.get('/clothing', (req, res) => {
  if (!req.session.user) {  
    return res.redirect('/login');  
}  
  res.render('clothing', { user: req.session.user }); // 调用 clothing.ejs 模板  
});

// 路由：下载服装信息的 Excel 模板  
router.get('/template/clothing_template.xlsx', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/template/clothing_template.xlsx'));
});



// 配置 multer，用于处理文件上传  
const upload = multer({ dest: 'uploads/' });

// 路由：获取服装列表  
router.get('/clothing/list', async (req, res) => {
  try {
    const {
      itemNumber,
      itemName,
      priceMin,
      priceMax,
      category,
      yearMin,
      yearMax,
    } = req.query; // 从查询参数获取搜索条件  

    const query = new AV.Query('Clothing1');
    // 添加搜索条件  
    if (itemNumber) {
      query.equalTo('itemNumberNum', parseInt(itemNumber, 10));
    }
    if (itemName) {
      query.contains('itemName', itemName);
    }
    if (category) {
      query.contains('category', category);
    }
    if (priceMin || priceMax) {
      // 需要确保 `price` 字段为数字类型  
      if (priceMin) {
        query.greaterThanOrEqualTo('priceNum', parseFloat(priceMin));
      }
      if (priceMax) {
        query.lessThanOrEqualTo('priceNum', parseFloat(priceMax));
      }
    }
    if (yearMin || yearMax) {
      // 需要确保 `price` 字段为数字类型  
      if (yearMin) {
        query.greaterThanOrEqualTo('yearNum', parseInt(yearMin, 10));
      }
      if (yearMax) {
        query.lessThanOrEqualTo('yearNum', parseInt(yearMax, 10));
      }
    }    
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

// 路由：添加服装信息  
router.post('/clothing/add', upload.single('itemPic'), async (req, res) => {
  try {
    // 1. 检查是否提供了物品编号字段  
    const { itemNumber, itemName, sizes } = req.body; // 获取 "物品编号" 字段  
    if (!itemNumber) {
      return res.status(400).json({ success: false, error: '缺少物品编号字段，无法添加被装！' });
    }

    if (!itemName) {
      return res.status(400).json({ success: false, error: '缺少物品名称字段，无法添加被装！' });
    }

    // 2. 定义 Clothing 数据表  
    const Clothing = AV.Object.extend('Clothing1');

    // 3. 查询是否存在相同物品编号的记录  
    const query = new AV.Query(Clothing);
    query.equalTo('itemNumber', Number(itemNumber)); // 检索 "itemNumber" 字段是否与请求体一致  
    const existingRecord = await query.first();
    if (existingRecord) {
      // 如果找到相同物品编号的记录，则返回错误
      return res.status(409).json({
        success: false,
        error: `物品编号 ${itemNumber} 已存在，无法重复添加！`
      });
    }

    // 4. 如果上传了文件，我们需要将其真正写到 LeanCloud  
    let fileUrl = '';
    if (req.file) {
      // 读出文件数据  
      const fileBuffer = fs.readFileSync(req.file.path);
      // 创建 LeanCloud File 对象并上传  
      const avFile = new AV.File(req.file.originalname, fileBuffer);
      await avFile.save();
      fileUrl = avFile.url(); // 可访问的 HTTP URL  

      // 记得删除本地临时文件  
      fs.unlinkSync(req.file.path);
    }

    // 4. 创建新服装记录  
    const clothing = new Clothing();

    // 自动映射请求体中的字段到 Clothing 对象  
    Object.keys(req.body).forEach(key => {
      if (key == 'sizes') {
        // 解析并设置多尺码数据  
        if (sizes) {
          const sizesData = JSON.parse(sizes); // 反序列化 JSON  
          clothing.set('sizes', sizesData);
        }
      } else if (key == 'price') {
        clothing.set(`${key}Num`, Number(req.body[key]) || 0);
        clothing.set(key, Number(req.body[key]) || 0);
      } else if (key == 'warehouseLocation') {
        clothing.set('yearNum', Number(req.body[key]) || 0);
        clothing.set(key, Number(req.body[key]) || 0);
      } else if (key == 'itemNumber') {
        clothing.set(`${key}Num`, Number(req.body[key]) || 0);
        clothing.set(key, Number(req.body[key]) || 0);
      } else if (key == 'itemName' || 'category') {
        clothing.set(key, String(item[key]) || '');
      }
    });


    // 设置图片 URL  
    clothing.set('itemPic', fileUrl || '/images/nopic.jpg'); // 如果没有上传图片，默认为空字符串 

    // 5. 保存服装记录到数据库  
    const savedObject = await clothing.save();
    const data = savedObject.toJSON();
    data.id = savedObject.id; // 保存成功后返回记录 ID  

    // 6. 返回成功响应  
    res.json({ success: true, data });

  } catch (err) {
    // 处理未知错误  
    console.error(err);
    res.status(500).json({ success: false, error: '添加被装失败' });
  }
});

router.get('/clothing/get/:id', async (req, res) => {
  try {
    const query = new AV.Query('Clothing1');
    const clothing = await query.get(req.params.id);
    res.json(clothing.toJSON());
  } catch (err) {
    console.error('获取服装信息失败：', err);
    res.status(404).json({ error: '未找到服装信息！' });
  }
});

router.put('/clothing/update/:id', upload.single('itemPic'), async (req, res) => {
  try {
    const id = req.params.id;
    const query = new AV.Query('Clothing1');
    // 获取待修改的服装记录  
    const clothing = await query.get(req.params.id);

    // 如果有新文件，则上传到 LeanCloud 并替换  
    let fileUrl = clothing.get('itemPic'); // 默认继续用旧的  
    if (req.file) {
      const fileBuffer = fs.readFileSync(req.file.path);
      const avFile = new AV.File(req.file.originalname, fileBuffer);
      await avFile.save();
      fileUrl = avFile.url();
      fs.unlinkSync(req.file.path);
    }

    // 更新字段  
    const updatedData = req.body;
    Object.keys(updatedData).forEach(key => {
      if (key == 'sizes') {
        const sizesData = JSON.parse(updatedData[key]); // 反序列化 JSON  
        clothing.set('sizes', sizesData || '');
      } else if (key == 'price') {
        clothing.set(`${key}Num`, Number(updatedData[key].trim()) || 0);
        clothing.set(key, Number(updatedData[key].trim()) || 0);
      } else if (key == 'warehouseLocation') {
        clothing.set('yearNum', Number(updatedData[key].trim()) || 0);
        clothing.set(key, Number(updatedData[key].trim()) || 0);
      } else if (key == 'itemNumber') {
        clothing.set(`${key}Num`, Number(updatedData[key].trim()) || 0);
        clothing.set(key, Number(updatedData[key].trim()) || 0);
      } else if (key == 'itemName' || 'category') {
        clothing.set(key, String(updatedData[key]) || '');
      }
    });


    // 设置图片 URL  
    clothing.set('itemPic', fileUrl || "/images/nopic.jpg"); // 如果没有上传图片，默认为空字符串    

    // 5. 保存消防员记录到数据库  
    const savedObject = await clothing.save();
    const data = savedObject.toJSON();
    data.id = savedObject.id; // 保存成功后返回记录 ID  

    // 6. 返回成功响应  
    res.json({ success: true, data });

  } catch (err) {
    // 处理未知错误  
    console.error(err);
    res.status(500).json({ success: false, error: '修改服装信息失败' });
  }
});


// 路由：删除服装信息  
router.delete('/clothing/delete/:id', async (req, res) => {
  try {
    const clothing = AV.Object.createWithoutData('Clothing1', req.params.id);
    await clothing.destroy();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: '删除服装失败' });
  }
});

// 路由：导入 Excel 文件预览  
router.post('/clothing/import-preview', upload.single('excelFile'), async (req, res) => {
  try {
    const file = req.file;

    // 使用 xlsx 读取 Excel 文件内容  
    const workbook = xlsx.readFile(file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // 将工作表转换为二维数组  
    const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

    // 第一行为表头  
    const headers = data[1];

    // 映射表头：将中文表头映射为代码变量名  
    const mappedHeaders = headers.map(header => {
      if (columnMapping[header]) {
        return columnMapping[header]; // 使用映射表转换  
      } else {
        // 抛出错误：未映射的字段  
        throw new Error(`表头 "${header}" 没有对应的映射！请检查映射表`);
      }
    });

    // 从第二行开始是数据  
    const previewData = [];
    for (let i = 3; i < data.length; i++) {
      const row = data[i];
      const item = {};

      for (let j = 0; j < headers.length; j++) {
        const header = headers[j];
        const cellValue = row[j];

        item[header] = cellValue;
      }

      previewData.push(item);
    }

    // 删除临时文件  
    fs.unlinkSync(file.path);

    res.status(200).json({ success: true, previewData });
  } catch (err) {
    console.error('文件解析失败:', err);
    res.status(500).json({ success: false, error: '文件解析失败，请检查文件格式是否正确' });
  }
});

// 路由：确认导入数据  
router.post('/clothing/import-confirm', async (req, res) => {
  try {
    const data = req.body.data;

    // 字段名映射  
    const mappedData = data.map(item => {
      const mappedItem = {};
      Object.keys(item).forEach(key => {
        if (columnMapping[key]) {
          mappedItem[columnMapping[key]] = item[key]; // 替换为合法字段名  
        } else {
          console.warn(`字段 "${key}" 在映射表中不存在，已跳过！`);
        }
      });
      return mappedItem;
    });

    // 定义结果  
    const success = [];
    const skipped = [];

    // 遍历数据，物品编号去重检查  
    const Clothing = AV.Object.extend('Clothing1');
    for (let item of mappedData) {
      const { itemNumber } = item; // 获取物品编号字段  

      if (!itemNumber) {
        console.warn("缺少物品编号，跳过该记录！");
        skipped.push({ reason: "缺少物品编号", data: item });
        continue;
      }

      // 在 LeanCloud 中查找是否已有相同物品编号  
      const query = new AV.Query(Clothing);
      query.equalTo('itemNumber', Number(itemNumber));
      const existingRecord = await query.first(); // 查询第一个匹配的记录  

      if (existingRecord) {
        console.error(`物品编号 ${itemNumber} 已存在，跳过保存！`);
        skipped.push({ reason: "物品已存在", data: item }); // 加入跳过列表  
        continue;
      }

      // 编号不存在，创建新的服装记录  
      const clothing = new Clothing();
      Object.keys(item).forEach(key => {
        if (key == 'sizes') {
          // 解析尺码字符串，保存为数组形式  
          const sizesString = item[key]; // 获取原始字符串  
          const sizesArray = sizesString.split(/\r?\n/).filter(line => line.includes(':')).map(sizePair => {
            const [size, quantity] = sizePair.split(':');
            return { size: size.trim(), quantity: parseInt(quantity.trim(), 10) }; // 创建对象  
          });
          clothing.set('sizes', sizesArray); // 保存为 JSON 对象 
        } else if (key == 'remarks') {
          clothing.set(key, String(item[key]) || ''); // 强制转换为字符串  
        } else if (key == 'price') {
          clothing.set(`${key}Num`, Number(item[key]) || 0);
          clothing.set(key, Number(item[key]) || 0);
        } else if (key == 'warehouseLocation') {
          clothing.set('yearNum', Number(item[key]) || 0);
          clothing.set(key, Number(item[key]) || 0);
        } else if (key == 'itemNumber') {
          clothing.set(`${key}Num`, Number(item[key]) || 0);
          clothing.set(key, Number(item[key]) || 0);
        } else if (key == 'itemName' || 'category') {
          clothing.set(key, String(item[key]) || '');
        }
        if (item['itemPic'] === undefined || item['itemPic'] === null || !item['itemPic']) {
          clothing.set('itemPic', "/images/nopic.jpg"); // 显示默认占位符
        }
      });
      await clothing.save(); // 保存记录  
      success.push(clothing); // 保存成功的记录  
    }

    // 返回保存结果  
    res.json({
      success: true,
      message: "数据处理完成",
      saved: success.length,       // 成功保存的数量  
      skipped: skipped.length,     // 被跳过的数量  
      details: { success, skipped } // 成功和跳过的具体记录  
    });
  } catch (err) {
    console.error('数据保存失败：', err);
    res.status(500).json({
      success: false,
      error: '数据保存失败',
      details: err.message
    });
  }
});

// 批量删除接口  
router.post('/clothing/batch-delete', async (req, res) => {

  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: '无效的请求参数' });
    }

    const deletePromises = ids.map(id => {
      const clothing = AV.Object.createWithoutData('Clothing1', id);
      return clothing.destroy();  // 返回删除操作的Promise  
    });

    await Promise.all(deletePromises);  // 等待所有删除操作


    res.json({
      success: true,
      message: '批量删除成功',
      deletedCount: ids.length
    });
  } catch (err) {
    console.error('批量删除失败：', err);
    res.status(500).json({ success: false, error: '批量删除失败' });
  }
});

router.get('/clothing_reports/generate', async (req, res) => {
  try {
    const { number, name, category, startyear, endyear, minprice, maxprice, sortField, sortOrder } = req.query;

    // 根据不同报表类型查询数据  
    let report = [];

    // 查询变更记录表  
    const query = new AV.Query('Clothing1');

    if (number) query.equalTo('itemNumber', Number(number));
    if (name) query.equalTo('itemName', name);
    if (category) query.equalTo('category', category);

    if (startyear) query.greaterThanOrEqualTo('yearNum', Number(startyear));
    if (endyear) query.lessThanOrEqualTo('yearNum', Number(endyear));

    if (minprice) query.greaterThanOrEqualTo('priceNum', Number(minprice));
    if (maxprice) query.lessThanOrEqualTo('priceNum', Number(maxprice));


    // 应用排序  
    if (sortField) {
      if (sortOrder === 'desc') {
        query.descending(sortField);
      } else {
        query.ascending(sortField);
      }
    } else {
      query.ascending('itemNumberNum');
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


router.get('/reports/generatenow_clothing', async (req, res) => {
  try {

    const {
      reportType, itemNumber, itemName, priceMin, priceMax, category, yearMin, yearMax, sortField, sortOrder
    } = req.query;

    // 查询数据  
    let report = [];

    // 查询被装  
    const query = new AV.Query('Clothing1');

    // 添加搜索条件  
    if (itemNumber) {
      query.equalTo('itemNumberNum', parseInt(itemNumber, 10));
    }
    if (itemName) {
      query.contains('itemName', itemName);
    }
    if (category) {
      query.contains('category', category);
    }
    if (priceMin || priceMax) {
      // 需要确保 `price` 字段为数字类型  
      if (priceMin) {
        query.greaterThanOrEqualTo('priceNum', parseFloat(priceMin));
      }
      if (priceMax) {
        query.lessThanOrEqualTo('priceNum', parseFloat(priceMax));
      }
    }
    if (yearMin || yearMax) {
      // 需要确保 `price` 字段为数字类型  
      if (yearMin) {
        query.greaterThanOrEqualTo('yearNum', parseInt(yearMin, 10));
      }
      if (yearMax) {
        query.lessThanOrEqualTo('yearNum', parseInt(yearMax, 10));
      }
    }
    
    
    query.limit(1000); // 设置最大返回数量  

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


router.get('/reports/generateall_clothing', async (req, res) => {
  try {

    const {
      reportType, itemNumber, itemName, priceMin, priceMax, category, yearMin, yearMax, sortField, sortOrder
    } = req.query;

    // 查询数据  
    let report = [];
    
    // 查询消防员  
    const query = new AV.Query('Clothing1');

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