'use strict';

const DEV       = true;
const express   = require('express');
const app       = express();
const fs        = require('fs');
const riot      = require('riot');
const Module    = require('module');
const path      = require('path');
const fetch     = global.fetch = require('node-fetch');
const cookie    = require('cookie');

const marked    = global.marked = require('marked');
const fucss     = global.fucss  = require('fucss'); //DEV ? require('../fucss/fucss.js') :

const CLIENT = {
  VIEWS:    [],
  STORES:   [],
  ACTIONS:  [],
  //LIBS:     [],
  SCRIPT:   '',
  DATA:     false
};

const SERVER = {
  ACTIONS: [],
  STORES:  [],
  VIEWS:   [],
};

let STYLE;

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
  // directories
  PUB_DIR:      process.cwd() + '/public',
  DEF_DIR:      __dirname + '/default',
  STORE_DIR:    '/store',
  ACTION_DIR:   '/action',
  DATA_DIR:     '/data',
  APP_DIR:      '/app',
  MD_DIR:       '/md',
  // files
  CLIENT_FILE:     '/riothing.js',
  ROOT_FILE:       '/root.html',
  STYLE_FILE:      '/style.css',
  // rest
  INCLUDE_CLIENT:       true,
  CLIENTLESS:           false,
  SERV_STYLE:           true,
  AUTO_ROUTER:          true,
  // tags
  TAG_NAME:               'tag-app',
  DEF_STORE_NAME:         'def',
  PAGE_NAME_SEP:          'page-',
  // action names
  INIT_DEF_ACTION_NAME:   'DEF_INIT',
  DEF_ROUTE_ACTION_NAME:  'DEF_SET_ROUTE',
  INIT_ACTION_NAME:       'APP_INIT',
  INIT_DATA_ACTION_NAME:  'APP_INIT_DATA',
  EXTERNAL_ACTION_NAME:   'APP_EXTERNAL',
};

let Riothing;

