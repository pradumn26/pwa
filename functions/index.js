var functions = require('firebase-functions');
var admin = require('firebase-admin');
var cors = require('cors')({origin: true});
var webpush = require('web-push');
var formidable = require('formidable');
var fs = require('fs');
var UUID = require('uuid-v4');

// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//

var serviceAccount = require("./pwagram-fb-key.json");

var gcconfig = {
  projectId: 'pwagram-99adf',
  keyFilename: 'pwagram-fb-key.json'
};

var gcs = require('@google-cloud/storage')(gcconfig);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://pwagram-99adf.firebaseio.com/'
});

exports.storePostData = functions.https.onRequest(function (request, response) {
  cors(request, response, function () {
    var uuid = UUID();
    var formData = new formidable.IncomingForm();
    formData.parse(request, function(err, fields, files) {
      fs.rename(files.file.path, '/tmp/' + files.file.name);
      var bucket = gcs.bucket('pwagram-99adf.appspot.com');

      bucket.upload('/tmp/' + files.file.name, {
        uploadType: 'media',
        metadata: {
          metadata: {
            contentType: files.file.type,
            firebaseStorageDownloadTokens: uuid
          }
        }
      }, function(err, file) {
        if (!err) {
          admin.database().ref('posts').push({
            id: fields.id,
            title: fields.title,
            location: fields.location,
            rawLocation: {
              lat: fields.rawLocationLat,
              lng: fields.rawLocationLng
            },
            image: 'https://firebasestorage.googleapis.com/v0/b/' + bucket.name + '/o/' + encodeURIComponent(file.name) + '?alt=media&token=' + uuid
          })
            .then(function () {
              webpush.setVapidDetails('mailto:business@academind.com', 'BKapuZ3XLgt9UZhuEkodCrtnfBo9Smo-w1YXCIH8YidjHOFAU6XHpEnXefbuYslZY9vtlEnOAmU7Mc-kWh4gfmE', 'AyVHwGh16Kfxrh5AU69E81nVWIKcUwR6a9f1X4zXT_s');
              return admin.database().ref('subscriptions').once('value');
            })
            .then(function (subscriptions) {
              subscriptions.forEach(function (sub) {
                var pushConfig = {
                  endpoint: sub.val().endpoint,
                  keys: {
                    auth: sub.val().keys.auth,
                    p256dh: sub.val().keys.p256dh
                  }
                };

                webpush.sendNotification(pushConfig, JSON.stringify({
                  title: 'New Post',
                  content: 'New Post added!',
                  openUrl: '/help'
                }))
                  .catch(function (err) {
                    console.log(err);
                  })
              });
              response.status(201).json({message: 'Data stored', id: fields.id});
            })
            .catch(function (err) {
              response.status(500).json({error: err});
            });
        } else {
          console.log(err);
        }
      });
    });
  });
});
