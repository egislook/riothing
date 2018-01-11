'use strict';

const fs        = require('fs');
const riot      = require('riot');
const Module    = require('module');
const path      = require('path');
//const cookie    = require('cookie');


let riothing, Riothing, content;

const ROOT  = {
  VIEWS:  [],
  STORES: [],
  CLIENT: '',
};

let CFG = {
  pub:      './../public/',
  client:   '/riothing.js',
  content:  '/content.json',
  storeDir: '/store',
  appDir:   '/app',
  root:     '/root.html'
};

exports.renderHTML    = renderHTML;
exports.clientRequire = clientRequire;
exports.initViews     = initViews;
exports.compileRiot   = compileRiot;
exports.route         = route;
exports.reinit        = reinit;
exports.config        = config;

function config(cfg){
  Object.assign(CFG, cfg);
  CFG.pubPath   = path.resolve(CFG.pub);
  Riothing      = clientRequire(__dirname + CFG.client);
  riothing      = new Riothing();
  content       = CFG.content && !content && require(path.resolve(CFG.pub + CFG.content));

  return init(CFG.pub, ROOT);
}

function reinit(req, res){
  config().then(() => route(req, res));
}

function route(req, res){
  const page = req.originalUrl.split('/').pop();
  const query = req.query;
  //const cookies = cookie.parse(req.headers.cookie);
  riothing.act('SET_ROUTE', { page, query, extras: req.originalUrl.split('/') /*cookies*/ });

  res.send(renderHTML(ROOT));
}

function init(pubPath, root){
  initStores(pubPath + '/store').then((stores) => {

    Promise.all(stores.map( (store) => riothing.setStore(store.fn(Object.assign({}, content))) ))
      .then( (strs) => strs.map( store => store.init(content) ) )

    root.STORES = stores.map((store) => ({
      name: store.name,
      path: store.path.replace(pubPath, '.')
    }));
  });

  return initViews(pubPath + '/app').then((views) => {
    compileRiot(pubPath + '/root.html');
    root.VIEWS = views.paths.map((path) => path.replace(pubPath, '.'));
  });
}

// function init({ pub, storeDir, appDir, root }){
//   if(storeDir && !fs.existsSync(pub + storeDir))
//     console.log(`WARNING: "store" dir does not exist in ${pub}`);
//   else{
//     initStores(pub + storeDir).then((stores) => {

//       Promise.all(stores.map( (store) => riothing.setStore(store.fn(Object.assign({}, content))) ))
//         .then( (strs) => strs.map( store => store.init(content) ) )

//       root.STORES = stores.map((store) => ({
//         name: store.name,
//         path: store.path.replace(pub, '.')
//       }));
//     });
//   }

//   if(!fs.existsSync(pub + root))
//     return console.log(`WARNING: "root" file does not exist in ${pub}`)
//   else
//     compileRiot(pub + root);

//   if(!fs.existsSync(pub + appDir))
//     console.log(`WARNING: "app" dir does not exist in ${pub}`);
//   else
//     return initViews(pub + appDir).then((views) => {
//       root.VIEWS = views.paths.map((path) => path.replace(pub, '.'));
//     });
// }

function initStores(dir = './public/store'){
  return readDir(path.resolve(dir)).then((files) =>
    files.map((filename) => {
      let _filePath = `${path.resolve(dir)}/${filename}`;
      let fn = clientRequire(_filePath);
      return {
        path: _filePath,
        filename,
        fn,
        name: fn.name,
      };
    })
  );
}

function initViews(dir, skipViewFiles){
  const viewPaths = [];

  return collectViews(dir, viewPaths).then(() => {
    return Promise
      .all(viewPaths.slice(0).map(compileRiot))
      .then((viewNames) => ({
        paths: viewPaths,
        names: viewNames
      }));
  });
}

function toBase64(str){
  return 'data:text/javascript;base64,' + Buffer(str).toString('base64');
}

function renderHTML(opts, tagName = 'html'){
  opts = opts || ROOT;
  let stores = opts.STORES && opts.STORES.slice().map(store => store.name) || [];
  let client = fs.readFileSync(__dirname + CFG.client, 'utf8');
  opts.CLIENT = toBase64(`new Riothing({ stores: ${JSON.stringify(stores)}, state: '/content.json' });`);
  return  `
    <!DOCTYPE html>
    ${riot.render(tagName, opts)}
  `;
}

function compileRiot(filePath){
  return clientRequire(filePath, riot.compile(fs.readFileSync(filePath, 'utf8')));
}

function clientRequire(filePath, code, include){
  filePath = path.resolve(filePath);
  include = include || [`var riot = require('riot');`];
  code = code || fs.readFileSync(filePath, 'utf8');
  let paths = Module._nodeModulePaths(__dirname);
  code = `
    ${ include.join('\n') }
    module.exports = ${ code }
  `;
	var m = new Module(filePath, module.parent);
	m.filename = filePath;
	m.paths = paths;
	m._compile(code, filePath);
  return m.exports;
}

function readDir(dir){
  return new Promise((resolve, reject) => {
    fs.readdir(dir, (err, files) => err ? reject(err) : resolve(files));
  });
}

function collectViews(dir, views){
  return new Promise((resolve, reject) => {
    readDir(dir).then((files) =>
      Promise.all(files.map((filename) => storeFilePath(filename, dir, views)))
    ).then(resolve).catch(reject);
  });
}

function validateView(filePath, extensions = ['html', 'tag']){
  return extensions.indexOf(filePath.split('.').pop()) >= 0
}

 function storeFilePath(filename, dir, views){
  let _filePath   = `${dir}/${filename}`;
  let _fileStats  = fs.lstatSync(_filePath);

  if(!!_fileStats.isDirectory())
    return collectViews(_filePath, views);


  validateView(_filePath) && views.push(_filePath);

  return _filePath;
}
