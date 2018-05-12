'use strict';

const express   = require('express');
const app       = express();
const fs        = require('fs');
const riot      = require('riot');
const Module    = require('module');
const path      = require('path');
const fetch     = global.fetch = require('node-fetch');
const cookie    = require('cookie');
const fucss     = require('fucss');

const CLIENT = {
  VIEWS:    [],
  STORES:   [],
  ACTIONS:  [],
  //LIBS:     [],
  SCRIPT:   '',
};

let CFG = {
  // server
  PORT:       process.env.PORT     || 8080,
  IP:         process.env.IP       || 'localhost',
  // environment
  ENV: {
    DEV: false,
    VER: '0.0.1',
    URL: false
  },
  // dirs
  PUB_DIR:     process.cwd() + '/public',
  DEF_DIR:     __dirname + '/default',
  STORE_DIR:   '/store',
  ACTION_DIR:  '/action',
  APP_DIR:     '/app',
  // files
  CLIENT_FILE:     '/riothing.js',
  CONTENT_FILE:    '/data/content.json',
  ROUTES_FILE:     '/data/routes.json',
  ROOT_FILE:       '/root.html',
  STYLE_FILE:      '/style.css',
  // rest
  INCLUDE_CLIENT:       true,
  CLIENTLESS:           false,
  INIT_ACTION_NAME:     'APP_INIT',
  EXTERNAL_ACTION_NAME: 'APP_EXTERNAL',
  TAG_NAME:             'tag-app',
  SERV_STYLE:           true,
};

let riothing, Riothing;

function Setup(cfg, { app, routes }){
  CFG = utils.configure(cfg);
  
  // collects all actions, stores and views including defaults
  return Promise.all([
    utils.compileExtras(CFG.PUB_DIR, CFG.ACTION_DIR, CFG.DEF_DIR),
    utils.compileExtras(CFG.PUB_DIR, CFG.STORE_DIR, CFG.DEF_DIR),
    utils.compileExtras(CFG.PUB_DIR, CFG.APP_DIR, CFG.DEF_DIR, true)
  ])
  .then(([actions, stores, views]) => {
    
    // delivers links for client to print on root
    CLIENT.ACTIONS  = actions.filter(md => md.type !== 'default').map(md  => md.client);
    CLIENT.STORES   = stores.filter(md => md.type !== 'default').map(md   => md.client);
    CLIENT.VIEWS    = views.filter(md => md.type !== 'default').map(md    => md.client);
    
    // returns the function names and extras to execute on client and server including routes
    return {
      actions:  actions.slice().map(md => md.name),
      stores:   stores.slice().map(md => md.name),
      routes:   utils.compileRoutes(CFG.PUB_DIR, CFG.ROUTES_FILE, CFG.DEF_DIR),
      defaults:   [
        actions.filter(md => md.type === 'default').map(md => md.code).join(),
        stores.filter(md => md.type === 'default').map(md => md.code).join(),
        views.filter(md => md.type === 'default').map(md => md.code).join()
      ]
    };
  })
  .then(({ actions, stores, routes, defaults }) => {
    
    //style compilation missing
    
    // compiles and converts client initial function to script string
    CLIENT.SCRIPT = !CFG.CLIENTLESS && utils.getScript(CFG, { actions, stores, routes, defaults });
    
    // compiles root file
    utils.compileRoot(CFG.PUB_DIR, CFG.ROOT_FILE, CFG.DEF_DIR);
    
    return { actions, stores, routes };
  })
  .then(({ actions, stores, routes }) => {
    // initiates Riothing
    Riothing = utils.clientRequire(__dirname + CFG.CLIENT_FILE);
    riothing = new Riothing({ actions, stores, routes, ENV: CFG.ENV });
    
    // Acts on init action and initiates router
    return riothing.act(CFG.INIT_ACTION_NAME, cfg)
      .then(content => utils.router(app, routes, riothing));
  })
}

module.exports = Setup;

module.exports.route = (req, res) => {
  const page  = req.originalUrl.split('/').pop();
  const query = req.query;
  //const cookies = cookie.parse(req.headers.cookie);
  //riothing.act('SET_ROUTE', { page, query, extras: req.originalUrl.split('/') /*cookies*/ });

  res.send(utils.renderHTML(CLIENT));
}

