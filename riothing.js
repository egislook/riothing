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
      //console.log(this.stores, storeName, this.storeNames);
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
    return this.stores[store];
  }
  
  this.getStore = function(storeName){
    return this.stores[storeName];
  }
  
  this.store = this.getStore;
  
  this.restate = (stores) => {
    const storeNames = stores && stores.length && typeof stores[0] === 'string' && stores 
      || this.storeNames.slice();
      
    return Promise.all(storeNames.map( storeName => {
      const state = this.store(storeName).init();
      return state;
      
    }) )
  }
  
  this.setStores = (stores, state) => {
    return stores.length && Promise.all(stores.map( (store) => this.setStore(parent[store](state)) ))
      .then(this.restate);
  }
  
  //Initiation
  this.initClient = (stores, state) => {
    //init route action
    route(page => this.act('SET_ROUTE', { page, query: route.query() }));
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
      fetch(state).then((res) => res.json().then(
        (json) => this.setStores(stores, json)
      ).then(
        () => this.initClient()
      ));
    
      // fetch(state)
      //   .then(res => res.json())
      //   .then(json => {
      //     console.log('SERVER_STATE', json);
      //     return json;
      //   })
      //   .then(json => this.setStores(stores, json))
      //   .then(() => this.initClient());
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
    this.action   = self.action;
    this.trigger  = self.trigger;
    this.track    = this.on;
    this.restate  = self.restate;
    
    // Main methods
    this.set = (object = {}) => {
      const newState = this.model ? new this.model(object, this.state, this.defaults, this.act) : object;
      this.state = newState;
      this.trigger('SET', newState);
      return translateState(this.state, this.action('GET_DEF'));
    }
    
    this.get = (key) => key 
      ? key.split('.').reduce((o, i) => o[i], translateState(this.state, this.action('GET_DEF'))) 
      : translateState(this.state, this.action('GET_DEF'));
    
    // Initiation
    _setActions.bind(this)(actions);
    //_setModel.bind(this)(model);
    
    function _setModel(model){
      if(!model)
        return;
      this.model = model;
      this.model.prototype.def = (value) => this.act('GET_DEF', value);
      //this.model.prototype.def = this.action('GET_DEF');
      //console.log(this.action('GET_DEF'));
      //this.model.def = this.action('GET_DEF');
    }
      
    function _setActions(actions){
      this.actionNames = Object.keys(actions);
      
      this.actionNames.some((actionName) => {
        this.actions[actionName] = actions[actionName].bind(this);
      });
    }
    
    this.init = (content) => {
      //console.log('THIS IS DEFAULT INIT STATE', content || initState);
      //console.log('initState', initState);
      let state = this.set(JSON.parse(JSON.stringify(content || initState)));
      //translateState(state, this.action('GET_DEF'));
      return state;
    };
    
    function translateState(state, getDef){
      
      //let translatables = [];
      
      return collectTranslatables(JSON.parse(JSON.stringify(state)));
      
      function collectTranslatables(obj, path = []){
        let key, val, newPath;
        for(key in obj){
          val = obj[key]; newPath = path.concat([key]);
          if(typeof val === 'object')
            collectTranslatables(val, newPath);
          else if(typeof val === 'string' && val.indexOf('$') === 0){
            //translatables.push({ path: newPath.join('.'), val, def: getDef(val) });
            obj[key] = getDef(val);
          }
        }
        return obj;
      }
    }
  }
  
  this.init();
}