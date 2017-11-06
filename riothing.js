function Riothing(data){
  const self = this;
  const SERVER = typeof module === 'object';
  const cfg = data && data.cfg || { riotTag: 'tag-app' };
  
  riot.observable(this);
  
  this.storeNames = [];
  this.stores = {};
  this.models = {};
  
  this.action = (actionName) => {
    let action;
    this.storeNames.some((storeName) => {
      action = this.stores[storeName].actions[actionName];
      if(action) 
        return true;
    });
    if(!action) 
      return console.warn(`Action "${actionName}" can not be found`);
    return action;
  }
  
  this.act = (actionName, payload, cb) => this.action(actionName)(payload, cb);
  
  //this.on('*', this.act);
  
  this.setStore = (store, state, actions, models, model) => {
    if(typeof store === 'object'){
      state   = store.state   || state    || {};
      actions = store.actions || actions  || {};
      models  = store.models  || models   || {};
      model   = store.model;
      store   = store.name    || 'noname';
    }
    
    this.models = Object.assign(this.models, models);
    this.storeNames.push(store);
    this.stores[store] = new riothingStore(state, actions, model);
  }
  
  this.getStore = function(storeName){
    return this.stores[storeName];
  }
  
  this.store = this.getStore;
  
  //Initiation
  this.initClient = (stores, state) => {
    stores.length &&
      stores.forEach((store) => this.setStore(parent[store](state)));
    // init route action
    route((page) => this.act('SET_ROUTE', page, route.query()));
    route.base('/');
    route.start(1);
    // init app
    riot.mount(cfg.riotTag);
  }
  
  this.initData = (data) => {
    if(!data)
      return;
      
    const { state, stores } = data;
    
    if(!state)
      return this.initClient(stores);
    
    if(typeof state === 'string' && !SERVER)
      fetch(state)
        .then(res => res.json())
        .then(state => this.initClient(stores, state));
  }
    
  this.init = () => {
    //init mixin
    riot.mixin('riothing', mixin(this));
    //init data
    !SERVER && this.initData(data);
  }
  
  function mixin(riothing){
    console.log('Riothing Mixin', `
      init: this.mixin(\'riothing\')
      methods: ['act', 'track', 'store']
      variables: ['models', 'stores']
    `);
    return {
      init: function(){
        this.SERVER   = SERVER;
        this.act      = riothing.act.bind(riothing);
        this.track    = riothing.on.bind(riothing);
        this.store    = riothing.getStore.bind(riothing);
        this.action   = riothing.action.bind(riothing);
        this.models   = riothing.models;
        this.stores   = riothing.stores;
      }
    }
  }
  
  function riothingStore(initState = {}, actions = {}, model){
    riot.observable(this);
    // Variables
    this.SERVER       = SERVER;
    this.model        = model;
    this.state;
    this.actions      = {};
    this.actionNames  = [];
    
    // Parent Actions
    this.act      = self.act;
    this.trigger  = self.trigger;
    this.track    = this.on;
    
    // Main methods
    this.set = (object = {}) => {
      const newState = this.model ? new this.model(object, this.state, this.act) : object;
      this.state = newState;
      this.trigger('SET', newState);
      return newState;
    }
    
    this.get = (key) => key 
      ? key.split('.').reduce((o,i) => o[i], this.state) 
      : this.state;
    
    
    // Initiation
    _setActions.bind(this)(actions);
    this.set(initState);
      
    function _setActions(actions){
      this.actionNames = Object.keys(actions);
      
      this.actionNames.some((actionName) => {
        this.actions[actionName] = actions[actionName].bind(this);
      });
    }
  }
  
  this.init();
}