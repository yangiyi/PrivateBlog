const queryString = require('querystring');
const handleBlogRouter = require('./src/router/blog');
const handleUserRouter = require('./src/router/user');
const { get, set } = require('./src/db/redis');

// const SESSION_DATA = {}

// 获取cookie的过期时间
const getCookieExpires = () => {
  const d = new Date();
  d.setTime(d.getTime() + (24 * 60 * 60 * 1000));
  return d.toGMTString();
}

const getPostData = (req) => {
  const promise = new Promise((resolve, reject) => {
    if(req.method !== 'POST') {
      resolve({});
      return
    }
    if(req.headers['content-type'] !== 'application/json') {
      resolve({});
      return
    }
    let postData = '';
    req.on('data', chunk => {
      postData += chunk.toString();
    })
    req.on('end', () => {
      if(!postData) {
        resolve({});
        return
      }
      resolve(JSON.parse(postData))
    })
  })
  return promise;
}

const serverHandle = (req, res) => {
  // 设置返回格式 JSON
  res.setHeader('Content-type', 'application/json');

  // 获取path
  const url = req.url;
  req.path = url.split('?')[0];

  req.query = queryString.parse(url.split('?')[1]);

  // 解析cookie
  req.cookie = {};
  const cookieStr = req.headers.cookie || '';
  cookieStr.split(';').forEach(item => {
    if(!item) return void 0;
    const arr = item.split('=');
    const key = arr[0].trim();
    const val = arr[1].trim();
    req.cookie[key] = val;
  });

  // 解析session
  // let needSetCookie = false;
  // let userId = req.cookie.userid;
  // if(userId) {
  //   if(!SESSION_DATA[userId]) {
  //     SESSION_DATA[userId] = {};
  //   }
  // } else {
  //   needSetCookie = true
  //   userId = `${Date.now()}_${Math.random()}`
  //   SESSION_DATA[userId] = {};
  // }
  // req.session = SESSION_DATA[userId]

  // 解析session 使用redis
  let needSetCookie = false;
  let userId = req.cookie.userid;
  if(!userId) {
    needSetCookie = true;
    userId = `${Date.now()}_${Math.random()}`;
    // 初始化redis中的session值
    set(userId, {});
  }
  // 获取session
  req.sessionId = userId
  get(req.sessionId).then(sessionData => {
    if(sessionData == null) {
      // 初始化session
      set(req.sessionId, {})
      // 设置session
      req.session = {};
    } else {
      req.session = sessionData;
    }
    console.log('req.session', req.session);
    
    // 处理postdata
    return getPostData(req)
  }).then(postData => {
    req.body = postData;

    // 处理blog路由
    // const blogData = handleBlogRouter(req, res);
    // if(blogData) {
    //   res.end(
    //     JSON.stringify(blogData)
    //   )
    //   return
    // }

    const blogResult = handleBlogRouter(req, res);
    if(blogResult) {
      blogResult.then(blogData => {
        if(needSetCookie) {
          res.setHeader('Set-Cookie', `userid=${userId}; path=/; httpOnly; expires=${getCookieExpires()}`);
        }
        res.end(JSON.stringify(blogData));
      })
      return;
    }

    // 处理user路由
    // const userData = handleUserRouter(req, res);
    // if(userData) {
    //   res.end(
    //     JSON.stringify(userData)
    //     // JSON.stringify({
    //     //   errno: 0,
    //     //   data: {},
    //     //   message: 'XXX'
    //     // })
    //   )
    //   return
    // }

    const userResult = handleUserRouter(req, res);
    if(userResult) {
      userResult.then(userData => {
        if(needSetCookie) {
          res.setHeader('Set-Cookie', `userid=${userId}; path=/; httpOnly; expires=${getCookieExpires()}`);
        }
        res.end(JSON.stringify(userData));
      })
      return;
    }
    // 未命中，返回404
    res.writeHead(404, {"Content-type": 'text/plain'})
    res.write('404 Not Find')
    res.end()
  })
}

module.exports = serverHandle;