var map;
var distanceMatrixService;
var directionsService;
var directionsDisplay;
var bestPolyline;
var curPolyline;

var markers = [];
var locations = [];
var distanceMatrix;
var stopTimes;
var request = require('request');
var Promise = require("bluebird");
var closingHours = [];
var moment = require('moment');
var firebase = require("firebase");

var config = {
	apiKey: "AIzaSyBnW9KtyHptZNlqyuBoSK-vUHI0MdgWeRc",
	authDomain: "hackthenorth16-1758.firebaseapp.com",
	databaseURL: "https://hackthenorth16-1758.firebaseio.com",
	storageBucket: "hackthenorth16-1758.appspot.com",
	messagingSenderId: "384256880141"
};




var createPlacePromise = function(url){
	var ret = new Promise(function(resolve, reject) {
		request(url,function(error,response,body){
			if(!error && response.statusCode == 200){
				resolve(body);
			}
		})
	});
	return ret;
}


exports.getLocations = function(req,res,next){
	//locations = 'Vancouver+BC|Seattle'.split('|');
	var origins = req.query.origins;
	var destinations = req.query.destinations;
	var pids = req.query.placeIds.split(',');
	stopTimes = req.query.durations.split(',');
	for(var i = 0; i < stopTimes.length; i++){
		stopTimes[i] *= 60;
	}
	var dayNum = moment().day();
	console.log(dayNum);
	closingHours = [];
	var places = [];
	locations = origins.split('|');
	for(var i = 0; i < pids.length; i++){
		var url = 'https://maps.googleapis.com/maps/api/place/details/json?placeid=' + pids[i] + '&key=AIzaSyDp9BP6P9_GnKaj_x6lEWw9edNlBMrdbtY';
		places.push(createPlacePromise(url));
	}
	Promise.all(places)
	.then(function(responses){
		for(var ri in responses){
			var res = JSON.parse(responses[ri]);
			console.log(res);
			if(res.result.hasOwnProperty('opening_hours')){
				if(!res.result.opening_hours.open_now){
					closingHours.push(0);
				}
				else if(res.result.opening_hours.periods[dayNum].hasOwnProperty('close')){
					console.log(res.result.opening_hours.periods[dayNum]);
					var closingTime = parseInt(res.result.opening_hours.periods[dayNum].close.time.substring(0,2)) * 3600;
					closingTime += parseInt(res.result.opening_hours.periods[dayNum].close.time.substring(2,4));
					closingHours.push(closingTime);
				}
				else closingHours.push(87000);
			}
			else closingHours.push(87000);
		}
		return closingHours;
	})
	.then(function(closingHours){
		request('https://maps.googleapis.com/maps/api/distancematrix/json?origins=' + origins + '&destinations='+ destinations + '&key=AIzaSyDp9BP6P9_GnKaj_x6lEWw9edNlBMrdbtY', function (error, response, body) {
			if (!error && response.statusCode == 200) {
				//console.log(body);

				var response = JSON.parse(body);
				distanceMatrix = new DistanceMatrix(response);
				console.log('yo', closingHours);

				var best = runGA();
				if(best.length){
					res.json({
						status: 'OK',
						optimalRoute: best
					})
				}
				else{
					res.json({
						status: 'fail',
						optimalRoute: best
					});
				}
			}
		})
	})

	//console.log(origins);
}

function runGA() {
	var ga = new GA();
	var population = new Population(50, true);
	var best = population.getFittest();
	var startTime = population.getFittest().getDistance();
	//$("#start").html(startTime + " seconds");
	//$("#end").html(startTime + " seconds");
	var endTime;
	//bestPolyline.setMap(map);
	//curPolyline.setMap(map);
	var i = 0;

	for(var i = 0; i < 75; i++){
		population = ga.evolvePopulation(population);
		localBest = population.getFittest();
		if (localBest.getFitness() > best.getFitness()) {
			best = localBest;
			//$("#end").html(best.getDistance() + " seconds");
		}
		//bestPolyline.setPath(best.getPath());
		var ind = Math.floor(Math.random() * locations.length);
	}
	console.log('best tour', best.fitness);
	if(best.getDistance()){
		return best.tour;
	}
	else return [];
}

function shuffle(a) {
    var j, x, i;
    for (i = a.length; i; i--) {
        j = Math.floor(Math.random() * i);
        x = a[i - 1];
        a[i - 1] = a[j];
        a[j] = x;
    }
}

