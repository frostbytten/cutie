var connect     = require('connect'),
    express     = require('express'),
    app         = express.createServer(),
	faye        = require('faye'),
	pubsub      = new faye.NodeAdapter({mount: '/faye', timeout: 45}),
	queue		= [],
	messages	= {},
	pingTime    = .5*60000, // 30 seconds per message
	interval 	= null;

app.configure( function() {
	app.use(express.cookieParser());
	app.use(express.bodyParser());
	app.use(app.router);
	app.set('view options', {layout: false});
	app.set('view engine', 'ejs');
	app.set('views', __dirname + '/views');
	app.use(express.static(__dirname + '/static'));
	app.error(express.errorHandler({ showStack: true, dumpExceptions: true }));
});

app.get('/display', function( req, res ){
	res.render('display.ejs');
});


app.get('/moderate', function( req, res ) {
	res.render('moderate.ejs');
});

app.get('/qa', function( req, res ) {
  res.render('qamode.ejs');
});

app.get('/parse', function( req, res ) {
	var uid = connect.utils.uid(7);
	//console.log( req.query );
	if( typeof req.query.msg === 'undefined' ) {
		res.end();
	} else {
		queue.push(uid);
		messages[uid] = req.query.msg;
		pubsub.getClient().publish('/cutie', {msg: 'incoming', data: {_id: uid, msg: req.query.msg}});
		res.end();
	}
});

pubsub.attach(app);
app.listen(4321);

client = pubsub.getClient().subscribe('/cutie', function( message ) {
	var msgid;
	console.log(message);
	switch( message.msg ) {
		case 'getstatus':
			if(interval === null || interval.callback === null ) {
				status = 'Stopped';
			} else {
				status = 'Started';
			}
			pubsub.getClient().publish('/cutie', {msg: 'status', data: status})
			break;
		case 'start':
			if(queue.length > 0) {
				msgid = queue.shift();
				pubsub.getClient().publish('/cutie', {msg: 'update', data: msgid});
				pubsub.getClient().publish('/cutie', {msg: 'display', data: messages[msgid]});
				delete messages[msgid];
			}
			interval = setInterval( function(){
				if( queue.length > 0 ) {
					msgid = queue.shift();
					pubsub.getClient().publish('/cutie', {msg: 'update', data: msgid});
					pubsub.getClient().publish('/cutie', {msg: 'display', data: messages[msgid]});
					delete messages[msgid];
				}
			}, pingTime);
			console.log(interval);
		break;
		case 'displayqa':
		  if( queue.length > 0 && queue.indexOf(message.data) !== -1 ) {
  		  pubsub.getClient().publish('/cutie', {msg: 'update', data: [message.data,messages[message.data]]});
  		  pubsub.getClient().publish('/cutie', {msg: 'display', data: messages[message.data]});
		  }
		break;
		case 'stop':
			console.log( interval );
			clearInterval( interval );
            interval = null;
			pubsub.getClient().publish('/cutie', {msg: 'cls'});
			console.log(interval)
			
		break;
		case 'stopqa':
		  pubsub.getClient().publish('/cutie', {msg: 'cls'});
		 break;
		case 'remove':
			console.log(message.data);
			if(queue.indexOf(message.data) !== -1) {
				queue.splice(queue.indexOf(message.data),1);
				delete messages[message.data];
			}
			pubsub.getClient().publish('/cutie', {msg: 'update', data: [message.data]});
		break;
	}
});
