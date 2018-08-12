function Riothing(cfg){
  
  const SERVER = this.SERVER = typeof module === 'object';
  const CLIENT = this.CLIENT = !SERVER;
  const ENV    = this.ENV    = cfg.ENV;
  const DEV    = this.DEV    = cfg.ENV.DEV;

  this.utils = new RiothingUtils(this);
  
  CLIENT && this.utils.initReqAnimFrame();

  riot.observable(this);

  this.routes       = cfg.data && cfg.data.routes;
  this.actionNames  = [];
  this.storeNames   = [];
  this.actions      = {};
  this.stores       = {};


  this.store  = (storeName)   => this.stores[storeName];
  this.action = (actionName, data)  => {
    if(!this.actions[actionName])
      return (() => console.warn(actionName + ' action does not exist'));
    
    return data ? e => this.actions[actionName](data, e) : this.actions[actionName];
  }
    
  this.act = (actionName, payload, cb) => {
    const action = this.actions[actionName];
    actionName !== 'LINK' && this.utils.log('act', actionName, !action && 'missing' || '');
    return action 
      ? this.actions[actionName](payload, cb) 
      : Promise.resolve('missing action ' + actionName);
  }
  
  this.restate = data => this.storeNames.forEach( storeName => this.store(storeName).restate(data) );
  
  this.extract = combine => this.storeNames.reduce( (obj, storeName) => {
      const state = this.utils.cloneObject(this.store(storeName).get(), true);
      return Object.assign(obj, combine ? { [storeName]: state } : state )
    }, {});

  this.track = this.on;

  init.bind(this)(cfg);

  //console.log(this);

  function init({ actions, stores, data }){
    //init riothing mixin
    riot.mixin(globalMixin(this));
    riot.mixin('riothing', riothingMixin(this));
    //init actions & stores
    initActions.bind(this)(actions);
    initStores.bind(this)(stores, data);
  }

  function initActions(actions){
    actions.forEach(actionFileName => {
      const actionFunction = SERVER
        ? global[actionFileName]
        : parent[actionFileName];

      if(!actionFunction)
        return console.warn(`"${actionFileName}" does not have function`);

      let acts = actionFunction();

      for(let actionName in acts){
        this.actions[actionName] = acts[actionName].bind(this);
        this.actionNames = this.actionNames.concat([ actionName ]);
      }
    });
  }

  function initStores(stores, data){
    stores.forEach(storeFileName => {
      const storeFunction = SERVER
        ? global[storeFileName]
        : parent[storeFileName];

      if(!storeFunction)
        return console.warn(`"${storeFileName}" does not have function`);

      let store = storeFunction();

      this.stores[store.name] = new riothingStore(store.name, store, this);
      this.storeNames = this.storeNames.concat([ store.name ]);
    });
  }
  
  function globalMixin(self){
    return {
      init: function(){
        
        this.SERVER = self.SERVER;
        this.act    = self.act;
        this.action = self.action;
        this.utils  = self.utils;
        
        
        // merge opts
        if(this.opts.opts){
          updateOpts.bind(this)();
          this.on('update', updateOpts.bind(this));
        }
        
        
        // Animation
        this.on('before-unmount', () => {
      
          if(typeof window === 'undefined' || !this.opts.classanim)
            return;
            
          const clone       = this.root.cloneNode(true);
          const parentNode  = this.root.parentNode;
          
          parentNode.insertBefore(clone, parentNode.children[0]);
          
          animate(clone, parentNode, this.opts.classanim);
          
          function animate(clone, parentNode, classname){
            setTimeout(function(){
              clone.className += ' ' + classname;
              //console.log(parentNode.children);
              setTimeout(function(){ parentNode.removeChild(clone) }, 450);
            }, 1);
          }
          
        })
        
        function updateOpts(){
          const opts = Object.assign(this.opts, this.opts.opts);
          delete opts.opts;
          this.opts = opts;
        }
      }
    }
  }

  function riothingMixin(self){
    self.utils.log('init mixin');
    return {
      init: function(){
        this.store  = self.store;
        this.action = self.action;
        this.act    = self.act;
        this.track  = self.track;
        this.utils  = self.utils;
        this.log    = self.utils.log;
        this.SERVER = self.SERVER;
        this.CLIENT = self.CLIENT;
        this.DEV    = self.DEV;
        this.init   = this.initiate;
        
        this.initState(this.opts.state);
        this.on('update', () => this.log('update', this.root.localName));
      },
      
      initState: function(initState){
        this.shouldUpdate = (data, newOpts) => {
          if(this.utils.equal(newOpts, this.opts) && !data)
            return false;
          newOpts && newOpts.state && Object.assign(this, newOpts, { state: newOpts.state });
          return true;
        }
        if(!initState) return;
        Object.assign(this, initState, { state: initState });
      },
      
      setState: function(state){
        this.update(Object.assign(state, { state }));
      },
      
      initiate: function(fn){
        let state = fn(self.stores);
        
        Object.keys(state).forEach( key => this[key] = state[key] );
        
        self.storeNames.forEach( storeName => 
          self.track(storeName, changed => {
            state = fn(self.stores);
            const keys = self.utils.getKeys(changed);
            
            state = Object.keys(state).reduce( (obj, key) => 
              ~keys.indexOf(key) ? Object.assign(obj, { [key]: state[key] }) : obj
            , {});
            
            console.log(changed, state);
            
            Object.keys(state).length && this.update(state); 
          })
        )
      },
        
      auto: function(storeName, paramNames){
        paramNames = typeof paramNames === 'string' && [ paramNames ] || paramNames;
        paramNames.forEach( paramName => this[paramName] = self.store(storeName).get(paramName) );
        
        self.track(storeName, state => {
          const fits = Object.keys(state).filter( key => paramNames.includes(key) );
          if(!fits.length)
            return;
            
          const reduced = fits.reduce( (obj, fit) => {
            obj[fit] = state[fit];
            return obj;
          }, {} );
          
          console.log('Update triggering', storeName, fits);
          this.update(reduced);
        })
      }
    }
  }

  function riothingStore(name, { state, model }, self){
    
    //riot.observable(this);
    this.name         = name;
    this.model        = model || {};
    this.state        = state || {};
    this.trigger      = self.trigger;
    
    /** Pimp the model */
    if(!this.model.prototype.set)
      this.model.prototype.set = function(data, allow){
        const changed = Object.keys(data).reduce( (obj, key) => {
          if(this[key] || allow){
            this[key] = data[key];
            obj[key] = data[key];
          }
          return obj;
        }, {});
        
        //this.trigger(name, changed);
        return changed;
      }

    this.get = (key) => key
      ? key.split('.').reduce((o,i) => o[i], this.state)
      : this.state;
    
    //this.getter = (key) => 

    /** now u can set using setter function inside the state */
    this.set = (data, obj) => {
      !this.state.set && this.restate(data);
      
      if(typeof data === 'object')
        return this.state.set(data);
      
      if(!this.setter(data))
        return;
      
      const val   = this.setter(data)(obj);
      const state = this.state.set(val, true);
      //console.log(val, state);
      return state;
    }
    
    this.setter = setterName => typeof this.state[setterName] === 'function' && this.state[setterName];

    this.restate = data => {
      this.state = this.model && new this.model(data || this.state);
      return this.get();
    }
  }

  function RiothingUtils(self){

    this.ago = (timestamp = 0, end = 'ago', multiple = 's') => {
      timestamp = String(parseInt(timestamp)).length === 10 ? timestamp * 1000 : timestamp;
      
      const intervals = [
        { label: 'year',    seconds: 31536000 },
        { label: 'month',   seconds: 2592000 },
        { label: 'day',     seconds: 86400 },
        { label: 'hour',    seconds: 3600 },
        { label: 'minute',  seconds: 60 },
        { label: 'second',  seconds: 1 }
      ];
      
      timestamp       = new Date(timestamp).getTime();
      const ago       = (new Date().getTime() - timestamp);
      const seconds   = ago > 1000 ? Math.floor(ago / 1000) : 2;
      const interval  = intervals.find(i => i.seconds < seconds) || intervals[5];
      const count     = seconds > 1 ? Math.floor(seconds / interval.seconds) : 2;
      return `${count} ${interval.label}${count !== 1 && multiple || ''} ${end}`;
    };
    
    this.date = (timestamp = 0, type = 'date') => {
      const dt = new Date(timestamp);
      if(type === 'iso') return dt.toISOString().replace('T', ' ').split(':00.').shift()
      
      let d = dt.getDate(); d = d < 10 ? '0' + d : d;
      let m = dt.getMonth() + 1; m = m < 10 ? '0' + m : m;
      const y = dt.getFullYear();
      
      if(type === 'date') return `${d}/${m}/${y}`;
    }
    
    this.timestamp = (ago, timestamp) => {
      timestamp = timestamp ? new Date(timestamp).getTime() : new Date().getTime();
      switch(ago){
        case 'day':   ago = 1; break;
        case 'week':  ago = 7; break;
        case 'month': ago = 30; break;
        case 'year':  ago = 365; break;
        default: return timestamp;
      }
      
      return new Date(new Date(timestamp).setDate(new Date().getDate() - ago)).getTime()
    }
    
    this.num = (num) => {
      const defs = [
        { label: 'B', value: 1000000000 },
        { label: 'M', value: 1000000 }
      ];
      
      if(num > defs[0].value) return (num / defs[0].value).toFixed(2) + defs[0].label;
      if(num > defs[1].value) return (num / defs[1].value).toFixed(2) + defs[1].label;
      return num;
    };

    this.loadExtensionView = () =>
      fetch(chrome.extension.getURL(viewFilePath))
        .then(res   => res.text())
        .then(html 	=> {

          //Compile and mount tags
          html = riot.compile(html, true);
          eval(html);
          riot.mount('*');

          //Generate styling
          fucss.glob = false;
          return fucss.generateStyling({ riot: html, returnStyle: false })
        })
        
    this.gql = ({ query, GQ, token, variables }) => {
      GQ = ENV.GQ || GQ;
      return fetch('https://api.graph.cool/simple/v1/' + GQ, {
        method: 'POST',
        headers: { 
          'content-type':   'application/json',
          'authorization':  `Bearer ${token}`
        },
        body: JSON.stringify({ query, variables })
      })
      .then( res => res.json() )
      .then( json => {
        if(json.errors){
          const error = json.errors.shift();
            
          throw error.functionError || error.message || error;
        }
        return json.data 
      })
      .then( data => {
        const keys = Object.keys(data);
        return keys.length && data[keys.shift()];
      })
      .catch( error => {
        console.warn(error);
        return { error };
      })
    }
    
    this.gqlWs = ({ GQ, token, queries = [], action }) => {
      GQ = ENV.GQ || GQ;
      
      const webSocket = new WebSocket('wss://subscriptions.ap-northeast-1.graph.cool/v1/' + GQ, 'graphql-subscriptions');
      
      webSocket.onopen = e => {
        webSocket.send(JSON.stringify({
          type: 'init',
          payload: {
            Authorization: `Bearer ${token}`
          }
        }))
      }
      
      webSocket.onmessage = e => {
        const data = JSON.parse(e.data);
        
        switch(data.type){
          
          case 'init_success':
            this.log('socket connected');
            queries.forEach( (query, id) => webSocket.send(JSON.stringify({
              id,
              type: 'subscription_start',
              query
            })))
          break;
          
          case 'subscription_data':
            const payload = data.payload.data;
            const keys = Object.keys(payload);
            action && action(keys.length && payload[keys.shift()])
          break;
          
          case 'init_fail': {
            throw {
              message: 'init_fail returned from WebSocket server',
              data
            }
          }
          
        }
      }
      
      return webSocket;
    }
    
    this.cloneObject = (obj, noneDeep) => {
      let output = JSON.parse(JSON.stringify(obj));
      
      if(noneDeep)
        return output;
      
      function deep(o){
        let key, out = {};
        for(key in o){
          if(typeof o[key] !== 'object') console.log(o[key]);
          out[key] = (typeof o[key] === 'object') ? deep(o[key]) : o[key];
        }
        return out;
      }
      
      return Object.assign(output, deep(obj));
    }
    
    this.getKeys = (o, keys = []) => {
      if(o && o.constructor !== Object)
        return;
      
      Object.keys(o).forEach( k => {
        keys.push(k);
        o[k] && this.getKeys(o[k], keys); 
      });
      
      return keys;
    }
    
    this.promiseChain = (promises, data = {} ) => {
      if(!promises.length)
        return Promise.resolve(data);
      return promises.reduce( (promise, fn) =>
        promise.then( obj => fn(obj).then( res => Object.assign(obj, res) )),
        Promise.resolve(data)
      )
    }
    
    this.restateView = (actions, tagName = 'tag-app') => {
      actions = actions || ['APP_ROUTE'];
      actions = typeof actions === 'string' ? [actions] : actions;
      return this.promiseChain(actions.map( action => self.action(action) ))
        .then( state => {
          const tag = window.document.querySelector(tagName)._tag;
          tag ? tag.update({ opts: { state } }) : riot.mount(tagName, { state });
          return state;
        })
    }
    
    this.log = function(){
      if(!DEV) return;
      let msg = Object.keys(arguments).map( key => arguments[key]);
      msg.unshift('[RT]');
      console.log.apply(null, msg);
    }
    
    this.equal = function(o1, o2){
      try { return JSON.stringify(o1) === JSON.stringify(o2) }
      catch(e) { return false }
      return false;
    }
    
    this.initReqAnimFrame = () => {
      window.requestAnimFrame = window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        (cb => { window.setTimeout(cb, 1000 / 60) });
      
      window.cancelAnimFrame = window.cancelAnimationFrame || 
        window.mozCancelAnimationFrame || 
        (id => clearTimeout(id));
    }
    
    this.qs = str => {
      return str.split('&').reduce( (obj, p, i) => {
        if(!~p.indexOf('='))
          return Object.assign(obj, { [i]: p });
        const def = p.split('=');
        const key = def[0];
        const value = ~def[1].indexOf(',') ? def[1].split(',') : def[1];
        return Object.assign(obj, { [key]: value });
      }, {});
    }
        
    return this;
  }
}
