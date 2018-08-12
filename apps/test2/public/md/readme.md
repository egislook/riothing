# Riothing.   
Simple to use Library for riot isomorphic or client only app creation process.

#### Riothing client
https://cdn.rawgit.com/noneedsystem/riothing/v0.2.4/riothing.js

#### Riothing server
`npm install -S riothing`

```
  <!--default folder structure-->
  /public
    /store
    /app
    /action
    /data
    root.html
```

### How it works?

**Client side only**

- include client script & store functions to root.html
- initiate it by including `new Riothing({ stores: ['storeRoutes'] });`
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