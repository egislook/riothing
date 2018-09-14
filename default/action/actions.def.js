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
    
    DEF_AUTH: function({ state, res }){
      const { cookies, page } = state;
      const unauthorized = page.auth && !cookies.token;
      
      if(unauthorized)
        this.act('DEF_REDIRECT', page.auth, { redirect: res && res.redirect.bind(res), main: true });
      
      return Promise.resolve(!unauthorized && state);
    },
    
    DEF_SET_ROUTE: function({ route, req, res }){
      const state = this.store('def').set('STORE_ROUTE', {
        route,
        query:    req.query,
        cookies:  req.cookies.get(),
        params:   req.params,
        hash:     req.hash
      });
      
      return this.act('DEF_AUTH', { state, res });
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
    
    DEF_REDIRECT: function(route = '#', data = {}){
      if(route && typeof route === 'string' && ~route.indexOf('#') && route.length === 1){
        const topPos = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
        window.location.hash = '';
        document.documentElement.scrollTop = topPos;
        return;
      }
      
      const link = this.act('LINK', route, data.main);
      
      data.redirect
        ? data.redirect(link)
        : window.page.redirect(link) //!~route.indexOf('#') ? window.page(link) : window.location = link;
        
      return Promise.reject('redirect');
    },
    
    LINK: function(route, main){
      route = typeof route === 'string'
        ? this.store('def').get('navRoutes').find(({ name, link }) => name === route || link === route) || route
        : route;
      
      if(typeof route !== 'object')
        return typeof route === 'string' ? route : '/';
      
      if(route.splash)
        return `${main && '/' || ''}?splash=${(route.name || route.splash)}`;
      
      if(route.popup)
        return '#popup=' + (route.name || route.popup);
        
      return route.link || route.name || route;
    },
    
    DEF_MARKDOWN: function(str){
      if(typeof str === 'function')
        str = str();
      
      str = str || '';
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
