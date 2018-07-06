function defaultStore(initState){
  
  return {
    name:       'def',
    state:      initState,
    models:     {},
    actions:    {
      STORE_SET_ROUTE: function(data){
        return this.state.setRoute(data);
      }
    },
    model:      StateDef,
  };
  
  function StateDef({ routes, ENV }, prev = {}, def, act){
    
    this.routes   = routes;
    this.url      = ENV && ENV.URL;
    this.version  = ENV && ENV.VER;
      
    this.setRoute = ({ query, cookies, route, params }) => {
      this.query    = query;
      this.cookies  = cookies;
      this.route    = route;
      this.params   = params;
      return this;
    }

    return this;
  }
}
