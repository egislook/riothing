function storeRoutes(initState){
  
  return {
    name:       'routes',
    state:      initState,
    actions:    new Actions(),
    models:     { Route, Meta },
    model:      StateRoutes,
  };
  
  function Actions(){
    return {
      'SET_ROUTE': function({ page, query, cookies }){
        
        console.log('SET_ROUTE', page, 'query:', query);

      }
    }
  }
  
  function StateRoutes(data = {}, prev = {}, def, act){
    return this;
  }
  
  function Route(data = {}){
    this.name   = data.name || 'none';
    this.main   = data.main || false;
    this.link   = data.link || this.main && '/' || '/' + this.name;
    this.view   = data.view || 'page-' + this.name;
    this.clean  = data.clean;
    this.test   = '$def.tadam';
    
    return this;
  }
  
  function Meta(data = {}){
    //console.log(data, act, act && act('GET_DEF', data.title));
    //console.log(data.title, data.desc);
    this.title    = data.title || 'Poinout app';
    this.desc     = data.desc  || 'Simple app description';
    this.author   = data.author   || 'egis';
    this.image    = data.image    || '';
    this.url      = data.url      || '';
    this.favicon  = data.favicon  || 'favicon.ico';
    
    return this;
  }
}