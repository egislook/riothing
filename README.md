# Riothing.   
Simple to use Library for riot isomorphic or client only app creation process.

#### Riothing client
https://cdn.rawgit.com/noneedsystem/riothing/0.0.1/riothing.js

#### Riothing server
`npm install -S riothing`

```
  <!--default folder structure-->
  /public
    /stores
    /app
    root.html
    content.json
```

### How it works?

**Client side only** 

- include client script & store functions to root.html
- initiate it by including `new Riothing({ stores: ['storeRoutes'], state: '/content.json' });`
- *Enjoy*  

**Isomorphic approach**  

- include only client script to root.html
- install `riothing` through `npm`
- require riothing `const riothing = require('./riothing');`
- use it as routing function `riothing.route(req, res)` 
- *Enjoy*

**Usage**

init: `this.mixin('riothing')`  
methods: `['act', 'track', 'store']`  
variables: `['models', 'stores']`  

#### Works best with Fucss client
https://github.com/noneedsystem/fucss   
https://cdn.rawgit.com/noneedsystem/fucss/0.6.9a/fucss.min.js

#### And lets not forget icons
https://cdn.rawgit.com/noneedsystem/fuico/0.0.8/style.css  
https://github.com/noneedsystem/fuico

### storeRiot example
```javascript
function storeRoutes(initState){
  
  return {
    name:       'routes',
    state:      initState,
    actions:    new Actions(),
    models:     { Route, Meta },
    model:      RoutesState,
  };
  
  function Actions(){
    return {
      'SET_ROUTE': function(page, splash){
        let routes = this.get('routes');
        
        let route = routes.filter((route) => route.name === page);
        if(route.length !== 1)
          route = route.filter((route) => route.main);
        
        let routeName = route.length !== 1 
          ? routes[0].name 
          : route[0].name;
        
        let state = this.set({
          ready: !this.SERVER,
          page: routeName,
          splash,
        });
        //console.log(state);
        //set client title
        if(!this.SERVER){
          parent.route(parent.location.href.replace(parent.location.origin, ''), this.get('meta.title'));
        }
        console.log('SET_ROUTE', routeName, splash);
        
        this.trigger('ROUTE_STATE', state);
        return state;
      }
    }
  }
  
  function RoutesState(data = {}, prev = {}){
    this.routes = data.routes && data.routes.map((route) => new Route(route)) || prev.routes ||
    [
      new Route({ name: 'main', main: true }),
      new Route({ name: 'todo' }),
      new Route({ name: 'test' })
    ];
    
    this.metas = data.metas || prev.metas || {
      main: new Meta(),
      todo: new Meta({ title: 'todo poinout title'})
    };
    
    this.ready  = data.ready  || prev.ready   || false;
    this.page   = data.page   || prev.page    || 'main';
    this.splash = data.splash;
    
    //generated values
    this.route    = this.routes.filter((route) => route.name === this.page).shift();
    this.meta     = this.metas[this.page] || this.metas['main'];
    this.subroute = this.splash && this.routes.filter((subroute) => subroute.name === this.splash).shift();
    
    return this;
  }
  
  function Route(data = {}){
    this.name = data.name || 'none';
    this.main = data.main || false;
    this.link = data.link || this.main && '/' || '/' + this.name;
    this.view = data.view || 'page-' + this.name;
    
    return this;
  }
  
  function Meta(data = {}){
    this.title    = data.title    || 'Poinout app';
    this.desc     = data.desc     || 'Simple app description';
    this.author   = data.author   || 'egis';
    this.image    = data.image    || '';
    this.url      = data.url      || '';
    this.favicon  = data.favicon  || 'favicon.ico';
    
    return this;
  }
}
```
