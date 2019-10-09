function defaultStore(initState){

  return {
    name:       'def',
    state:      initState,
    models:     { Route },
    model:      StateDef,
  };

  function StateDef(data = {}, prev = {}){

    Object.keys(data).forEach( k => {
      this[k] = data[k];
    });

    this.navRoutes = Array.from(data.routes)
      .filter(route => !route.navRouteHide)
      .map( route => new Route(route) );

    this.url      = data.ENV && data.ENV.URL;
    this.version  = data.ENV && data.ENV.VER;

    //this['STORE_ROUTE_ATTR'] = data => this.set(data, true);
    this['STORE_ROUTE'] = data => {
      const { query: { splash }, hash, route, back } = data;
      const popup = hash && hash.popup;

      const pages = {
        page:   new Route(this.routes.find( r => r.route === route ) || {}),
        back,
        splash: splash  && new Route(this.routes.find( r => r.splash && r.name === splash ) || {}),
        popup:  popup   && new Route(this.routes.find( r => r.popup && r.name === popup ) || {}),
      };

      const actions = Object.keys(pages)
        .reduce( (arr, key) => arr.concat(pages[key] && pages[key].actions || []), ['APP_ROUTE']);

      return Object.assign( data, pages, { actions } );
    }
    this['REMOVE_COOKIE'] = name => {
      const { cookies } = this;
      if(cookies)
        delete cookies[name];
      return { cookies };
    }
  }

  function Route({ name, view, route, actions, splash, plain, md, important, auth, authHide, popup, link, target, meta }){
    this.name       = name || view && view.split('-')[1] || md || route && route.split('/')[1];
    this.route      = route;
    this.link       = route || splash && '?splash=' + this.name || popup && '#popup=' + this.name;
    this.actions    = actions;
    this.plain      = plain;
    this.auth       = auth;
    this.authHide   = authHide;
    this.md         = md;
    this.splash     = splash;
    this.important  = important;
    this.view       = view || (!md && 'page-' + (this.name || 'main'));
    this.show       = user => (!auth && !authHide) || (auth && user) || (authHide && !user);
    this.main       = !splash && (route && route === '/' || view === 'page-main');
    this.link       = link;
    this.target     = target;
    this.meta       = meta;
  }
}
