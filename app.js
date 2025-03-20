const express = require('express');  
const AV = require('leancloud-storage');  
const bodyParser = require('body-parser');  
const cookieParser = require('cookie-parser');  
const session = require('express-session');  
const path = require('path'); 
require('dotenv').config();


// 初始化LeanCloud应用  
AV.init({  
  appId: 'ap1jWf86xdNQTqMhv2qk8GYL-gzGzoHsz',  
  appKey: 'ozFs9SEQnA7xosBbyOaSO6Fx',
  masterKey: '7fjqvsZqmJeo5NXCJcis6oYU', 
  serverURL: 'https://avoscloud.com' // 如果有自定义域名  
});  


// 初始化 Express 应用  
const app = express();  

// 解析 JSON 请求体  
app.use(express.json());  
app.use(express.urlencoded({ extended: true })); 


// 配置中间件  
app.use(bodyParser.json());  
app.use(bodyParser.urlencoded({ extended: false }));  
app.use(cookieParser());  
app.use(session({  
    secret: process.env.SESSION_SECRET || 'your-secret-key',  
    resave: false,  
    saveUninitialized: true  
})); 


// 设置视图引擎  
app.set('views', path.join(__dirname, 'views'));  
app.set('view engine', 'ejs');  

// 配置静态文件服务  
app.use(express.static(path.join(__dirname, 'public')));  


// 启用 masterKey  
AV.Cloud.useMasterKey();  

// 注册路由  
const indexRouter = require('./routes/index');  
const adminRouter = require('./routes/admin');  
const usersRouter = require('./routes/users');
const firefightersRouter = require('./routes/firefighters');  
const clothingRouter = require('./routes/clothing');  
const reportsRouter = require('./routes/reports');
const gerenxinxiguanliRouter = require('./routes/gerenxinxiguanli');   
const shenlingRouter = require('./routes/shenling'); 
const shenheRouter = require('./routes/shenhe'); 
const passwordResetRoutes = require('./routes/password-reset');

app.use('/', usersRouter); 
app.use('/', indexRouter);  
app.use('/admin', adminRouter); 
// 挂载路由  
app.use('/', firefightersRouter); // 消防员管理模块  
app.use('/', clothingRouter);         // 服装管理模块  
app.use('/', reportsRouter);           // 统计报表模块
app.use('/', gerenxinxiguanliRouter);           // 个人信息管理模块  
app.use('/', shenlingRouter);           // 申领模块  
app.use('/', shenheRouter);           // 审核模块
app.use('/', passwordResetRoutes);           // 忘记密码模块


app.use('/firefighters/template', express.static(path.join(__dirname, 'public/template')));
app.use('/clothing/template', express.static(path.join(__dirname, 'public/template')));
app.use('/clothing/nopic', express.static(path.join(__dirname, 'public/images')));

// 404 处理  
app.use((req, res, next) => {  
  res.status(404).send('404 - Not Found');  
});  

// 错误处理  
app.use((err, req, res, next) => {  
  console.error(err.stack);  
  res.status(500).json({  
      error: process.env.NODE_ENV === 'production'   
          ? 'Internal Server Error'   
          : err.message  
  });  
});


// 启动服务器  
const PORT = process.env.PORT || 3000;  
app.listen(PORT, () => {  
    console.log('=================================');  
    console.log(`🚀 服务器运行在: http://localhost:${PORT}`);  
    console.log('=================================');  
});  


module.exports = app;

