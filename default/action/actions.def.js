function defaultActions(){
  // if(typeof module !== 'undefined')
  //   var marked = require('marked');
  
  return {

    DEF_INIT: function(data){
      
      !this.SERVER && this.DEV && this.act('DEF_DEV_TICKER', 2000);
      if(!data.ENV.FETCHER || this.CLIENT){
        const state = this.store('def').set(data);
        //console.log(state);
        return Promise.resolve(state);
      }
      
      return this.act('DEF_FETCHER', data.ENV.FETCHER)
        .then( fetcherData => {
          return Promise.resolve(this.store('def').set(Object.assign(data, fetcherData)));
        })
    },
    
    DEF_DEV_TICKER: function(delay){
      setInterval(intervalFn, delay || 2000);
      
      function intervalFn(){
        fetch('/env').then(res => res.json())
          .then(({ READY, SYNC }) => !SYNC && READY && location.reload());
      }
    },
    
    DEF_FETCHER: function(fetcher){
      return Promise.all( 
        fetcher.map(link => fetch(link.url)
          .then( res => res.json() )
          .then( data => Object.assign(link, { data: link.limit ? data.slice(0, link.limit) : data }))) 
      )
      .then( results => results.reduce( (obj, item) => Object.assign(obj, { [item.name]: item.data })  , {}));
    },
    
    
    DEF_SET_ROUTE: function({ route, req }){
      const state = this.store('def').set('STORE_ROUTE', {
        route,
        query:    req.query,
        cookies:  req.cookies.get(),
        params:   req.params,
        hash:     req.hash
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
    
    DEF_REDIRECT: function(route = '#'){
      if(~route.indexOf('#') && route.length === 1){
        const topPos = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
        window.location.hash = '';
        document.documentElement.scrollTop = topPos;
        return;
      }
      ~route.indexOf('/') ? window.page(route) : window.location = route;
      return Promise.resolve();
    },
    
    LINK: function(route){
      if(route.splash)
        return '?splash=' + (route.name || route.splash);
      
      if(route.popup)
        return '#popup=' + (route.name || route.popup);
        
      return route.link || route.name;
    },
    
    DEF_MARKDOWN: function(str){
      return this.SERVER ? () => global.marked(str) : () => window.marked(str);
    },
    
    APP_INIT: function(){
      return Promise.resolve('APP_INIT');
    },
    
    APP_ROUTE: function(){
      return Promise.resolve(this.store('def').get());
    },
  }
}
