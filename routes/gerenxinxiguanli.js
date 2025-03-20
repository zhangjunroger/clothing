const express = require('express');
const router = express.Router();
const AV = require('leancloud-storage');
const multer = require('multer');
const xlsx = require('xlsx');
const fs = require('fs'); // 文件系统模块
const path = require('path');

const columnMapping = {
  "编号": "number",
  "姓名": "name",
  "性别": "gender",
  "出生年月": "birthDate",
  "年龄": "age",
  "职务": "position",
  "中队": "team",
  "工作年限": "year",
  "帽类号": "maoleihao",
  "服装号": "fuzhuanghao",
  "鞋类号": "xieleihao",
  "身高": "shengao",
  "胸围": "xiongwei",
  "腰围": "yaowei",
  "头围": "touwei",
  "备注": "remarks"
};


router.get('/gerenxinxiguanli', (req, res) => {
  if (!req.session.user) {  
    return res.redirect('/login');  
}  
  res.render('dashboard', { user: req.session.user }); // 调用 firefighters.ejs  
});



// 根据用户名获取消防员信息  
router.get('/gerenxinxiguanli/fetch', async (req, res) => {
  try {
    const { number } = req.query;
    if (!number) {
      return res.status(400).json({
        success: false,
        error: '缺少 number 参数'
      });
    }

    // 定义 Firefighter 数据表  
    const Firefighter = AV.Object.extend('Firefighter');
    const query = new AV.Query(Firefighter);

    // 假设 Firefighter 表里存储了 "username" 字段  
    query.equalTo('number', number);

    const record = await query.first();
    if (!record) {
      // 数据库里没查到记录  
      return res.json({
        success: false,
        error: '未找到与该用户名对应的消防员信息'
      });
    }

    // 查到记录，将数据返回给前端  
    const data = record.toJSON();
    return res.json({
      success: true,
      data
    });
  } catch (err) {
    console.error('查询 Firefighter 出错:', err);
    return res.status(500).json({
      success: false,
      error: '查询失败'
    });
  }
});


// 添加或更新消防员详细 
router.post('/gerenxinxiguanli/add', async (req, res) => {
  try {
    // 1. 检查字段是否存在（防止编号字段不完整）  
    const { number } = req.body; // 获取 "编号" 字段  
    if (!number) {
      return res.status(400).json({
        success: false,
        error: '缺少编号字段，无法创建或更新消防员！'
      });
    }

    // 2. 定义 Firefighter 数据表  
    const Firefighter = AV.Object.extend('Firefighter');

    // 3. 查询是否存在相同编号的记录  
    const query = new AV.Query(Firefighter);
    query.equalTo('number', String(number));
    let existingRecord = await query.first(); // 有可能返回null  

    // 如果记录不存在，就创建新对象；如果记录存在，则在原对象上更新字段  
    let firefighter;
    if (!existingRecord) {
      // 不存在这个编号 → 新增  
      firefighter = new Firefighter();
    } else {
      // 已存在这个编号 → 更新  
      firefighter = existingRecord;
    }

    // 4. 自动映射请求体中的字段到 Firefighter 对象，  
    //    注意保留原先对 age / ageNum 的处理  
    // 在保存数据时添加数值字段  
    Object.keys(req.body).forEach(key => {
      if (['age', 'shengao', 'xiongwei', 'yaowei', 'touwei'].includes(key)) {
        firefighter.set(key, String(req.body[key]) || '');
        firefighter.set(`${key}Num`, Number(req.body[key]) || 0);
      } else {
        firefighter.set(key, String(req.body[key]));
      }
    });

    // 5. 保存消防员记录到数据库  
    const savedObject = await firefighter.save();
    const data = savedObject.toJSON();
    data.id = savedObject.id; // 保存成功后返回记录ID  

    // 6. 返回成功响应  
    res.json({
      success: true,
      data: {
        msg: existingRecord
          ? `编号 ${number} 的信息已更新成功！`
          : `编号 ${number} 的消防员已创建成功！`,
        ...data
      }
    });

  } catch (err) {
    // 处理未知错误  
    console.error(err);
    res.status(500).json({
      success: false,
      error: '创建/更新信息失败'
    });
  }
});
// 导出路由  
module.exports = router;  