function Setup(cfg){
  CFG       = utils.configure(cfg);
  Riothing  = utils.clientRequire(__dirname + CFG.CLIENT_FILE);

  // collects all actions, stores and views including defaults
  return Promise.all([
    utils.compileWithDefaults(CFG.PUB_DIR, CFG.ACTION_DIR, CFG.DEF_DIR),
    utils.compileWithDefaults(CFG.PUB_DIR, CFG.STORE_DIR, CFG.DEF_DIR),
    utils.compileWithDefaults(CFG.PUB_DIR, CFG.APP_DIR, CFG.DEF_DIR, true),
  ])
  .then(([actions, stores, views]) => {
    // delivers links for client to print on root
    CLIENT.ACTIONS  = actions.filter(md => md.type !== 'default').map(md  => md.client);
    CLIENT.STORES   = stores.filter(md => md.type !== 'default').map(md   => md.client);
    CLIENT.VIEWS    = views.filter(md => md.type !== 'default').map(md    => md.client);
    // returns the function names and extras to execute on client and server including routes
    SERVER.ACTIONS  = actions.slice().map(md => md.name);
    SERVER.STORES   = stores.slice().map(md => md.name);
    SERVER.VIEWS    = views.filter(md => md.type !== 'default').map(md => md.name);

    return {
      defaults: [
        actions.filter(md => md.type === 'default').map(md => md.code).join(),
        stores.filter(md => md.type === 'default').map(md => md.code).join(),
        views.filter(md => md.type === 'default').map(md => md.code).join('\n')
      ]
    };
  })
  .then(({ defaults }) => {
    // style compilation missing
    // compiles and converts client initial function to script string
    CLIENT.SCRIPT = !CFG.CLIENTLESS && utils.getScript(CFG, {
      actions:  SERVER.ACTIONS,
      stores:   SERVER.STORES,
      defaults
    });

    // compiles root file
    utils.compileRoot(CFG.PUB_DIR, CFG.ROOT_FILE, CFG.DEF_DIR);
    return;
  })
  .then( () =>
    utils.compileAndMerge(CFG.PUB_DIR, CFG.DATA_DIR, CFG.DEF_DIR)
      .then( data => Object.assign(data, { ENV: CFG.ENV }) )
  )
  .then( data => utils.getFiles(CFG.PUB_DIR, CFG.MD_DIR, false, 'markdown')
    .then( markdown => markdown.reduce( (obj, md) => Object.assign(obj, { [md.name]: md.text }), {})  )
    .then( markdown => Object.assign(data, { markdown }) )
    .catch( err => console.log(err) && data)
  )
  .then( data => CFG.AUTO_ROUTER ? utils.autoRouteGenerator(data, CFG) : data)
  .then( data => {
    // Init client data
    CLIENT.DATA = data;
    // Init Riothing
    const riothing = new Riothing({
      actions:  SERVER.ACTIONS,
      stores:   SERVER.STORES,
      ENV:      CFG.ENV
    });

    return riothing.act(CFG.INIT_DEF_ACTION_NAME, data)
      .then( data => riothing.act(CFG.INIT_ACTION_NAME, data))
      .then( data => utils.router(data, riothing))

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

function server(cfg) {
  cfg = cfg || {};

  let ENV = {
    DEV: cfg.env  || process.env.NODE_ENV === 'development',
    URL: cfg.url  || process.env.URL || `https://${CFG.IP}:${CFG.PORT}`,
    VER: cfg.ver  || process.env.npm_package_version,
    GQ:  cfg.gq,
    FETCHER: cfg.fetcher,
    CFG: cfg,
  };

  // Gets manifest
  const manifestDefaultPath = CFG.DEF_DIR + '/data/manifest.json';
  const manifestClientPath = CFG.PUB_DIR + '/data/manifest.json';
  const manifest = fs.readFileSync(fs.existsSync(manifestClientPath) ? manifestClientPath : manifestDefaultPath).toString();

  // Configuring the app
  utils.configure(cfg, ENV);

  // console.log({ cfg });

  // Serving static files
  app.use('/', express.static(CFG.PUB_DIR));
  app.use('/def/', express.static(CFG.DEF_DIR + '/img'));

  // Serving style
  CFG.SERV_STYLE && app.get('/style.css', (req, res) => {
    res.setHeader('content-type', 'text/css');
    STYLE = STYLE || utils.compileStyle(CFG.PUB_DIR, CFG.STYLE_FILE);
    res.send(STYLE);
  });

  CFG.pwa && app.get('/manifest.json', (req, res) => { res.setHeader('content-type', 'application/json'); res.send(manifest) });
  CFG.pwa && app.get('/sw.js', (req, res) => { res.setHeader('content-type', 'application/javascript'); res.send(`self.addEventListener('fetch', (event) => {});`) });

  let getServer

  if(ENV.DEV){
    app.get('/env', (req, res) => { res.json(ENV) });
    app.use((req, res, next) => {
      ENV.READY ? ENV.SYNC = true : false;
      next();
    });
    getServer = () => app.listen(CFG.PORT, () => utils.message('started dev on ' + ENV.URL));
  }

  return start()

  function start(){
    return Setup(CFG, { app } )
      .then(riothing => {
        ENV.READY = true;

        getServer = getServer || (() => app.listen(CFG.PORT, () => {
          utils.message('started production ' + ENV.URL)
        }));

        let serv = getServer();

        if(!CFG.reload)
          return riothing;

        const reload = parseFloat(CFG.reload || 1);

        utils.message('Reloading Server in ' + reload + ' Minutes');
        setTimeout(() => {
          // utils.message('Reloading Server in ' + reload + ' Minutes');
          serv.close(() => {
            // serv = getServer()
            // CLIENT.VIEWS    = [];
            CLIENT.STORES   =  [];
            // CLIENT.ACTIONS  =  [];
            // CLIENT.SCRIPT   =   '';
            // CLIENT.DATA     = false;

            // SERVER.ACTIONS = []
            SERVER.STORES = [];
            // SERVER.VIEWS = [];
            start()
          });
        }, reload * 60000);
        return riothing;
      });
  }


  return Setup(CFG, { app } )
    .then(riothing => {
      ENV.READY = true;

      if(!CFG.reload)
        return riothing;

      getServer = getServer || (() => app.listen(CFG.PORT, () => {
        utils.message('started production ' + ENV.URL)
      }));

      const reload = parseInt(CFG.reload || 1);

      let serv = getServer();
      utils.message('Reloading Server in ' + reload + ' Minutes');
      setInterval(() => {
        utils.message('Reloading Server in ' + reload + ' Minutes');
        serv.close(() => { serv = getServer() });
      }, reload * 60000);
      return riothing;
    });
}

module.exports.server = server;

//UTILS
let utils = {};

utils.readDir = (pub, f = '', files) => {
  files = files || [];
  if(!fs.existsSync(pub + f))
    return Promise.resolve(files);

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
  include   = include || [`var riot = require('riot')`];
  code      = code    || fs.readFileSync(filePath, 'utf8');
  let paths = Module._nodeModulePaths(__dirname);
  if(!code.length)
    return false; new Error(`${filePath} can not be used as a module`);
  code = `
    ${ include.join(';\n') }
    module.exports = ${ code }
  `;
	var m = new Module(filePath, module.parent);
	m.filename = filePath;
	m.paths = paths;
	m._compile(code, filePath);
  return m.exports;
};

utils.compileRiot = (filePath, returnStr) => {
  let fn = riot.compile(fs.readFileSync(filePath, 'utf8'));
  fucss.storeHTML(fn);
  const name = utils.clientRequire(filePath, fn);
  return !returnStr ? name : { fn, name };
};

utils.compileStyle = (pub, file, html) => {
  CLIENT.DATA.classBody && fucss.storeHTML(CLIENT.DATA.classBody);

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

  let routes = [].concat(require(pub + file), defaultRoutes);

  return routes.reduce( (arr, item, i, all) => {
    (item.route || item.view || item.name) && !arr.find( el => item.route && el.route === item.route ) && arr.push(item);
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

utils.compileAndMerge = (pub, dir, def, isPubFirst) => {
  return utils.compileWithDefaults(pub, dir, def, false, !isPubFirst)
    .then( mds => mds.reduce( (obj, item) => {
      // skip default config
      if(obj['meta'] && item.name === 'config' && item.type === 'default')
        return obj;
      const value = obj[item.name];

      if(value && value.constructor === Array){
        obj[item.name] = value.concat(item.data[item.name]);

        if(item.name === 'routes'){
          obj[item.name] = obj[item.name].reduce( (arr, item) => {
            !arr.find( el => item.route && el.route === item.route ) && arr.push(item);
            return arr;
          }, []);

          return obj;
        }
      }
      return Object.assign(obj, item.data);
    }, {} ));
}

utils.compileWithDefaults = (pub, dir, def, isViews, isPubFirst) => {
  var links = [
    { path: def, type: 'default' },
    { path: pub }
  ].filter( ({ path, def }) => {
    if(fs.existsSync(path + dir))
      return true;
    utils.message('missing directory ' + dir + ' in ' + path);
  });

  links = isPubFirst ? links.reverse() : links;

  return Promise.all( links.map( link => utils.getFiles(link.path, dir, isViews, link.type) ) )
    .then( ([ defFiles, pubFiles ]) => defFiles.concat(pubFiles || []))
}

utils.getFiles = (pub, dir, views, type) => {

  return utils.readDir(pub + dir)
    .then(files => Promise.all(files.map(file => {

      if(type === 'markdown'){
        const text = fs.readFileSync(pub + dir + file, 'utf8');
        return new ExternalModule(dir, file, null, type, text)
      }

      if(views){
        const md = utils.compileRiot(pub + dir + file, true);
        return new ExternalModule(dir, file, md.fn, type, false, md.name);
      }

      return new ExternalModule(dir, file, utils.clientRequire(pub + dir + file), type);
    })))
    .then(extMods => extMods.filter(extMod => extMod.name))
}

utils.toBase64 = (str) =>
  'data:text/javascript;base64,' + Buffer(str).toString('base64');

utils.message = msg => console.warn('[RIOTHING]', msg);

utils.getScript = (
  { INCLUDE_CLIENT, CLIENT_FILE, INIT_ACTION_NAME, TAG_NAME, ENV, INIT_DEF_ACTION_NAME, DEF_STORE_NAME, DEF_ROUTE_ACTION_NAME, pwa },
  { actions, stores, defaults }
) => {
  let client = [];

  // includes riothing client function
  INCLUDE_CLIENT && CLIENT_FILE &&
    client.push(fs.readFileSync(__dirname + CLIENT_FILE, 'utf8'));

  // includes default app actions, stores and views from default folder
  defaults && client.push(defaults.join(';\n'));
  pwa && client.push(`
    if('serviceWorker' in window.navigator){
      window.navigator.serviceWorker.register('/sw.js').then(
        ({ scope }) => console.log('[RT] ServiceWorker registered ', scope),
        (err) =>  console.wran('[RT]ServiceWorker failed: ', err)
      )
    }
  `);

  client.push(`
    var riothing = new Riothing({
      actions:  ${JSON.stringify(actions)},
      stores:   ${JSON.stringify(stores)},
      ENV:      ${JSON.stringify(ENV)},
    });
    riot.settings.autoUpdate = false;
    marked.setOptions({ headerIds: false });
    riothing.act('${INIT_DEF_ACTION_NAME}', window.DATA)
      .then(data => riothing.act('${INIT_ACTION_NAME}', data))
      .then(content => {

        page('*', (req, next) => {
          req.cookies = Cookies;
          req.hash = riothing.utils.qs(window.location.hash.replace('#', ''));
          req.query = riothing.utils.qs(req.querystring);
          window.ga && window.ga('set', 'page', window.location.pathname);
          window.ga && window.ga('send', 'pageview');
          next();
        });

        const routes = riothing.store('${DEF_STORE_NAME}').get('routes');
        routes.forEach( ({ route, method, actions }) => route && page(route, req => {
          riothing.action('${DEF_ROUTE_ACTION_NAME}')({ route, req })
            .then( state => state && riothing.act('DEF_RESTATE') );
        }));
        page.start();
      });
  `);

  return utils.toBase64(client.join(';'));
}


utils.renderHTML = (state, tagName = 'html') => {
  const opts = Object.assign({ state }, CLIENT, CFG);

  if(opts.DATA && state.meta)
    opts.DATA = Object.assign(opts.DATA, { meta: state.meta });

  let html =  (`
    <!DOCTYPE html>
    ${riot.render(tagName, opts)}
  `);

  // includes data
  if(opts.DATA)
    html = html.replace('</head>', `<script> window.DATA = ${JSON.stringify(opts.DATA)} </script></head>`)
  return html;
}

utils.render  = (req, res) => { res.send(res.render()) }
utils.cookies = (req, res, next) => {
  req.cookies = {
    get: (val) => val && cookie.parse(req.headers.cookie || '')[val] || cookie.parse(req.headers.cookie || ''),
    set: console.log
  };
  next();
}

utils.router = (data, riothing) => {
  app.response.render = utils.renderHTML;
  /** TODO!!!
      2. action as function ability
      3. convert to separate express routers instead of using * dircetly on app
          "this would give us ability to mount multiple riothing apps with different routes"
  **/

  const extracted = riothing.extract();
  const routes    = riothing.store(CFG.DEF_STORE_NAME).get('routes');

  routes.forEach( ({ route, method, actions }) =>
    route && app[method || 'get'](route || '/', [
      utils.cookies,
      //(req, res, next) => { riothing.restate(); return next() },
      (req, res, next) => {
        req.riothing = new Riothing({
          actions:  SERVER.ACTIONS,
          stores:   SERVER.STORES,
          ENV:      CFG.ENV
        });
        req.riothing.restate(extracted);
        next();
      },
      (req, res, next) => {
        req.riothing.action(CFG.DEF_ROUTE_ACTION_NAME)({ route, req, res })
          .then( state => state && next() )
      },
      (req, res, next) => {
        actions = actions || ['APP_ROUTE'];
        actions = typeof actions === 'string' ? [actions] : actions;
        req.riothing.utils.promiseChain(actions.map( action => req.riothing.action(action, { redirect: res.redirect.bind(res) }) ))
          .then( data => res.send(res.render(data)) )
          .catch( err => console.log('[RT]', err) );
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

utils.autoRouteGenerator = (data, { PAGE_NAME_SEP }) => {
  data.markdown && Object.keys(data.markdown)
    .filter( md => !data.routes.find( route => route.md === md ))
    .forEach( md => data.routes.unshift({
      name: md,
      md,
      splash: true,
    }));

  data.routes && SERVER.VIEWS
    .filter( view => view.includes(PAGE_NAME_SEP) && !data.routes.find( route => ~['page-main', route.view].indexOf(view) ))
    .forEach( view => {
      const name = view.replace(PAGE_NAME_SEP, '');
      data.routes.unshift({
        route: '/' + name,
        view,
        name,
        //actions: ['APP_ROUTE'],
      });
    });

  return data;
}

function ExternalModule(dir, file, fn, type, text, name){
  this.client = dir + file;
  this.fn   = typeof fn === 'function' && fn;
  this.code = typeof fn === 'function' ? fn.toString() : typeof fn === 'string' && fn;
  this.data = typeof fn === 'object' && fn;
  this.name = name || typeof fn === 'string' && fn || (fn && fn.name) || file.replace('/', '').replace('.json', '').replace('.md', '');

  if(this.fn)
    global[this.name] = this.fn;

  if(type)
    this.type = type;

  if(text)
    this.text = text;

  //console.log(this.data.constructor, file)
  if(this.data && (this.data.constructor === Array || Object.keys(this.data).length > 4))
    this.data = { [this.name]: this.data };

  return this;
}

module.exports.utils = utils;
