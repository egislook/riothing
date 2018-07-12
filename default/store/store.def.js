function defaultStore(initState){
  
  return {
    name:       'def',
    state:      initState,
    models:     { Route },
    model:      StateDef,
  };
  
  function StateDef({ routes, ENV }, prev = {}){
    
    this.routes   = routes;
    this.url      = ENV && ENV.URL;
    this.version  = ENV && ENV.VER;
      
    //this['STORE_ROUTE_ATTR'] = data => this.set(data, true);
    this['STORE_ROUTE']   = data => new Route(data, this.routes.find( r => r.route === data.route ) || {});
    this['REMOVE_COOKIE'] = name => {
      const { cookies } = this;
      if(cookies)
        delete cookies[name];
      return { cookies };
    }

    return this;
  }
  
  function Route({ query, cookies, params }, { view, route, actions, splash, plain }){
    this.query    = query;
    this.cookies  = cookies;
    this.params   = params;
    this.route    = route;
    this.view     = view;
    this.actions  = actions;
    this.splash   = splash;
    this.plain    = plain;
    this.page     = params.page || view || route.split('/')[1];
    return this;
  }
}
