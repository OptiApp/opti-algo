var map;
var distanceMatrixService;
var directionsService;
var directionsDisplay;
var bestPolyline;
var curPolyline;

var markers = [];
var locations = [];
var distanceMatrix;

var request = require('request');


exports.getLocations = function(req,res,next){
	locations = 'Vancouver+BC|Seattle'.split('|');
  request('https://maps.googleapis.com/maps/api/distancematrix/json?origins=Vancouver+BC|Seattle&destinations=Vancouver+BC|Seattle&mode=bicycling', function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var response = JSON.parse(body);
      distanceMatrix = new DistanceMatrix(response);
      var best = runGA();
      res.json(best);
    }
  })
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

	for(var i = 0; i < 76; i++){
		population = ga.evolvePopulation(population);
		localBest = population.getFittest();
		if (localBest.getFitness() > best.getFitness()) {
			best = localBest;
			//$("#end").html(best.getDistance() + " seconds");
		}
		//bestPolyline.setPath(best.getPath());
		var ind = Math.floor(Math.random() * locations.length);
	}
	console.log('best tour');
	return best.tour;
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
			for (var i = 0; i < this.tour.length; i++) {
				var x = this.tour[i];
				var y = this.tour[(i + 1) % this.tour.length];
				tourDistance += distanceMatrix.getDuration(x, y);
			}
			this.distance = tourDistance;
		}
		return this.distance;
	}
	this.getFitness = function() {
		if (this.fitness == 0) {
			return 1 / this.getDistance();
		}
		return this.fitness;
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
