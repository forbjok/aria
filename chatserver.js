var express = require('express');
var multer = require('multer');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

var easyimg = require('easyimage');

// Serve static shit
app.use('/', express.static(__dirname + '/wwwroot'));
app.use('/images', express.static(__dirname + '/images'));

var posts = [];

var upload = multer({
  dest: __dirname + '/images'
});

app.post('/post', upload.single('image'), function(req, res) {
  console.log('Got post');

  var post = {
    time: new Date().getTime(),
    name: ('name' in req.body ? req.body.name : 'Anonymous'),
    message: req.body.message,
  };

  function emitPost() {
    posts.push(post);

    io.emit('post', post);
    res.send({
      result: 1
    });
  }

  var imageFile = req.file;

  if (imageFile) {
    if (imageFile.mimetype.match(/^image\//)) {
      var fileName = imageFile.filename;
      var thumbName = '/images/thumb-' + fileName;

      easyimg.resize({
        src: imageFile.path,
        dst: __dirname + thumbName,
        width: 50,
        height: 50
      }).then(function(file) {
        //console.dir(file);
        post.image = req.protocol + '://' + req.get('host') + '/images/' + fileName;
        post.thumbnail = req.protocol + '://' + req.get('host') + thumbName;

        emitPost();
      });
    }
  } else {
    emitPost();
  }
});

io.on('connection', function(socket) {
  console.log('Connected!');

  posts.forEach(function(value, index, array) {
    socket.emit('post', value);
  });

  socket.on('disconnect', function() {
    console.log('Disconnected!');
  });
});

http.listen(8080);
