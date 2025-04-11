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
  "单位": "team",
  "工作年限": "year",
  "帽类号": "maoleihao",
  "服装号": "fuzhuanghao",
  "鞋类号": "xieleihao",
  "身高": "shengao",
  "胸围": "xiongwei",
  "腰围": "yaowei",
  "头围": "touwei",
  "可用余额": "keyongyue",
  "经费来源": "经费来源",
  "备注": "remarks"
};


router.get('/firefighters', (req, res) => {
  if (!req.session.user) {  
    return res.redirect('/login');  
}  
  res.render('firefighters', { user: req.session.user }); // 调用 firefighters.ejs  
});

router.get('/template/firefighters_template.xlsx', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/template/firefighters_template.xlsx'));
});


// 配置 multer，用于处理文件上传  
const upload = multer({ dest: 'uploads/' });


// 获取消防员列表，支持搜索  
router.get('/firefighters/list', async (req, res) => {
  try {
    const {
      number,
      name,
      gender,
      ageMin,
      ageMax,
      position,
      team,
      year,
    } = req.query; // 从查询参数获取搜索条件  

    const query = new AV.Query('Firefighter');

    // 添加搜索条件  
    if (number) {
      query.equalTo('number', number);
    }
    if (name) {
      query.contains('name', name);
    }
    if (gender) {
      query.equalTo('gender', gender);
    }
    if (position) {
      query.contains('position', position);
    }
    if (team) {
      query.contains('team', team);
    }
    if (year) {
      query.contains('year', year);
    }
    if (ageMin || ageMax) {
      // 需要确保 `age` 字段为数字类型  
      if (ageMin) {
        query.greaterThanOrEqualTo('ageNum', parseInt(ageMin, 10));
      }
      if (ageMax) {
        query.lessThanOrEqualTo('ageNum', parseInt(ageMax, 10));
      }
    }

    query.limit(1000); // 设置最大返回数量  
    const results = await query.find();

    const data = results.map(item => {
      const attrs = item.toJSON();
      attrs.id = item.id; // 获取对象的id
      console.log('查询返回的id数据为', attrs.id);
      return attrs;
    });

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '获取消防员列表失败' });
  }
});


// 添加消防员  
router.post('/firefighters/add', async (req, res) => {
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
    data.id = savedObject.id; // 保存成功后返回记录 ID  

    // 6. 返回成功响应  
    res.json({ success: true, data });

  } catch (err) {
    // 处理未知错误  
    console.error(err);
    res.status(500).json({ success: false, error: '添加消防员失败' });
  }
});


// 获取单个消防员信息
router.get('/firefighters/get/:id', async (req, res) => {
  try {
    const id = req.params.id;
    console.log('get到的id为:', id)
    const query = new AV.Query('Firefighter');
    const firefighter = await query.get(id);

    if (!firefighter) {
      return res.status(404).json({ error: '未找到消防员信息' });
    }
    res.json(firefighter.toJSON()); // 将消防员信息返回  
  } catch (err) {
    console.error('获取消防员信息失败：', err);
    res.status(500).json({ error: '服务器错误，请稍后重试！' });
  }
});


// 更新消防员信息  
router.put('/firefighters/update/:id', async (req, res) => {
  try {
    // 2. 定义 Firefighter 数据表  

    const id = req.params.id; // 要更新的记录 ID  
    const data_update = req.body;
    const { modalNumber } = data_update;

    // 1. 检查编号是否唯一（除去当前记录外）  
    const numberQuery = new AV.Query('Firefighter');
    numberQuery.equalTo('number', String(modalNumber)); // 查询是否有相同的编号  
    numberQuery.notEqualTo('objectId', id); // 排除当前记录  

    // 执行查询  
    const existingItem = await numberQuery.first();

    // 2. 如果找到重复记录，返回错误信息  
    if (existingItem) {
      return res.json({
        success: false,
        error: '消防员编号已存在，将执行更新信息操作！',
      });
    };

    // 3. 获取当前记录并更新  
    const query = new AV.Query('Firefighter');
    const item = await query.get(id); // 根据 ID 获取记录  

    // 更新字段  
    // 自动映射请求体中的字段到 Firefighter 对象  
    // 在保存数据时添加数值字段  
    Object.keys(data_update).forEach(key => {
      if (['age', 'shengao', 'xiongwei', 'yaowei', 'touwei'].includes(key)) {
        item.set(key, String(data_update[key]) || '');
        item.set(`${key}Num`, Number(data_update[key]) || 0);
      } else {
        item.set(key, String(data_update[key]));
      }
    });


    // 5. 保存消防员记录到数据库  
    const savedObject = await item.save();
    const data = savedObject.toJSON();
    data.id = savedObject.id; // 保存成功后返回记录 ID  

    // 6. 返回成功响应  
    res.json({ success: true, data });

  } catch (err) {
    // 处理未知错误  
    console.error(err);
    res.status(500).json({ success: false, error: '修改消防员信息失败' });
  }
});

