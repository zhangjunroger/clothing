#!/usr/bin/env node

   const app = require('../app');
   const http = require('http');

   // 获取端口，默认端口为 3000
   const port = process.env.PORT || 3000;
   app.set('port', port);

   // 创建 HTTP 服务器
   const server = http.createServer(app);

   // 启动服务器并监听指定端口
   server.listen(port, () => {
       console.log('=================================');
       console.log(`🚀 服务器运行在: http://localhost:${port}`);
       console.log('=================================');
   });

   // 服务器错误事件处理
   server.on('error', onError);

   // 错误处理函数
   function onError(error) {
       if (error.syscall !== 'listen') {
           throw error;
       }

       const bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port;

       // 根据错误代码处理错误
       switch (error.code) {
           case 'EACCES':
               console.error(`${bind} 需要更高的权限`);
               process.exit(1);
               break;
           case 'EADDRINUSE':
               console.error(`${bind} 被占用`);
               process.exit(1);
               break;
           default:
               throw error;
       }
   }