function DistanceMatrix(matrix) {
	this.matrix = matrix;
	this.getDistance = function(x, y) {
		return this.matrix.rows[x].elements[y].distance.value;
	}
	this.getDuration = function(x, y) {
		return this.matrix.rows[x].elements[y].duration.value;
	}
}

function Tour() {
	this.tour = [];
	for (var i = 0; i < locations.length; i++) {
		this.tour.push(null);
	}
	this.distance = 0;
	this.fitness = 0;
	this.generateIndividual = function() {
		for (var i = 0; i < locations.length; i++) {
			this.tour[i] = i;
		}
		shuffle(this.tour);
	}
	this.getDistance = function() {
		if (this.distance == 0) {
			var tourDistance = 0;
			for (var i = 0; i < this.tour.length - 1; i++) {
				var x = this.tour[i];
				var y = this.tour[(i + 1) % this.tour.length];
				tourDistance += distanceMatrix.getDuration(x, y);
				tourDistance += stopTimes[i];
				if(tourDistance > closingHours[i]){
					console.log(tourDistance,closingHours[i], 'broke');
					tourDistance = 0;
					break;
				}
			}
			this.distance = tourDistance;
		}
		return this.distance;
	}
	this.getFitness = function() {
		var distance = this.getDistance();
		if(distance > 0){
			return 1 / distance;
		}
		else return 0;
	}
	this.containsMarker = function(marker) {
		for (var i = 0; i < this.tour.length; i++) {
			if (this.tour[i] == marker) {
				return true;
			}
		}
		return false;
	}
	this.getPath = function() {
		var path = [];
		for (var i = 0; i < this.tour.length; i++) {
			path.push(locations[this.tour[i]]);
		}
		return path;
	}
}

function Population(size, initialize) {
	this.tours = [];
	for (var i = 0; i < size; i++) {
		this.tours.push(null);
	}
	if (initialize) {
		for (var i = 0; i < size; i++) {
			var tour = new Tour();
			tour.generateIndividual();
			this.tours[i] = tour;
		}
	}
	this.getFittest = function() {
		var fittestTour = this.tours[0];
		for (var i = 0; i < this.tours.length; i++) {
			if (this.tours[i].getFitness() > fittestTour.getFitness()) {
				fittestTour = this.tours[i];
			}
		}
		return fittestTour;
	}
	this.size = function() {
		return this.tours.length;
	}
}

function GA() {
	this.mutationRate = 0.1;
	this.tournamentSize = 5;
	this.elitism = true;
	this.selectParent = function(population) {
		var tournament = new Population(this.tournamentSize, false);
		for (var i = 0; i < this.tournamentSize; i++) {
			var ind = Math.floor(Math.random() * population.size());
			tournament.tours[i] = population.tours[ind];
		}
		return tournament.getFittest();
	}
	this.crossover = function(parentA, parentB) {
		var child = new Tour();

		var rand1 = Math.floor(Math.random() * parentA.tour.length);
		var rand2 = Math.floor(Math.random() * parentA.tour.length);

		var startPos = Math.min(rand1, rand2);
		var endPos = Math.max(rand1, rand2);

		for (var i = startPos; i <= endPos; i++) {
			child.tour[i] = parentA.tour[i];
		}

		for (var i = 0; i < child.tour.length; i++) {
			if (child.tour[i] == null) {
				for (var j = 0; j < parentB.tour.length; j++) {
					if (!child.containsMarker(parentB.tour[j])) {
						child.tour[i] = parentB.tour[j];
					}
				}
			}
		}
		return child;
	}
	this.mutate = function(tour) {
		for (var i = 0; i < tour.tour.length; i++) {
            if (Math.random() < this.mutationRate) {
                var j = Math.floor(Math.random() * tour.tour.length);

                var markerA = tour.tour[i];
                var markerB = tour.tour[j];

                tour.tour[i] = markerB;
                tour.tour[j] = markerA;
            }
        }
	}
	this.evolvePopulation = function(population) {
		var newPopulation = new Population(population.size(), false);
		var elitismOffset = 0;
		if (this.elitism) {
			elitismOffset = 1;
			newPopulation.tours[0] = population.getFittest();
		}
		for (var i = elitismOffset; i < population.size(); i++) {
			var parentA = this.selectParent(population);
			var parentB = this.selectParent(population);
			var child = this.crossover(parentA, parentB);
			this.mutate(child);
			newPopulation.tours[i] = child;
		}
		return newPopulation;
	}
}
