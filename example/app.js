var Connect = require('connect');
var MemoryStore = require('connect/middleware/session/memory');
var RPX = require( '../../connect-rpx/lib/connect-rpx');
// var RPX = require( 'connect-rpx' );

// Setup RPX
//
// Your API key, look in the settings on rpxnow.com
RPX.config( 'apiKey', 'asdasdadadadadadasdasdasd' );
RPX.config( 'ignorePaths', [ '/stylesheets', '/images', '/javascript', '/css', "/login" ] );
RPX.config( 'reentryPoint',  '/rpx_login' );
RPX.config( 'logoutPoint',  '/logout' );
RPX.config( 'loginPage',  '/login/index.html' );
RPX.config( 'onSuccessfulLogin', handleLogin );

// Or, just load from config file.  This will override existing settings, and could be used to 
// keep settings out of version control if you want to do that for things like the apiKey.
RPX.loadConfig( "./config.json" );

function redirect(res,location) {
    res.writeHead( 302, {
        'Location': location
    });
    res.end();
}

function handleLogin( json, req, res, next ) {
    req.sessionStore.regenerate(req, function(err){
        req.session.profile = json.profile;
        req.session.username = json.profile.displayName;
        // next();
    });
    redirect( res, '/' );
}

// Setup your connect.  RPX requires session, cookieDecoder, redirect installed before RPX.
var minute = 60000;
var root = __dirname + "/public";
var Server = module.exports = Connect.createServer(
    Connect.logger(),
    Connect.bodyDecoder(),
    Connect.cookieDecoder(),
    Connect.session({ store: new MemoryStore({ reapInterval: minute, maxAge: minute * 5 }) }),
    RPX.handler(),
    Connect.staticProvider( root )  // this is not strictly required,
);

Server.listen(4040);

