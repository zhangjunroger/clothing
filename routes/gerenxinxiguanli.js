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
    "警衔": "rank",  
    "气候区": "climateZone",  
    "帽类号": "maoleihao",  
    "服装号": "fuzhuanghao",  
    "鞋类号": "xieleihao",  
    "作训 冬帽号": "zuoxundongmaohao",  
    "毛衣 冬服号": "maoyidongfuhao",  
    "大衣 冬鞋号": "dayidongxiehao",  
    "衬衣号": "chenyihao",  
    "肩章号": "jianzhanghao",  
    "雨衣 体服号": "yuyitifuhao",  
    "礼服": "lifu",  
    "常服": "changfu",  
    "裤裙": "kuqun",  
    "身高": "shengao",  
    "胸围": "xiongwei",  
    "腰围": "yaowei",  
    "头围": "touwei",  
    "领围": "lingwei",  
    "脚长": "jiaochang",  
    "跖围": "zhiwei",  
    "入伍日期": "ruwuriqi",  
    "一级士官": "yijishiguan",  
    "二级士官": "erjishiguan",  
    "提干日期": "tiganriqi",  
    "现职日期": "xianzhiriqi",  
    "现衔日期": "xianxianriqi",  
    "职级": "zhiji",  
    "形类": "xinglei",  
    "备注": "remarks"  
  };


router.get('/gerenxinxiguanli', (req, res) => {  
    res.render('dashboard'); // 调用 firefighters.ejs  
});


// 添加消防员  
router.post('/gerenxinxiguanli/add', async (req, res) => {  
    try {   
      // 1. 检查字段是否存在（防止编号字段不完整）  
      const { number } = req.body; // 获取 "编号" 字段
      if (!number) {  
        return res.status(400).json({ success: false, error: '缺少编号字段，无法添加消防员！' });  
      }  
      // 2. 定义 Firefighter 数据表  
      const Firefighter = AV.Object.extend('Firefighter');  
      
      // 3. 查询是否存在相同编号的记录  
      const query = new AV.Query(Firefighter);  
      query.equalTo('number', String(number)); // 检索 "number" 字段是否与请求体一致  
      const existingRecord = await query.first();  
      if (existingRecord) {  
        // 如果找到相同编号的记录，则返回错误  
        return res.status(409).json({   
          success: false,   
          error: `编号 ${number} 人员已存在，无法重复添加！`   
        });  
      }  
  
      // 4. 创建新消防员记录  
      const firefighter = new Firefighter();  
  
      // 自动映射请求体中的字段到 Firefighter 对象  
      Object.keys(req.body).forEach(key => {  
        if (key === 'age') {  
          firefighter.set(key, String(req.body[key]) || ''); // 强制转换为字符串
          firefighter.set('ageNum', Number(req.body[key]) || ''); // 强制转换为字符串  
        } else {  
          firefighter.set(key, String(req.body[key]));  
        }  
      });  
  
      // 5. 保存消防员记录到数据库  
      const savedObject = await firefighter.save();  
      const data = savedObject.toJSON();  
      data.id = savedObject.id; // 保存成功后返回记录 ID  
  
      // 6. 返回成功响应  
      res.json({ success: true, data });  
  
    } catch (err) {  
      // 处理未知错误  
      console.error(err);  
      res.status(500).json({ success: false, error: '保存信息失败' });  
    }  
  });
// 导出路由  
module.exports = router;  