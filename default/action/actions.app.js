function defaultAppActions(){

  return {

    APP_INIT: function({ url, app }, cb){
      !this.SERVER && this.DEV && this.act('APP_DEV_TICKER', 2000);
      
      // console.log('ACTION_APP_INIT', 'v' + this.VER);
      // this.store('app').set({ version: this.VER });
      // return this.act('GET_ALL_CONTENT', { url })
      return Promise.resolve('loaded');
    },
    
    APP_DEV_TICKER: function(delay){
      console.log('init ticker');
      setInterval(intervalFn, delay || 2000);
      
      function intervalFn(){
        fetch('/env').then(res => res.json())
          .then(({ READY, SYNC }) => !SYNC && READY && location.reload());
      }
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
