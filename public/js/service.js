'use strict';
var app = angular.module('geofoto.service', []);
app.service('PhotoService', ['$http',
    function($http) {
        return {
            showAll: function() {
                return $http.get('/api');
            },
            showOne: function(id) {
                return $http.get('/api/image/' + id)
            },
            showImage: function(id) {
                return $http.get('/api/imagedata/' + id)
            },
            add: function(id, update) {
                return $http.post('/api/image/add/' + id + '/' + update);
            }
        }
    }
]);