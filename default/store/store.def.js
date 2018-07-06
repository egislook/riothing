function defaultStore(initState){
  
  return {
    name:       'def',
    state:      initState,
    models:     {},
    model:      StateDef,
  };
  
  function StateDef({ routes, ENV }, prev = {}){
    
    this.routes   = routes;
    this.url      = ENV && ENV.URL;
    this.version  = ENV && ENV.VER;
      
    this['STORE_ROUTE_ATTR'] = ({ query, cookies, route, params }) => {
      this.query    = query;
      this.cookies  = cookies;
      this.route    = route;
      this.params   = params;
      return this;
    };

    return this;
  }
}
