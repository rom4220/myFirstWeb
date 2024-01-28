//variables globales

var format = 0; //Parámetros de formato

var watchID = null; // Monitorear el ID de la ubicación geográfica

var geolocationOptions = {
  //Opciones de ubicación geográfica
  enableHighAccuracy: true, // modo de alta precisión
  timeout: 10000, // Duración del tiempo de espera (milisegundos)
};

var pointCounter = 0; //Contador de puntos

var pointArray = []; //matriz de puntos

//Definir una estructura de datos de puntos
var point = {
  id: null,
  type: "Feature",
  geometry: {
    type: "Point",
    coordinates: [null, null], //Valores de coordenadas [longitud, latitud]
  },
  properties: {
    //Otras propiedades
    count: 0,
    accuracy: null, // Exactitud
    timestamp: null, // marca de tiempo
    utm: { epsg: null, zone: null, x: null, y: null }, // coordenadas UTM
  },
};

// Leaflet
var map = L.map("map", { zoomControl: false });

// Escala
L.tileLayer('https://{s}.tile.osm.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

L.control.scale().addTo(map);


var osmURL = "https://{s}.tile.osm.org/{z}/{x}/{y}.png";
var osmAttribution =
  '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> contributors';
var osm = L.tileLayer(osmURL, { maxZoom: 20, attribution: osmAttribution });

map.setView([0.0, 0.0], 1);
map.addLayer(osm);

var markerArray = [];
var markers = [];

var markerOptions = {
  radius: 4,
  color: "red",
  fillOpacity: 0.9,
};
map.on('zoomend', function() {
  if (usersPositions) {
    console.log(`Refresh positions`);
    refreshUserPositions(usersPositions);
  }
})


// Multilayer
var currentLayer = "osm";
var pnoa = L.tileLayer.wms(
  "http://www.ign.es/wms-inspire/pnoa-ma?SERVICE=WMS&",
  {
    layers: "OI.OrthoimageCoverage",
    transparent: true,
    format: "image/jpeg",
    version: "1.3.0",
    attribution: "Ortofotos",
  }
);

var baseMaps = {
  osm: osm,
  pnoa: pnoa,
};

// Digit
var digit = false;
var digitNumberID = 0;
var currentUserId = String(Date.now()) + Math.floor(Math.random() * 1000000);

//Punto de inicio de la aplicación
function onDeviceReady() {
  // Obtener la referencia al elemento de la imagen de ubicación
  var locationIcon = document.getElementsByClassName("fa-solid fa-location-dot")[0];
  // Agregar un evento de clic al icono de ubicación
  locationIcon.addEventListener("click", showUserLocationInfo);
  document
  .getElementsByClassName("fa-solid fa-location-dot")[0]
  .addEventListener("click", toggleGeolocation);


  document
    .getElementsByClassName("fa-solid fa-layer-group")[0]
    .addEventListener("click", toggleLayer);

  autocenter();
}

// Función para mostrar la información de la ubicación del usuario actual

function showUserLocationInfo() {
  if (point.geometry.coordinates[0] !== null && point.geometry.coordinates[1] !== null) {
    var userPopup = L.popup()
      .setLatLng([point.geometry.coordinates[1], point.geometry.coordinates[0]])
      .setContent(`Latitude: ${point.geometry.coordinates[1].toFixed(6)}<br>Longitude: ${point.geometry.coordinates[0].toFixed(6)}<br>Accuracy: ${point.properties.accuracy.toFixed(2)} m`)
      .openOn(map);
  } else {
    showToast("Coordinates not found.");
  }
}



// Relacionado con la ubicación geográfica
function toggleGeolocation() {
  // Comprobar si se admite la geolocalización
  if (!navigator.geolocation) {
    showToast("This device does not support geolocation!"); // Muestra información de aviso cuando no es compatible
    return;
  }

  // Determinar si se ha iniciado el seguimiento de la ubicación
  if (watchID === null) {
    watchID = navigator.geolocation.watchPosition(
      geolocationSuccess, // devolución de llamada exitosa
      geolocationError, // devolución de llamada de error
      geolocationOptions // opciones
    );
    //Cambia el color de fuente del elemento fa-solid fa-location-dot a rojo
    document.getElementsByClassName("fa-solid fa-location-dot")[0].style.color =
      "red";
  } else {
    navigator.geolocation.clearWatch(watchID); // Deja de escuchar
    watchID = null;
    //Cambia el color de fuente del elemento fa-solid fa-location-dot a negro
    document.getElementsByClassName("fa-solid fa-location-dot")[0].style.color =
      "black";
  }
}

// Devolución de llamada exitosa de ubicación geográfica
function geolocationSuccess(position) {
  point.geometry.coordinates = [
    position.coords.longitude,
    position.coords.latitude,
  ];
  point.properties.accuracy = position.coords.accuracy;
  point.properties.timestamp = position.timestamp;

  // Llama a la función de conversión (esta función aún no se ha definido)
  // geographicToUTM();

  //Actualiza el texto de coordenadas del elemento HTML
  document.getElementById("coordinates-text").innerHTML = formatCoordinates();

  //La consola imprime información detallada sobre el punto
  //console.log(JSON.stringify(point, null, 4));
  uploadPosition(); //Informar ubicación actual
}

// devolución de llamada de error de geolocalización
function geolocationError(error) {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      showToast("Geolocation request was rejected");
      break;
    case error.POSITION_UNAVAILABLE:
      showToast("Location not available");
      break;
    case error.TIMEOUT:
      showToast("Geolocation request timed out");
      break;
    case error.UNKNOWN_ERROR:
      showToast("Unknown geolocation error.");
      break;
  }
}