module.exports.render = (req, res) => { res.send(utils.renderHTML(CLIENT)) }

module.exports.server = (cfg) => {
  cfg = cfg || {};
  
  let ENV = {
    DEV: cfg.env  || process.env.NODE_ENV === 'development',
    URL: cfg.url  || process.env.URL || `https://${CFG.IP}:${CFG.PORT}`,
    VER: cfg.ver  || process.env.npm_package_version,
  };
  
  utils.configure(cfg, ENV);
  
  app.use('/', express.static(CFG.PUB_DIR));
  
  /** TODO!!!
    1. Clean dev env and tools (sort this stupid server starting issue. Can everything be moved to riothing. Just include express inside it)
    2. generate css file
    3. Create default actions.js, store.js, root.html inside riothing
    4. sort out route.js issue
  **/
  
  CFG.SERV_STYLE && app.get('/style.css', (req, res) => { 
    res.setHeader('content-type', 'text/css');
    res.send(utils.compileStyle(CFG.PUB_DIR, CFG.STYLE_FILE)) 
  });
  
  if(ENV.DEV){
    //app.use('/packs', express.static( process.cwd() + '../../_packs'));
    app.get('/env', (req, res) => { res.json(ENV) });
    app.use((req, res, next) => {
      ENV.READY ? ENV.SYNC = true : false;
      next();
    });
    app.listen(CFG.PORT, () => utils.message('started dev on ' + ENV.URL));
  }

  Setup(CFG, { app } )
    .then(riothing => {
      ENV.READY = true;
      
      if(ENV.DEV) return;
      app.listen(CFG.PORT, () => utils.message('started production ' + ENV.URL));
      riothing.act(CFG.EXTERNAL_ACTION_NAME);
    });
}

//UTILS
let utils = {};

utils.readDir = (pub, f = '', files) => {
  files = files || [];
  fs.readdirSync(pub + f).forEach(file => {
    
    fs.lstatSync([pub, f, file].join('/')).isDirectory()
      ? utils.readDir(pub, [f, file].join('/'), files)
      : files.push([f, file].join('/'));
      
  });
  //console.log(files);
  return Promise.resolve(files);
}

utils.clientRequire = (filePath, code, include) => {
  filePath  = path.resolve(filePath);
  include   = include || [`var riot = require('riot');`];
  code      = code    || fs.readFileSync(filePath, 'utf8');
  let paths = Module._nodeModulePaths(__dirname);
  if(!code.length)
    return false; new Error(`${filePath} can not be used as a module`);
  code = `
    ${ include.join('\n') }
    module.exports = ${ code }
  `;
	var m = new Module(filePath, module.parent);
	m.filename = filePath;
	m.paths = paths;
	m._compile(code, filePath);
  return m.exports;
};

utils.compileRiot = (filePath, returnStr) => {
  let riotStr = riot.compile(fs.readFileSync(filePath, 'utf8'));
  fucss.storeHTML(riotStr);
  const md = utils.clientRequire(filePath, riotStr);
  return returnStr ? riotStr : md;
};

utils.compileStyle = (pub, file, html) => {
  const cssStr = fucss.generateStyling({
    riot: html || fucss.HTML.join(''),
    returnStyle: true,
    glob: true,
    anim: true
  });
  if(!fs.existsSync(pub + file)){
    utils.message('missing style ' + file + ' in ' + pub);
    //utils.message('setting config to SERV_STYLE = false');
    //CFG.SERV_STYLE = false;
    return cssStr;
  }
  return fs.writeFileSync(pub + file, cssStr) && false;
}
  
utils.compileRoutes = (pub, file, def) => {
  const defaultRoutes = require(def + file);
  if(!fs.existsSync(pub + file)){
    utils.message('missing routes file ' + file + ' in ' + pub);
    return defaultRoutes;
  }
  
  return [].concat(require(pub + file), defaultRoutes).reduce( (arr, item, i, all) => {
    item.route && !arr.find( el => el.route === item.route ) && arr.push(item);
    return arr;
  }, []);
}

