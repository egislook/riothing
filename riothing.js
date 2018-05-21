function Riothing(cfg){
  const SERVER = this.SERVER = typeof module === 'object';
  const CLIENT = this.CLIENT = !SERVER;
  const DEV    = this.DEV    = cfg.DEV;

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
        this.actionNames.concat([ actionName ]);
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
      this.actionNames.concat([ store.name ]);
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

  function riothingStore(name, { state, model, actions }, self){

    this.name         = name;
    this.model        = model;
    this.state        = state || {};
    this.actions      = {};
    this.actionNames  = [];
    this.trigger      = self.trigger;

    initStore.bind(this)({ actions });

    this.get = (key) => key
      ? key.split('.').reduce((o,i) => o[i], this.state)
      : this.state;

    this.set = (data, triggerName) => {
      Object.assign(this.state, model && new model(data) || data)
      triggerName && self.trigger(triggerName, this.state);
      return this.state;
    }

    this.restate = (data, triggerName) => {
      this.state = model && new model(data) || data;
      triggerName && self.trigger(triggerName, this.state);
      return this.state;
    }

    this.act = (actionName, payload, cb) => 
      this.actions[actionName] && this.actions[actionName](payload, cb);

    function initStore({ actions }){
      for(let actionName in actions){
        this.actions[actionName] = actions[actionName].bind(this);
        this.actionNames.push(actionName);
      }
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
        
    this.gql = ({ query, GQ, token, variables }) =>
      fetch('https://api.graph.cool/simple/v1/' + GQ, {
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

    return this;
  }
}
