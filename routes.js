'use strict';

// route handler for the API
var marklogic  = require('marklogic');
var connection = require('./dbsettings').connection;
var db         = marklogic.createDatabaseClient(connection);
var qb         = marklogic.queryBuilder;
var p          = marklogic.patchBuilder;
var dataUriToBuffer = require('./helper');


var io = require('socket.io').listen(3001);
var ss = require('socket.io-stream');

io.on('connection', function(socket) {
  socket.on('foo', function(data) {
    var uri = '/binary/updated/' + data.id;
    db.documents.write({
      uri: uri,
      contentType: 'image/jpeg',
      collections: ['binary'],
      content: dataUriToBuffer(data.img)
    }).result(function(response) {
      console.log('success');
    });
  });
});




/*
function to select all documents from the database - the query is restricted to
retrieve images from the 'image' collection. The 'image' collection consists of
documents that are describing the image itself but they have no binary data. The
binary data is only linked

e.g.

{
  "filename": "IMG_6193.jpg",
  "location": {
  "type": "Point",
  "coordinates": [
    43.7385,
    7.429167
    ]
  },
  "binary": "/binary/IMG_6193.jpg"
}
*/
var selectAll = function selectAll() {
    return db.documents.query(
      qb.where(
        qb.collection('image')
      )
      .orderBy(
        qb.sort('filename')
      )
      .slice(0,300) //return 300 documents "per page" (pagination)
    ).result();
};

/* This function selects one image from the database */
var selectOne = function selectOne(uri) {
    return db.documents.read('/image/' + uri + '.json').result();
};

/* This function is responsible for retrieving the binary data from the database.
Once the data is retrieve it is converted to a base64 encoded string. In the frontend
this data is then used as a data-uri to build up the image itself
*/
var selectImageData = function selectImageData(uri, callback) {
    return db.documents.read('/binary/' + uri).result();
};

/* This function updates the document. From the frontend we are allowed to set/change
the title of an image.
*/
var updateDocument = function(uri, update) {
  update = JSON.parse(update);
  var description = update.description;
  var newDocument = {};
  return db.documents.read('/image/' + uri + '.json')
  .result()
  .then(function(document) {
    if (update.title) {
      var title = update.title;
      document[0].content.title = title;
    }
    if (description) {
      document[0].content.description = description;
    }
    newDocument = document[0].content;
    document[0].collections = ['image'];
    return db.documents.write(document[0])
      .result();
  });
};

var saveImage = function(data) {
  data = JSON.parse(data);
  console.log('yay');
}

/* This function is responsible for doing a geospatial search

Geospatial search in MarkLogic uses a geo object (in thise case a geo path)
and it also has support for 4 geospatial types. We have circle, square, polygon
and point. In this function we are using the geospatial circle
*/
var search = function search(arg) {
  if (typeof arg === 'object') {
    var radius   = parseInt(arg.radius);
    var lat      = parseFloat(arg.lat);
    var lng      = parseFloat(arg.lng);
    return db.documents.query(
      qb.where(
          qb.collection('image'),
              qb.geospatial(
                 qb.geoPath('location/coordinates'),
                  qb.circle(radius, lat, lng)
              )
          ).slice(0,300)
      ).result();
  } else {
    return db.documents.query(
      qb.where(
        qb.term(arg)
      ).slice(0,300)
    ).result();
  }
};
/*
When specified the function below are making use of ExpressJS' req.params object
that contains the URL parameters that are sent with the request so:
if the route configuration contains:
/api/:id then the following URL http://localhost/api/image1234 will have a
'req.params.id' value that we can capture.
*/

/* wrapper function for selectAll() to retrieve all documents */
var apiindex = function(req, res) {
    selectAll().then(function(documents) {
        res.json(documents);
    }).catch(function(error) {
      console.log('Error: ', error);
    });
};

/* wrapper function to retrieve one document information */
var apiimage = function(req, res) {
    var id = req.params.id;
    selectOne(id).then(function(document) {
      if (document.length !== 0) {
        res.json(document);
      } else {
        // this 404 is captured via an AngularJS HTTP Interceptor
        res.status(404).end();
      }
    }).catch(function(error) {
      console.log('Error: ', error);
    });
};

/* wrapper function to retrieve image data */
var apiimagedata = function(req, res) {
    var id = req.params.id;
    selectImageData(id).then(function(binaryData) {
        res.json(new Buffer(binaryData[0].content, 'binary').toString('base64'));
    }).catch(function(error) {
      console.log('Error: ', error);
    });
};

/* wrapper function to update a document's title */
var apiupdate = function(req, res) {
  var id = req.params.id;
  var update = req.params.update;
  updateDocument(id, update).then(function() {
    res.json(200);
  }).catch(function(error) {
    console.log('Error: ', error);
  });
};

var apisave = function(req, res) {
  saveImage(req.params.data);
  res.json(200);
};

/* wrapper function for the geospatial search */

var apisearch = function(req, res) {
  //if radius exists it is a geospatial search
  if (req.params.radius) {
    var radius = req.params.radius;
    var lat    = req.params.lat;
    var lng    = req.params.lng;

    var searchObj = {
        radius: radius,
        lat: lat,
        lng: lng
    };

    search(searchObj).then(function(data) {
        res.json(data);
    }).catch(function(error) {
      console.log('Error: ', error);
    });
  } else {
    var term = req.params.term;

    search(term).then(function(data) {
      res.json(data);
    }).catch(function(error) {
      console.log('Error: ', error);
    });
  }
};

var appindex = function(req, res) {
    res.render('index');
};

/* this route configuration is needed as we are using jade files */
var partials = function partials(req, res) {
    var name = req.params.name;
    res.render('partials/' + name);
};

/* making both the app and api functions available via exports
*/
module.exports = {
    app: {
        index: appindex,
        partials: partials
    },
    api : {
        index: apiindex,
        image: apiimage,
        imagedata: apiimagedata,
        update: apiupdate,
        save: apisave,
        search: apisearch
    }
};