// Misceláneas de proyecto
const socket = io();
let usersPositions = [];
const userOrientation = {
  alpha: 0,
  beta: 0,
  gamma: 0
}
let connected = false;

if (window.DeviceOrientationEvent) {
  window.addEventListener('deviceorientation', function(event) {
      var alpha = event.alpha; 
      alpha = (360 - alpha) % 360; // pantalla a arriba 
      var beta = event.beta; 
      var gamma = event.gamma;
      userOrientation.alpha = alpha;
      userOrientation.beta = beta;
      userOrientation.gamma = gamma;
  }, false);
} else {
  alert("Sorry, your browser doesn't support Device Orientation");
}


socket.on('connect', () => {
  connected = true;
});
socket.on('latestPosition', (data) => {
  try {
  
    usersPositions = JSON.parse(data);
    
    refreshUserPositions(usersPositions);
  } catch(err) {

  }
})

if (connected) {

}

//Informar ubicación actual
function uploadPosition() {
  if (connected) {
    console.log('Report current location')
    const userPosition = {
      userId: currentUserId,
      latitude: point.geometry.coordinates[1],
      longitude: point.geometry.coordinates[0],
      accuracy: point.properties.accuracy,
      alpha: userOrientation.alpha,
      beta: userOrientation.beta,
      gamma: userOrientation.gamma
    };
    socket.emit('updatePosition', JSON.stringify(userPosition));
  }
}


