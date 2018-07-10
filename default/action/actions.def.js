function defaultActions(){

  return {

    DEF_INIT: function(data){
      !this.SERVER && this.DEV && this.act('DEF_DEV_TICKER', 2000);
      
      return Promise.resolve(this.store('def').set(data));
    },
    
    DEF_DEV_TICKER: function(delay){
      setInterval(intervalFn, delay || 2000);
      
      function intervalFn(){
        fetch('/env').then(res => res.json())
          .then(({ READY, SYNC }) => !SYNC && READY && location.reload());
      }
    },
    
    DEF_SET_ROUTE: function({ route, req }){
      
      const state = this.store('def').set('STORE_ROUTE', {
        route,
        query:    req.query,
        cookies:  req.cookies.get(),
        params:   req.params
      });
      return Promise.resolve(state);
    },
    
    DEF_RESTATE: function(){
      const actions = this.store('def').get('actions');
      return this.utils.restateView(actions);
    },
    
    DEF_REMOVE_COOKIE: function(name){
      window.Cookies && window.Cookies.remove(name);
      const state = this.store('def').set('REMOVE_COOKIE', name);
      return Promise.resolve(state);
    },
    
    DEF_SET_COOKIE: function(cookies, opts = {}){
      if(!window.Cookies) return;
      Object.keys(cookies).forEach( name => window.Cookies.set(name, cookies[name], opts) );
    },
    
    DEF_REDIRECT: function(route){
      window.page(route);
    },
    
    APP_INIT: function(){
      return Promise.resolve('APP_INIT');
    },
    
    APP_ROUTE: function(){
      //this.act('SET_COIN', { symbol: req.params.page });
      return Promise.resolve('loaded');
    },
    
    
    PAGE_ABOUT: function(){
      console.log('page');
      return Promise.resolve('loaded');
    }
  }
}