utils.compileRoot = (pub, file, def) => {
  if(!fs.existsSync(pub + file)){
    utils.message('loading default root ' + file);
    return utils.compileRiot(def + file)
  }
  
  utils.compileRiot(pub + file)
  
}

utils.compileExtras = (pub, dir, def, views) => {
  var links = [ 
    { path: def, type: 'default' }, 
    { path: pub } 
  ].filter( ({ path, def }) => {
    if(fs.existsSync(path + dir))
      return true;
    utils.message('missing directory ' + dir + ' in ' + path);
  })
  
  return Promise.all( links.map( link => utils.getFiles(link.path, dir, views, link.type) ) )
    .then( ([ defFiles, pubFiles ]) => defFiles.concat(pubFiles || []) )
}

utils.getFiles = (pub, dir, views, type) => {
  
  return utils.readDir(pub + dir)
    .then(files => Promise.all(files.map(file => {
      let fn = views
        ? utils.compileRiot(pub + dir + file, true)
        : utils.clientRequire(pub + dir + file);
        
      return new ExternalModule(dir, file, fn, type);
    })))
    .then(extMods => extMods.filter(extMod => extMod.name))
}

utils.toBase64 = (str) =>
  'data:text/javascript;base64,' + Buffer(str).toString('base64');
  
utils.message = msg => console.warn('[RIOTHING]', msg);

utils.getScript = ({ INCLUDE_CLIENT, CLIENT_FILE, INIT_ACTION_NAME, TAG_NAME, ENV }, { actions, stores, routes, defaults }) => {
  let client = [];
  
  // includes riothing client function 
  INCLUDE_CLIENT && CLIENT_FILE &&
    client.push(fs.readFileSync(__dirname + CLIENT_FILE, 'utf8'));
  
  // includes default app actions, stores and views from default folder
  defaults && client.push(defaults.join(';\n'));
  
  client.push(`
    var riothing = new Riothing({
      actions:  ${JSON.stringify(actions)},
      stores:   ${JSON.stringify(stores)},
      routes:   ${JSON.stringify(routes)},
      ENV:      ${JSON.stringify(ENV)},
    });
    riothing.act('${INIT_ACTION_NAME}', {}).then(content => {
      page('*', (req, next) => {
        req.cookies = Cookies;
        next();
      });
      riothing.routes.forEach(route => page(route.route, riothing.action(route.action)));
      page.start();
      riot.mount('${TAG_NAME}');
    });
  `);

  return utils.toBase64(client.join(';'));
}


utils.renderHTML = (opts, tagName = 'html') => {
  opts = opts || Object.assign({}, CLIENT, CFG);
  return  `
    <!DOCTYPE html>
    ${riot.render(tagName, opts)}
  `;
}

utils.render  = (req, res) => { res.send(res.render()) }
utils.cookies = (req, res, next) => {
  req.cookies = {
    get: (val) => val && cookie.parse(req.headers.cookie || '')[val] || cookie.parse(req.headers.cookie || ''),
    set: console.log
  };
  next();
}

utils.router = (app, routes, riothing) => {
  /** TODO!!!
      1. action chain ability
      2. action as function ability
      3. convert to express router instead of putting dircetly to app
          "this would give us ability to mount multiple riothing apps with different routes"
  **/
  app.response.render = utils.renderHTML;
  routes.forEach(route =>
    route.route && app[route.method || 'get'](route.route || '/', [
      utils.cookies,
      (req, res, next) => {
        return riothing.action(route.action)(req, res).then( () => utils.render(req, res))
      }
    ])
  );
  return riothing;
}

utils.configure = (cfg, env) => {
  env = env || CFG.ENV;
  Object.assign(CFG, cfg, { ENV: env });
  return CFG;
}

function ExternalModule(dir, file, fn, type){
  this.client = '.' + dir + file;
  this.fn   = typeof fn === 'function' && fn;
  this.code = typeof fn === 'function' ? fn.toString() : typeof fn === 'string' && fn;
  this.name = this.fn && fn.name || fn;
  if(this.fn) global[this.name] = this.fn;
  if(type) this.type = type;

  return this;
}

module.exports.utils = utils;
