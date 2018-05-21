function defaultStore(initState){
  
  return {
    name:       'def',
    state:      initState,
    models:     {},
    model:      StateDef,
  };
  
  function StateDef(data = {}, prev = {}, def, act){
    Object.assign(this, prev);
    
    if(data.routes)
      this.routes = data.routes;
    
    if(data.query)
      this.query = data.query;
    
    if(data.cookies)
      this.cookies = data.cookies;
    
    if(data.route)
      this.route = data.route;
    
    if(data.params)
      this.params = data.params;
    
    if(data.URL)
      this.url = data.URL;
    
    if(data.VER)
      this.version = data.VER;
      
    //console.log('StateApp', this);

    return this;
  }
}
