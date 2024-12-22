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

// 路由：访问服装管理页面  
router.get('/clothing', (req, res) => {  
    res.render('clothing'); // 调用 clothing.ejs 模板  
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

// 路由：添加服装信息  
router.post('/clothing/add', async (req, res) => {  
  try {  
    // 1. 检查是否提供了物品编号字段  
    const { itemNumber } = req.body; // 获取 "物品编号" 字段  
    if (!itemNumber) {  
      return res.status(400).json({ success: false, error: '缺少物品编号字段，无法添加服装！' });  
    }  

    // 2. 定义 Clothing 数据表  
    const Clothing = AV.Object.extend('Clothing');  
    
    // 3. 查询是否存在相同物品编号的记录  
    const query = new AV.Query(Clothing);  
    query.equalTo('itemNumber', String(itemNumber)); // 检索 "itemNumber" 字段是否与请求体一致  
    const existingRecord = await query.first();  
    if (existingRecord) {  
      // 如果找到相同物品编号的记录，则返回错误  
      return res.status(409).json({   
        success: false,   
        error: `物品编号 ${itemNumber} 已存在，无法重复添加！`   
      });  
    }  

    // 4. 创建新服装记录  
    const clothing = new Clothing();  

    // 自动映射请求体中的字段到 Clothing 对象  
    Object.keys(req.body).forEach(key => {  
      if (key === 'remarks') {  
        clothing.set(key, String(req.body[key]) || ''); // 强制转换为字符串  
      } else {  
        clothing.set(key, String(req.body[key]));  
      }  
    });  

    // 5. 保存服装记录到数据库  
    const savedObject = await clothing.save();  
    const data = savedObject.toJSON();  
    data.id = savedObject.id; // 保存成功后返回记录 ID  

    // 6. 返回成功响应  
    res.json({ success: true, data });  

  } catch (err) {  
    // 处理未知错误  
    console.error(err);  
    res.status(500).json({ success: false, error: '添加服装失败' });  
  }  
});  

router.get('/clothing/get/:id', async (req, res) => {  
  try {  
    const query = new AV.Query('Clothing');  
    const clothing = await query.get(req.params.id); 
    console.log('后端获得的服装信息为：', clothing) 
    res.json(clothing.toJSON());  
  } catch (err) {  
    console.error('获取服装信息失败：', err);  
    res.status(404).json({ error: '未找到服装信息！' });  
  }  
});

router.put('/clothing/update/:id', async (req, res) => {  
  try {  
    const id = req.params.id;  
    const query = new AV.Query('Clothing'); 
    // 获取待修改的服装记录  
    const clothing = await query.get(req.params.id); 

    // 更新字段  
    const updatedData = req.body;  
    Object.keys(updatedData).forEach(key => {  
      clothing.set(key, String(updatedData[key]));  
    });  

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
    const clothing = AV.Object.createWithoutData('Clothing', req.params.id);  
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
    const Clothing = AV.Object.extend('Clothing');  
    for (let item of mappedData) {  
      const { itemNumber } = item; // 获取物品编号字段  

      if (!itemNumber) {  
        console.warn("缺少物品编号，跳过该记录！");  
        skipped.push({ reason: "缺少物品编号", data: item });  
        continue;  
      }  

      // 在 LeanCloud 中查找是否已有相同物品编号  
      const query = new AV.Query(Clothing);  
      query.equalTo('itemNumber', itemNumber);  
      const existingRecord = await query.first(); // 查询第一个匹配的记录  

      if (existingRecord) {  
        console.error(`物品编号 ${itemNumber} 已存在，跳过保存！`);  
        skipped.push({ reason: "物品已存在", data: item }); // 加入跳过列表  
        continue;  
      }  

      // 编号不存在，创建新的服装记录  
      const clothing = new Clothing();  
      Object.keys(item).forEach(key => {  
        if (item[key] !== undefined && item[key] !== null) {  
          if (key === 'remarks') {  
            clothing.set(key, String(item[key]) || ''); // 强制转换为字符串  
          } else {  
            clothing.set(key, String(item[key])); // 设置每个字段  
          }   
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

// 导出路由  
module.exports = router;