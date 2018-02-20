'use strict';

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

const CFG = {
  //NODE_ENV
  DEV: false,
  VER: '0.0.1',
  // dirs
  PUB_DIR:     './../public/',
  STORE_DIR:   '/store',
  ACTION_DIR:  '/action',
  APP_DIR:     '/app',
  // files
  CLIENT_FILE:     '/riothing.js',
  CONTENT_FILE:    '/content.json',
  ROUTES_FILE:     '/routes.json',
  ROOT_FILE:       '/root.html',
  STYLE_FILE:      '/style.css',
  // rest
  INCLUDE_CLIENT:   true,
  CLIENTLESS:       false,
  INIT_ACTION_NAME: 'INIT_APP',
  TAG_NAME:         'tag-app',
  SERV_STYLE:       true,
};

let riothing, Riothing;

function Setup(cfg, { app, routes }){
  Object.assign(CFG, cfg);

  return Promise.all([
    utils.getFiles(CFG.PUB_DIR, CFG.ACTION_DIR),
    utils.getFiles(CFG.PUB_DIR, CFG.STORE_DIR),
    utils.getFiles(CFG.PUB_DIR, CFG.APP_DIR, true)
  ])
  .then(([actions, stores, views]) => {
    CLIENT.ACTIONS  = actions.slice().map(md  => md.client);
    CLIENT.STORES   = stores.slice().map(md   => md.client);
    CLIENT.VIEWS    = views.slice().map(md    => md.client);
    return {
      actions:  actions.slice().map(md => md.name),
      stores:   stores.slice().map(md => md.name),
      routes:   routes,
    };
  })
  .then(({ actions, stores, routes }) => {
    CLIENT.SCRIPT = !CFG.CLIENTLESS && utils.getScript(CFG, { actions, stores, routes });
    utils.compileRiot(CFG.PUB_DIR + CFG.ROOT_FILE);
    CFG.SERV_STYLE && CFG.DEV && utils.compileStyle(CFG.PUB_DIR + CFG.STYLE_FILE);
    return { actions, stores, routes };
  })
  .then(({ actions, stores, routes }) => {
    Riothing = utils.clientRequire(__dirname + CFG.CLIENT_FILE);
    riothing = new Riothing({ actions, stores, DEV: CFG.DEV, VER: CFG.VER });
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

module.exports.render = (req, res) => {res.send(utils.renderHTML(CLIENT))}

//UTILS
let utils = {};

utils.readDir = (pub, f = '', files) => {
  files = files || [];
  fs.readdirSync(pub + f).forEach(file => {
    if(fs.lstatSync([pub, f, file].join('/')).isDirectory())
      utils.readDir(pub, [f, file].join('/'), files)
    else
      files.push([f, file].join('/'));
  });
  //console.log(files);
  return Promise.resolve(files);
}

utils.clientRequire = (filePath, code, include) => {
  filePath  = path.resolve(filePath);
  include   = include || [`var riot = require('riot');`];
  code      = code || fs.readFileSync(filePath, 'utf8');
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

utils.compileRiot = (filePath) => {
  let riotStr = riot.compile(fs.readFileSync(filePath, 'utf8'));
  fucss.storeHTML(riotStr);
  return utils.clientRequire(filePath, riotStr);
};

utils.compileStyle = (filePath, html) =>
  fs.writeFileSync(filePath, fucss.generateStyling({
    riot: html || fucss.HTML.join(''),
    returnStyle: true,
    glob: true,
    anim: true
  }));

utils.getFiles = (pub, dir, views) => {
  return utils.readDir(pub + dir)
    .then(files => Promise.all(files.map(file => {
      let fn = views
        ? utils.compileRiot(pub + dir + file)
        : utils.clientRequire(pub + dir + file);

      return new ExternalModule(dir, file, fn);
    })))
    .then(extMods => extMods.filter(extMod => extMod.name))
}

utils.toBase64 = (str) =>
  'data:text/javascript;base64,' + Buffer(str).toString('base64');

utils.getScript = ({ INCLUDE_CLIENT, CLIENT_FILE, INIT_ACTION_NAME, DEV, VER, TAG_NAME }, { actions, stores, routes }) => {
  let client = [];

  if(INCLUDE_CLIENT && CLIENT_FILE)
    client.push(fs.readFileSync(__dirname + CLIENT_FILE, 'utf8'));

  client.push(`
    var riothing = new Riothing({
      stores:   ${JSON.stringify(stores)},
      actions:  ${JSON.stringify(actions)},
      routes:   ${JSON.stringify(routes)},
      DEV:      ${DEV},
      VER:      '${VER}'
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
      riothing.action(route.action),
      utils.render
    ])
  );
  return riothing;
}

function ExternalModule(dir, file, fn){
  this.client = '.' + dir + file;
  this.fn = typeof fn === 'function' && fn;
  this.name = this.fn && fn.name || fn;
  if(this.fn) global[this.name] = this.fn;

  return this;
}

module.exports.utils = utils;
