function Riothing(cfg){
  const SERVER = this.SERVER = typeof module === 'object';
  const CLIENT = this.CLIENT = !SERVER;
  const ENV    = this.ENV    = cfg.ENV;
  const DEV    = this.DEV    = true;

  this.utils = new RiothingUtils();

  riot.observable(this);

  this.routes       = cfg.data && cfg.data.routes;
  this.actionNames  = [];
  this.storeNames   = [];
  this.actions      = {};
  this.stores       = {};


  this.store  = (storeName)   => this.stores[storeName];
  this.action = (actionName)  => this.actions[actionName] && this.actions[actionName] 
    || function(){ console.warn(actionName + ' action does not exist')};
    
  this.act    = (actionName, payload, cb) => {
    console.log('[RIOTHING]', actionName, !this.actions[actionName] && 'missing action' || 'action triggered');
    return this.actions[actionName] && this.actions[actionName](payload, cb) 
      || Promise.resolve( function(){ console.log('missing action ' + actionName)} );
  }
  
  this.restate = () => this.storeNames.forEach( storeName => this.store(storeName).restate() )

  this.track = this.on;

  init.bind(this)(cfg);

  //console.log(this);

  function init({ actions, stores, data }){
    //init riothing mixin
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

  function riothingMixin(self){
    console.log('[RIOTHING] initialise mixin');
    return {
      init: function(){
        this.store  = self.store;
        this.action = self.action;
        this.act    = self.act;
        this.track  = self.track;
        this.utils  = self.utils;
        this.SERVER = self.SERVER;
        this.CLIENT = self.CLIENT;
        this.DEV    = self.DEV;
      }
    }
  }

  function riothingStore(name, { state, model }, self){

    this.name         = name;
    this.model        = model || {};
    this.state        = state || {};
    //this.trigger      = self.trigger;
    
    /** Pimp the model */
    if(!this.model.prototype.set)
      this.model.prototype.set = data => 
        Object.keys(data).forEach( key => this.state[key] ? this.state[key] = data[key] : null ) && this.state;

    this.get = (key) => key
      ? key.split('.').reduce((o,i) => o[i], this.state)
      : this.state;

    /** now u can set using setter function inside the state */
    this.set = (data, obj) => {
      !this.state.set && this.restate(data);
      
      if(typeof data === 'object')
        return this.state.set(data);
      
      return this.setter(data) && this.setter(data)(obj);
      
      
      //triggerName && self.trigger(triggerName, this.state);
    }
    
    this.setter = setterName => typeof this.state[setterName] === 'function' && this.state[setterName];

    this.restate = (data) => {
      this.state = this.model && new this.model(data || this.state);
      return this.get();
    }
  }

  function RiothingUtils(){
    const intervals = [
      { label: 'year',    seconds: 31536000 },
      { label: 'month',   seconds: 2592000 },
      { label: 'day',     seconds: 86400 },
      { label: 'hour',    seconds: 3600 },
      { label: 'minute',  seconds: 60 },
      { label: 'second',  seconds: 0 }
    ];

    this.ago = (timestamp = 0, end = 'ago', multiple = 's') => {
      timestamp = new Date(timestamp).getTime();
      const seconds   = Math.floor((Date.now() - timestamp) / 1000);
      const interval  = intervals.find(i => i.seconds < seconds);
      const count     = Math.floor(seconds / interval.seconds);
      return `${count} ${interval.label}${count !== 1 && multiple || ''} ${end}`;
    }

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
          'content-type': 'application/json',
          'authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ query, variables })
      })
      .then( res => res.json() )
      .then( json => {
        if(json.errors){
          const error = json.errors.shift();
          throw error.functionError
        }
        return json.data 
      })
      .then( data => {
        const keys = Object.keys(data);
        return keys.length && data[keys.shift()];
      })
      .catch( error => ({ error }) )
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
            console.log('[RIOTHING]', 'Socket Connected');
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
    
    this.cloneObject = obj => {
      let output = JSON.parse(JSON.stringify(obj));
      
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

    return this;
  }
}
