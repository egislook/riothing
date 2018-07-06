function defaultActions(){

  return {

    DEF_INIT: function(data){
      !this.SERVER && this.DEV && this.act('DEF_DEV_TICKER', 2000);
      
      // console.log('ACTION_APP_INIT', 'v' + this.VER);
      // this.store('app').set({ version: this.VER });
      // return this.act('GET_ALL_CONTENT', { url })
      return Promise.resolve(this.store('def').set(data));
    },
    
    DEF_DEV_TICKER: function(delay){
      console.log('init ticker');
      setInterval(intervalFn, delay || 2000);
      
      function intervalFn(){
        fetch('/env').then(res => res.json())
          .then(({ READY, SYNC }) => !SYNC && READY && location.reload());
      }
    },
    
    APP_INIT: function(){
      return Promise.resolve('APP_INIT');
    },
    
    APP_SET_ROUTE: function(route, req){
      
      const state = this.store('def').action('STORE_SET_ROUTE')({
        route,
        query:    req.query,
        cookies:  req.cookies.get(),
        params:   req.params
      });
      this.trigger('APP_SET_ROUTE', state.params);
      return Promise.resolve('loaded');
    },
    
    APP_ROUTE: function(req, res){
      console.log('ACTION_APP_ROUTE', req.params, req.query, req.cookies.get());
      //this.act('SET_COIN', { symbol: req.params.page });
      return Promise.resolve('loaded');
    },
    
    
    PAGE_ABOUT: function(req, res){
      console.log('page');
      return Promise.resolve('loaded');
    }
  }
}
