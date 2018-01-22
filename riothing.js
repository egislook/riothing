function Riothing(cfg){
  const SERVER = this.SERVER = typeof module === 'object';

  riot.observable(this);

  this.actions      = {};
  this.actionNames  = [];
  this.stores       = {};
  this.storeNames   = [];

  this.store  = (storeName)   => this.stores[storeName];
  this.action = (actionName)  => this.actions[actionName];
  this.act    = (actionName, payload, cb) => this.actions[actionName] && this.actions[actionName](payload, cb);

  this.track = this.on;

  init.bind(this)(cfg);

  //console.log(this);

  function init({ actions, stores }){
    //init riothing mixin
    riot.mixin('riothing', riothingMixin(this));
    //init actions & stores
    initActions.bind(this)(actions);
    initStores.bind(this)(stores);
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
        this.actionNames.push(actionName);
      }
    });
  }

  function initStores(stores){
    stores.forEach(storeFileName => {
      const storeFunction = SERVER
        ? global[storeFileName]
        : parent[storeFileName];

      if(!storeFunction)
        return console.warn(`"${storeFile}" does not have function`);

      let store = storeFunction();

      this.stores[store.name] = new riothingStore(store.name, store, this);
      this.storeNames.push(store.name);
    });
  }

  function riothingMixin(self){
    console.log('init Mixin');
    return {
      init: function(){
        this.store  = self.store;
        this.action = self.action;
        this.act    = self.act;
        this.track  = self.track;
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

    this.act = (actionName, payload, cb) => this.actions[actionName] && this.actions[actionName](payload, cb);

    function initStore({ actions }){
      for(let actionName in actions){
        this.actions[actionName] = actions[actionName].bind(this);
        this.actionNames.push(actionName);
      }
    }
  }
}

const intervals = [
  { label: 'year', seconds: 31536000 },
  { label: 'month', seconds: 2592000 },
  { label: 'day', seconds: 86400 },
  { label: 'hour', seconds: 3600 },
  { label: 'minute', seconds: 60 },
  { label: 'second', seconds: 0 }
];

function timeSince(timestamp = 0){
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  const interval = intervals.find(i => i.seconds < seconds);
  const count = Math.floor(seconds / interval.seconds);
  return `${count} ${interval.label}${count !== 1 ? 's' : ''} ago`;
}

function extensionViewLoad(){
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
}
