'use strict';

const fs        = require('fs');
const riot      = require('riot');
const Module    = require('module');
const path      = require('path');
const fetch     = global.fetch = require('node-fetch');
//const cookie    = require('cookie');

const CLIENT = {
  VIEWS:    [],
  STORES:   [],
  ACTIONS:  [],
  SCRIPT:   '',
};
let riothing, Riothing;

function Setup(cfg){
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
    ROOT_FILE:       '/root.html',
    // rest
    INCLUDE_CLIENT:     true,
    INIT_ACTION_NAME:   'INIT_APP',
  };

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
      actions: actions.slice().map(md => md.name),
      stores: stores.slice().map(md => md.name)
    };
  })
  .then(({ actions, stores }) => {
    CLIENT.SCRIPT = utils.getScript(CFG.INCLUDE_CLIENT && CFG.CLIENT_FILE, { actions, stores }, CFG.INIT_ACTION_NAME, cfg);
    utils.compileRiot(CFG.PUB_DIR + CFG.ROOT_FILE);
    return { actions, stores };
  })
  .then(({ actions, stores }) => {
    Riothing = utils.clientRequire(__dirname + CFG.CLIENT_FILE);
    riothing = new Riothing({ actions, stores, DEV: CFG.DEV, VER: CFG.VER });
    riothing.act(CFG.INIT_ACTION_NAME, cfg);
    //console.log(utils.renderHTML(CLIENT));
    return riothing;
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

utils.compileRiot = (filePath) =>
  utils.clientRequire(filePath, riot.compile(fs.readFileSync(filePath, 'utf8')));

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

utils.getScript = (clientPath, { actions, stores }, initActionName = 'INIT_APP', { DEV, VER }) => {
  let client = [];
  clientPath && client.push(fs.readFileSync(__dirname + clientPath, 'utf8'));
  client.push(`
    var riothing = new Riothing({
      stores:   ${JSON.stringify(stores)},
      actions:  ${JSON.stringify(actions)},
      DEV:      ${DEV},
      VER:      ${VER}
    });
    riothing.act('${initActionName}', {});
  `);
  return utils.toBase64(client.join(';'));
}


utils.renderHTML = (opts, tagName = 'html') => {
  opts = opts || CLIENT;
  return  `
    <!DOCTYPE html>
    ${riot.render(tagName, opts)}
  `;
}

function ExternalModule(dir, file, fn){
  this.client = '.' + dir + file;
  this.fn = typeof fn === 'function' && fn;
  this.name = this.fn && fn.name || fn;
  if(this.fn) global[this.name] = this.fn;

  return this;
}

module.exports.utils = utils;