// 删除消防员  
router.delete('/firefighters/delete/:id', async (req, res) => {
  try {
    const firefighter = AV.Object.createWithoutData('Firefighter', req.params.id);
    await firefighter.destroy();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: '删除消防员失败' });
  }
});

// 导入Excel文件预览  
router.post('/firefighters/import-preview', upload.single('excelFile'), async (req, res) => {
  try {
    const file = req.file;

    // 使用 xlsx 读取 Excel 文件内容  
    const workbook = xlsx.readFile(file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // 将工作表转换为二维数组  
    const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

    // 第二行为表头  
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


    // 第四行及之后是数据  
    const previewData = [];
    for (let i = 3; i < data.length; i++) {
      const row = data[i];
      const item = {};

      for (let j = 0; j < headers.length; j++) {
        const header = headers[j];
        const cellValue = row[j];

        // 检查是否是日期序列号  
        if (header === '出生年月') {
          // 将日期序列号转换为标准日期  
          const parsedDate = xlsx.SSF.parse_date_code(cellValue);
          item[header] = `${parsedDate.y}-${String(parsedDate.m).padStart(2, '0')}-${String(parsedDate.d).padStart(2, '0')}`;
        } else {
          item[header] = cellValue;
        }
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

// 确认导入数据  
router.post('/firefighters/import-confirm', async (req, res) => {
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

    //console.log("经过映射后的数据为：", mappedData);  

    // 定义结果  
    const success = [];
    const skipped = [];

    // 遍历数据，编号去重检查  
    const Firefighter = AV.Object.extend('Firefighter');
    for (let item of mappedData) {
      const { number } = item; // 获取编号字段  

      if (!number) {
        console.warn("缺少编号，跳过该记录！");
        skipped.push({ reason: "缺少编号", data: item });
        continue;
      }

      // 在 LeanCloud 中查找是否已有相同编号  
      const query = new AV.Query(Firefighter);
      query.equalTo('number', String(number));
      const existingRecord = await query.first(); // 查询第一个匹配的记录  

      if (existingRecord) {
        console.error(`编号 ${number} 人员已存在，跳过保存！`);
        skipped.push({ reason: "人员已存在", data: item }); // 加入跳过列表  
        continue;
      }

      // 编号不存在，创建新的消防员记录  
      const firefighter = new Firefighter();
      // 在保存数据时添加数值字段  
      Object.keys(item).forEach(key => {
        if (['age', 'shengao', 'xiongwei', 'yaowei', 'touwei'].includes(key)) {
          firefighter.set(key, String(item[key]) || '');
          firefighter.set(`${key}Num`, Number(item[key]) || 0);
        } else {
          firefighter.set(key, String(item[key]));
        }
      });


      await firefighter.save(); // 保存记录  
      success.push(firefighter); // 保存成功的记录  
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

// 批量删除消防员  
router.post('/firefighters/batch-delete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: '无效的请求参数' });
    }

    const deletePromises = ids.map(id => {
      const firefighter = AV.Object.createWithoutData('Firefighter', id);
      return firefighter.destroy();
    });

    await Promise.all(deletePromises);

    res.json({
      success: true,
      message: '批量删除成功',
      deletedCount: ids.length
    });
  } catch (err) {
    console.error('批量删除失败:', err);
    res.status(500).json({ success: false, error: '批量删除失败' });
  }
});

// 批量更新消防员单位  
router.post('/firefighters/batch-update-team', async (req, res) => {
  try {
    const { updates } = req.body;
    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ success: false, error: '无效的请求参数' });
    }

    const updatePromises = updates.map(update => {
      const { id, team } = update;
      const firefighter = AV.Object.createWithoutData('Firefighter', id);
      firefighter.set('team', team);
      return firefighter.save();
    });

    await Promise.all(updatePromises);

    res.json({
      success: true,
      message: '批量更新单位成功',
      updatedCount: updates.length
    });
  } catch (err) {
    console.error('批量更新单位失败:', err);
    res.status(500).json({ success: false, error: '批量更新单位失败' });
  }
});

// 添加变更记录到Change表  
router.post('/changes/add', async (req, res) => {
  try {
    const { changes } = req.body;
    if (!changes || !Array.isArray(changes) || changes.length === 0) {
      return res.status(400).json({ success: false, error: '无效的请求参数' });
    }

    const Change = AV.Object.extend('Change');
    const savePromises = changes.map(change => {
      const newChange = new Change();
      Object.keys(change).forEach(key => {
        newChange.set(key, change[key]);
      });
      return newChange.save();
    });

    await Promise.all(savePromises);

    res.json({
      success: true,
      message: '添加变更记录成功',
      addedCount: changes.length
    });
  } catch (err) {
    console.error('添加变更记录失败:', err);
    res.status(500).json({ success: false, error: '添加变更记录失败' });
  }
});


router.get('/reports/generate', async (req, res) => {
  try {
    const {
      reportType, teamFilter,
      gender, ageMin, ageMax, position, yearMin, yearMax,
      hatSize, clothingSize, shoeSize,
      heightMin, heightMax, chestMin, chestMax, waistMin, waistMax, headMin, headMax,
      startDate, endDate, oldTeam,
      sortField, sortOrder
    } = req.query;

    // 根据不同报表类型查询数据  
    let report = [];

    if (reportType === 'changeHistory') {
      // 查询变更记录表  
      const query = new AV.Query('Change');

      // 应用日期过滤  
      if (startDate) {
        const start = new Date(startDate);
        query.greaterThanOrEqualTo('changeDate', start.toISOString().split('T')[0]);
      }
      if (endDate) {
        const end = new Date(endDate);
        query.lessThanOrEqualTo('changeDate', end.toISOString().split('T')[0]);
      }

      // 应用单位过滤  
      if (teamFilter) {
        query.equalTo('newTeam', teamFilter);
      }

      // 应用原单位过滤  
      if (oldTeam) {
        query.equalTo('oldTeam', oldTeam);
      }

      // 应用排序  
      if (sortField) {
        if (sortOrder === 'desc') {
          query.descending(sortField);
        } else {
          query.ascending(sortField);
        }
      } else {
        query.ascending('changeDate');
      }

      // 执行查询  
      const results = await query.find();
      report = results.map(item => item.toJSON());

    } else {
      // 查询消防员表  
      const query = new AV.Query('Firefighter');

      // 应用单位过滤  
      if (teamFilter) {
        query.equalTo('team', teamFilter);
      }

      // 应用性别过滤  
      if (gender) {
        query.equalTo('gender', gender);
      }

      // 应用年龄过滤  
      if (ageMin) {
        query.greaterThanOrEqualTo('ageNum', parseInt(ageMin, 10));
      }
      if (ageMax) {
        query.lessThanOrEqualTo('ageNum', parseInt(ageMax, 10));
      }

      // 应用职务过滤  
      if (position) {
        query.equalTo('position', position);
      }

      // 根据报表类型应用特定过滤条件  
      if (reportType === 'equipment') {
        if (hatSize) query.equalTo('maoleihao', hatSize);
        if (clothingSize) query.equalTo('fuzhuanghao', clothingSize);
        if (shoeSize) query.equalTo('xieleihao', shoeSize);
      }

      // 在查询时使用数值字段  
      if (reportType === 'bodySize') {
        if (heightMin) query.greaterThanOrEqualTo('shengaoNum', Number(heightMin));
        if (heightMax) query.lessThanOrEqualTo('shengaoNum', Number(heightMax));
        if (chestMin) query.greaterThanOrEqualTo('xiongweiNum', Number(chestMin));
        if (chestMax) query.lessThanOrEqualTo('xiongweiNum', Number(chestMax));
        if (waistMin) query.greaterThanOrEqualTo('yaoweiNum', Number(waistMin));
        if (waistMax) query.lessThanOrEqualTo('yaoweiNum', Number(waistMax));
        if (headMin) query.greaterThanOrEqualTo('touweiNum', Number(headMin));
        if (headMax) query.lessThanOrEqualTo('touweiNum', Number(headMax));
      }

      // 应用排序  
        if (sortField) {
          // 如果提供了排序字段，按照指定字段排序  
          if (sortOrder === 'desc') {
            query.descending(sortField);
          } else {
            query.ascending(sortField);
          }
        } else {
          if (reportType === 'teamSummary') {
            query.ascending('team');
          } else {
          // 没有提供排序字段时，根据报表类型应用默认排序
          query.ascending('number');
        }
      }

      // 执行查询并处理不同报表类型的特殊逻辑  
      const results = await query.find();

      let filteredResults = results; // 默认使用原始结果

      if (reportType === 'personnel') {
        // 处理筛选条件  
        if (yearMin || yearMax) {
          filteredResults = results.filter(item => {
            const yearValue = item.get('year');
            if (!yearValue) return false;

            // 处理数据值  
            let yearNum;
            if (yearValue === "10年含以上" || yearValue === "10 年含以上") {
              yearNum = 10; // 将"10年含以上"视为10  
            } else {
              yearNum = parseInt(yearValue.replace(/[^0-9]/g, ''), 10);
            }

            let minNum;
            // 处理最小年限筛选条件  
            if (yearMin) {

              if (yearMin === "10年含以上" || yearMin === "10 年含以上") {
                minNum = 10;
              } else {
                minNum = parseInt(yearMin.replace(/[^0-9]/g, ''), 10);
              }

              if (yearNum < minNum) return false;
            }

            let maxNum;
            // 处理最大年限筛选条件  
            if (yearMax) {

              if (yearMax === "10年含以上" || yearMax === "10 年含以上") {
                // 如果最大值设为"10年含以上"，意味着要包含所有>=10的值  
                // 所以只要数据值>=10就符合条件，此处不额外筛选  
                if (yearNum < minNum) return false;
              } else {
                maxNum = parseInt(yearMax.replace(/[^0-9]/g, ''), 10);

                if (yearNum > maxNum) return false;
              }
            }
            return true;
          });
          console.log('filteredResults结果：', filteredResults);
        }
        report = filteredResults.map(item => item.toJSON());
      } else {

        if (reportType === 'teamSummary') {
          // 生成单位统计报表  
          const teamStats = {};

          results.forEach(item => {
            const data = item.toJSON();
            const team = data.team || '未分配';

            if (!teamStats[team]) {
              teamStats[team] = {
                team: team,
                total: 0,
                male: 0,
                female: 0,
                ageSum: 0
              };
            }

            teamStats[team].total++;
            if (data.gender === '男') {
              teamStats[team].male++;
            } else if (data.gender === '女') {
              teamStats[team].female++;
            }

            if (data.age) {
              teamStats[team].ageSum += parseInt(data.age, 10);
            }
          });

          // 计算平均年龄并格式化为报表数据  
          report = Object.values(teamStats).map(stat => {
            return {
              team: stat.team,
              total: stat.total,
              male: stat.male,
              female: stat.female,
              avgAge: stat.total > 0 ? (stat.ageSum / stat.total).toFixed(1) : 0
            };
          });

          // 按总人数排序         
          // 应用排序  
          if (sortField) {
            if (sortOrder === 'desc') {
              report.sort((a, b) => b[sortField] - a[sortField]);
            } else {
              report.sort((a, b) => a[sortField] - b[sortField]);
            }
          } else {
            report.sort((a, b) => b.total - a.total);
          }
        } else {
          report = results.map(item => item.toJSON());
        }
      }
    };

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