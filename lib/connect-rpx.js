var fs = require('fs');
var http = require('http');
var qs = require('querystring');
var util = require('util');

// Connect Middleware for integrating RPX Now into your application
var RPX_HOST = 'rpxnow.com';
var RPX_LOGIN_ROOT = "/api/v2/auth_info";
var RPX_LOGIN_URL = "https://rpxnow.com/api/v2/auth_info";

var options = {
    callback_path : '/login_completed',
    logoutPoint : '/logout',
    host : 'localhost',
    port : '80',
    connect_session : 'connect.session',
    name : 'default',
    onSuccesfulLogin :  function(json, req, res, next) {
        trace("In default login");
        req.sessionStore.regenerate(req, function(err){
            req.session.username = json.profile.displayName;
        });
        redirect( res, '/' );
    }
};

function redirect(res, location) {
    res.writeHead( 302, {
        'Location': location
    });
    res.end();
}

function trace(message){
    if(options.tracing)console.log(message);
}

function isAuthenticated(req) {
    trace( "Checking auth: " + util.inspect(req.session,false,null) );
    return req && req.session && req.session.username;
}

function getCredentials(req,res,next) {
    var token = req.body.token;
    postWithCredentials( token, req, res, next );
}

function postWithCredentials( token, req, res, next ) {
    var apiKey = options['apiKey'];
    var toPost = qs.stringify( { token : token, apiKey : apiKey } );
    var toPostHeader = { 'Host': RPX_HOST,
        'Content-Type'   : 'application/x-www-form-urlencoded',
        'Content-Length' : toPost.length };
    var rpxResponseBody = '';
    var postRequest = http.createClient( 443, RPX_HOST, true ).request( 'POST', RPX_LOGIN_ROOT, toPostHeader );
    postRequest.end( toPost, 'utf8' );
    postRequest.on( 'response', function(rpxResponse) {
        rpxResponse.on( 'data', function( data ) {
            trace("Chunk: " + data);
            rpxResponseBody += data;
        }  );
        rpxResponse.on( 'end', function() { onCredentialsReceived( rpxResponseBody, req, res, next ) } );
        rpxResponse.on( 'error', onError );
    });
}

function onError(response) {
    console.log( "Connect-rpx error: Unknown error with response" + util.inspect(response,false,null));
}

function onCredentialsReceived(data, req, res, next) {
    var json;
    if( data ) {
        try {
            json = JSON.parse( data );
        }
        catch( e ) {
            console.log("Connect-rpx error: " + util.inspect(e,false,null) + " parsing auth_info response: " + data);
        }
    }
    if( json && 'ok' == json.stat ) {
        options.onSuccessfulLogin( json, req, res, next );
    }
    else {
        redirect( res, options.loginPage );
    }
}

function initialize() {
}

function shouldFakeIt() {
    return options.fakedAuthentication;
}

function fakeIt(req,res,next) {
    trace( "Connect-rpx info: Mock authentication used." );
    var json = { 'profile' : { 'displayName' :  ('fakedUsername' + parseInt( Math.random() * 1000 ) ) } }
    options.wtf( json, req, res, next );
    next();
}

exports.config = function( key, value ) {
    if( value ) {
        trace( "Setting: " + key + " to " + value );
        options[key] = value;
    }
    return options[key];
};

exports.testRpx = function( token, apiKey ) {
    options['apiKey'] = apiKey;
    postWithCredentials( token );
};

exports.loadConfig = function( filename ) {
    // Do something to load the settings
    fs.readFile( filename, function (err, data) {
        if (err) throw err;
        // convert the data to JSON
        var obj;
        trace( "Data: " + data );
        try {
            obj = JSON.parse( data );
        }
        catch( e ) {
            console.log( "Connect-rpx error: Error in parsing settings file: " + util.inspect(e,false,null) );
        }
        for( x in obj ) {
            if( 'onSuccessfulLogin' == x ) {
                throw "onSuccessfulLogin needs to be a function, cannot be passed inside configuration file";
            }
            exports.config( x, obj[x] );
        }
    });
};

exports.handler = function() {
    return function(req,res,next) {
        trace( "Inside RPX: " + req.url );
        if( req.url == options.reentryPoint ) {
            getCredentials(req,res,next);
        }
        else if( req.url == options.loginPage ) {
            next();
        }
        else if( req.url == options.logoutPoint ) {
            trace( "Inside logout" );
            req.sessionStore.regenerate(req, function(err){
                req.session.username = null;
                redirect( res, options.loginPage );
            });
        }
        else {
            if( isAuthenticated(req) ) {
                next();
            }
            else if( shouldFakeIt() ) {
                fakeIt(req,res,next);
            }
            else  {
                ignored = false;
                ignore = options.ignorePaths;
                for( x in ignore ) {
                    var first = req.url.substr( 0, ignore[x].length );
                    var second = ignore[x];
                    trace( "Ignoring: " + ignore[x] + " vs. " + req.url + " vs. " + first );
                    if( first == second ) { // req.url.substr( 0, ignore[x].length ) == ignore[x] ) {
                        ignored = true;
                        next();
                    }
                }

                if( !ignored ) {
                    // If we got here, then send to login page
                    redirect( res, options.loginPage );
                }
            }
        }
    };
};
    