// Actualizar marcador
function refreshUserPositions(usersPositions) {
  for (let marker of markers) {
    marker.remove();
  }

  for (const [index, userId] of Object.keys(usersPositions).entries()) {
    const userPosition = usersPositions[userId];
    const { latitude, longitude, alpha, accuracy } = userPosition;

    let fillColor, color;

    
    if (accuracy < 10) {
      fillColor = 'green';
      color = 'green';
    } else if (accuracy >= 10 && accuracy <= 20) {
      fillColor = 'orange';
      color = 'orange';
    } else {
      fillColor = 'red';
      color = 'red';
    }

    const customIcon = L.icon({
      iconUrl: 'img/position.png',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -16],
      className: `marker-${userId}`
    });

    
    const userName = `Usuario ${index + 1}`;

    
    const circleID = L.circle([latitude, longitude], {
      color: color,
      fillColor: fillColor,
      fillOpacity: 0.2,
      radius: accuracy,
      weight: 0.5
    });

    
    const popupContent = `Nombre: ${userName}<br>` + `Latitude: ${latitude.toFixed(6)}<br>` + `Longitude: ${longitude.toFixed(6)}<br>` + `Accuracy: ${accuracy.toFixed(2)}`;

    
    circleID.addTo(map).bindPopup(popupContent);

    
    const markerIcon = L.marker([latitude, longitude], { icon: customIcon });

    
    markerIcon.addTo(map).bindPopup(popupContent);


    markers.push(circleID); 
    markers.push(markerIcon); 
  }
}


//Formatear información de coordenadas
function formatCoordinates() {
  var coordinateString = "";

  if (format == 0) {
    coordinateString += `[lat <span style="font-weight: bold;">${point.geometry.coordinates[1].toFixed(6)}º</span>  `;
    coordinateString += `lon <span style="font-weight: bold;">${point.geometry.coordinates[0].toFixed(6)}º</span>]  `;

    // Asigna el color según el valor de precisión
    var accuracyColor = getAccuracyColor(point.properties.accuracy);
        
    var accuracyParts = point.properties.accuracy.toFixed(2).split('.');

    coordinateString += `[accuracy <span style="color: ${accuracyColor};">${accuracyParts[0]}.${accuracyParts[1]}</span> m]`;
  }

  return coordinateString;
}

// Función para obtener el color de acuerdo al valor de precisión
function getAccuracyColor(accuracy) {
  if (accuracy < 10) {
    return "green"; // Precisión menor a 5 en verde
  } else if (accuracy >= 10 && accuracy <= 20) {
    return "orange"; // Precisión entre 5 y 10 en naranja
  } else {
    return "red"; // Precisión mayor a 10 en rojo
  }
}


//Función para mostrar información de solicitud
function showToast(message = "Default message") {
  var toast = document.getElementById("toast");

  toast.innerHTML = message; //Actualizar el contenido del mensaje
  toast.style.display = "block"; // mostrar mensaje

  setTimeout(hideToast, 5000); //Ocultar después de 5 segundos
}

// Función para ocultar mensajes
function hideToast() {
  document.getElementById("toast").style.display = "none";
}

//Nombre del archivo con fecha y hora de creación
function createDateTimeFilename() {
  var rightNow = new Date();

  var day = ("00" + rightNow.getUTCDate()).substr(-2, 2);
  var month = ("00" + (rightNow.getUTCMonth() + 1)).substr(-2, 2);
  var year = ("0000" + rightNow.getUTCFullYear()).substr(-4, 4);

  var hour = ("00" + rightNow.getUTCHours()).substr(-2, 2);
  var minute = ("00" + rightNow.getUTCMinutes()).substr(-2, 2);
  var second = ("00" + rightNow.getUTCSeconds()).substr(-2, 2);

  var filename = year + month + day + "_" + hour + minute + second + ".geojson";

  return filename;
}


function autocenter() {
  if (!navigator.geolocation) {
    showToast("Geolocation not supported.");
    return;
  }

  navigator.geolocation.getCurrentPosition(currentLocation);
}

function currentLocation(position) {
  pointLongitude = position.coords.longitude;
  pointLatitude = position.coords.latitude;

  map.setView([pointLatitude, pointLongitude], 16);
}

function toggleLayer() {
  // alert("toggleLayer()")
  if (currentLayer == "osm") {
    map.removeLayer(baseMaps["osm"]);
    map.addLayer(baseMaps["pnoa"]);
    currentLayer = "pnoa";
  } else if (currentLayer == "pnoa") {
    map.removeLayer(baseMaps["pnoa"]);
    map.addLayer(baseMaps["osm"]);
    currentLayer = "osm";
  }
}