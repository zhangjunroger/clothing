// 全局的前端交互逻辑  

// 示例：页面加载时检查用户是否已登录，未登录则跳转到登录页  
window.addEventListener('load', () => {  
    fetch('/api/check-login')  
      .then(response => response.json())  
      .then(data => {  
        if (!data.loggedIn) {  
          window.location.href = '/login';  
        }  
      })  
      .catch(err => console.error(err));  
  });