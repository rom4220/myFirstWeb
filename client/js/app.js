// 全局变量

var format = 0; // 格式化参数

var watchID = null; // 监听地理位置的ID

var geolocationOptions = {
  // 地理位置选项
  enableHighAccuracy: true, // 高精度模式
  timeout: 10000, // 超时时长（毫秒）
};

var pointCounter = 0; // 点的计数器

var pointArray = []; // 点的数组

// 定义一个点的数据结构
var point = {
  id: null,
  type: "Feature",
  geometry: {
    type: "Point",
    coordinates: [null, null], // 坐标值 [经度, 纬度]
  },
  properties: {
    // 其他属性
    count: 0,
    accuracy: null, // 精确度
    timestamp: null, // 时间戳
    utm: { epsg: null, zone: null, x: null, y: null }, // UTM坐标
  },
};

// Leaflet

var map = L.map("map", { zoomControl: false });

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

// App启动点
function onDeviceReady() {
  // showToast("onDeviceReady()");
  // Add event listeners
  document
    .getElementsByClassName("fa-solid fa-location-dot")[0]
    .addEventListener("click", toggleGeolocation);

  document
    .getElementsByClassName("fa-solid fa-keyboard")[0]
    .addEventListener("click", toggleIDBox);

  document
    .getElementsByClassName("fa-solid fa-square-plus")[0]
    .addEventListener("click", storePoint);

  document
    .getElementsByClassName("fa-solid fa-square-xmark")[0]
    .addEventListener("click", clearMemory);

  document
    .getElementsByClassName("fa-solid fa-floppy-disk")[0]
    .addEventListener("click", saveToJSON);

  document
    .getElementsByClassName("fa-solid fa-layer-group")[0]
    .addEventListener("click", toggleLayer);

  document
    .getElementsByClassName("fa-solid fa-location-crosshairs")[0]
    .addEventListener("click", toggleDigit);

  autocenter();
}

// 地理位置相关
function toggleGeolocation() {
  // 检查是否支持地理位置
  if (!navigator.geolocation) {
    showToast("此设备不支持地理位置!"); // 不支持时显示提示信息
    return;
  }

  // 判断是否已启动地理位置监听
  if (watchID === null) {
    watchID = navigator.geolocation.watchPosition(
      geolocationSuccess, // 成功回调
      geolocationError, // 错误回调
      geolocationOptions // 选项
    );
    // 改变fa-solid fa-location-dot元素的字体颜色为红色
    document.getElementsByClassName("fa-solid fa-location-dot")[0].style.color =
      "red";
  } else {
    navigator.geolocation.clearWatch(watchID); // 停止监听
    watchID = null;
    // 改变fa-solid fa-location-dot元素的字体颜色为黑色
    document.getElementsByClassName("fa-solid fa-location-dot")[0].style.color =
      "black";
  }
}

// 地理位置成功回调
function geolocationSuccess(position) {
  point.geometry.coordinates = [
    position.coords.longitude,
    position.coords.latitude,
  ];
  point.properties.accuracy = position.coords.accuracy;
  point.properties.timestamp = position.timestamp;

  // 调用转换函数（该函数尚未定义）
  // geographicToUTM();

  // 更新HTML元素的坐标文本
  document.getElementById("coordinates-text").innerHTML = formatCoordinates();

  // 控制台打印点的详细信息
  //console.log(JSON.stringify(point, null, 4));
  uploadPosition(); // 上报当前位置
}

// 地理位置错误回调
function geolocationError(error) {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      showToast("地理位置请求被拒绝。");
      break;
    case error.POSITION_UNAVAILABLE:
      showToast("位置不可用。");
      break;
    case error.TIMEOUT:
      showToast("地理位置请求超时。");
      break;
    case error.UNKNOWN_ERROR:
      showToast("未知的地理位置错误。");
      break;
  }
}

// 杂项

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

// 上报当前位置
function uploadPosition() {
  if (connected) {
    console.log('上报当前位置')
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

// 刷新marker
function refreshUserPositions(usersPositions) {
  for (let marker of markers) {
    marker.remove();
  }
  for (const userId in usersPositions) {
    const userPosition = usersPositions[userId];
    const {latitude, longitude, alpha, accuracy} = userPosition;

    const customIcon = L.icon({
      iconUrl: 'img/position.png', 
      iconSize: [32,32], 
      iconAnchor: [16, 0], 
      popupAnchor: [0, -32],
      className: `marker-${userId}`
    });
    const markID = L.marker([latitude, longitude], {
      icon: customIcon,
      rotationAngle: alpha - 180,
      className: 'marker'
    });
    
    
    if (map._zoom > 14) {
      const circleID = L.circle([latitude, longitude], {
        color: 'red',
        fillColor: '#f03',
        fillOpacity: 0.2,
        radius: accuracy ,
        weight: 2
      });
      circleID.addTo(map);
      markers.push(circleID);
    }
    
   
    markID.addTo(map);
    
    markers.push(markID);
    
  }
}

// 格式化坐标信息
function formatCoordinates() {
  var coordinateString = "";

  if (format == 0) {
    coordinateString +=
      point.geometry.coordinates[1].toFixed(8) +
      "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;";
    coordinateString +=
      point.geometry.coordinates[0].toFixed(8) +
      "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[";
    coordinateString += point.properties.accuracy.toFixed(2) + "]";
  }

  return coordinateString;
}

// 地理坐标转UTM坐标函数（未完成）
function geographicToUTM() {}

// 显示提示信息的函数
function showToast(message = "默认消息。") {
  var toast = document.getElementById("toast");

  toast.innerHTML = message; // 更新提示内容
  toast.style.display = "block"; // 显示提示

  setTimeout(hideToast, 5000); // 5秒后隐藏
}

// 隐藏提示的函数
function hideToast() {
  document.getElementById("toast").style.display = "none";
}

// 创建日期时间的文件名
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

// W1 App
function toggleIDBox() {
  // alert("toggleIDBox()");
  var pointID = document.getElementById("point-id");
  var pointIDText = document.getElementById("point-id-text");

  if (pointID.style.display == "none") {
    pointID.style.display = "block";
  } else if (pointID.style.display == "block") {
    pointID.style.display = "none";
  }
}

function storePoint() {
  // alert("storePoint()")
  // Check there are coordinates

  if (
    point.geometry.coordinates[0] === null ||
    point.geometry.coordinates[1] === null
  ) {
    showToast("Coordinates not found.");
    return;
  }

  // Point Number
  var pointNumberID = ("0000" + pointArray.length.toString()).substr(-4);
  console.log(pointNumberID);

  var pointIDText = document.getElementById("point-id-text");
  // console.log(pointIDText.value);

  if (pointIDText.value.trim() === "") {
    point.id = pointNumberID;
  } else {
    point.id = pointIDText.value.trim();
  }

  // Point counter
  point.properties.count = pointArray.length;

  // Add point to Array
  pointArray.push(JSON.parse(JSON.stringify(point)));

  // Reset text box
  pointIDText.value = "";

  // Hide text box, if necessary
  var pointID = document.getElementById("point-id");

  if (pointID.style.display == "block") {
    pointID.style.display = "none";
  }

  var latitude = point.geometry.coordinates[1];
  var longitude = point.geometry.coordinates[0];
  var markID = L.circle([latitude, longitude], markerOptions);

  var markerPopup =
    "ID = " +
    pointNumberID +
    "<br/>" +
    "User ID: " +
    point.id +
    "<br/>" +
    "Latitude: " +
    latitude.toFixed(8) +
    "<br/>" +
    "Longitude: " +
    longitude.toFixed(8) +
    "<br/>" +
    "Accuracy: " +
    point.properties.accuracy.toFixed(2);

  markID.bindPopup(markerPopup);

  markID.addTo(map);
  markerArray.push(markID);

  resetPoint();

  console.log(JSON.stringify(pointArray, null, 4));
}

function resetPoint() {
  point = {
    id: null,
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [null, null], // 坐标值 [经度, 纬度]
    },
    properties: {
      // 其他属性
      count: 0,
      accuracy: null, // 精确度
      timestamp: null, // 时间戳
      utm: { epsg: null, zone: null, x: null, y: null }, // UTM坐标
    },
  };
}

function clearMemory() {
  // showToast("clearMemory()");

  // Check there are data to remove
  if (pointArray.length == 0) {
    showToast("there are not data yet");
    return;
  }

  // Ask to clear memory
  var clearMemoryContents = confirm(
    "All collected data will be lost. roceed? "
  );
  if (!clearMemoryContents) {
    return;
  }

  // Leaflet
  for (var i = 0; i < markerArray.length; i++) {
    map.removeLayer(markerArray[i]);
  }
  markerArray = [];

  pointArray = [];
  resetPoint();

  document.getElementById("coordinates-text").innerHTML = "";
}

function saveToJSON() {
  // Check there are data to save
  if (pointArray.length == 0) {
    showToast("there are not data yet");
    return;
  }

  var filename = createDateTimeFilename();
  console.log(filename);

  var geojson = { type: "FeatureCollection", features: pointArray };

  // MINE (multipurpose internet mail extension)

  var mine = "data:application/json;charset=utf-8,";

  // Virtual Link
  var saveLink = document.createElement("a");

  // Link attributes
  saveLink.setAttribute(
    "href",
    mine + encodeURI(JSON.stringify(geojson, null, 4))
  );

  saveLink.setAttribute("download", filename);

  // Save by click
  document.body.appendChild(saveLink);
  saveLink.click();
  document.body.removeChild(saveLink);

  // Ask to clear memory
  var clearMemoryContents = confirm(
    "All collected data will be lost. roceed? "
  );
  if (!clearMemoryContents) {
    return;
  }

  for (var i = 0; i < markerArray.length; i++) {
    map.removeLayer(markerArray[i]);
  }
  markerArray = [];

  // reset values
  pointArray = [];
  resetPoint();
  // document.getElementById("coordinates-text").innerHTML = "";

  // Message to user
  showToast("Data saved to file " + filename);
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

function toggleDigit() {
  // alert("toggleDigit()");
  if (!digit) {
    digit = true;
    document.getElementsByClassName(
      "fa-solid fa-location-crosshairs"
    )[0].style.color = "orange";

    // Enable leaflet click event
    map.on("click", captureCoordinates);
    document.getElementById("map").style.cursor = "crosshair";
  } else {
    digit = false;
    document.getElementsByClassName(
      "fa-solid fa-location-crosshairs"
    )[0].style.color = "black";

    // Disable leaflet click event
    map.off("click", captureCoordinates);
    document.getElementById("map").style.cursor = "grab";
  }
}

function captureCoordinates(event) {
  // alert("captureCoordinates()");
  var coordinates = event.latlng;
  var latitude = coordinates.lat;
  var longitude = coordinates.lng;

  console.log(latitude, longitude);

  var digitMarkerOptions = {
    radius: 4,
    color: "blue",
    fillOpacity: 0.9,
  };

  var markID = L.circle([latitude, longitude], digitMarkerOptions);
  markID.addTo(map);

  var markerPopup =
    "ID = " +
    digitNumberID +
    "<br/>" +
    "Latitude = " +
    latitude.toFixed(8) +
    "<br/>" +
    "Longitude = " +
    longitude.toFixed(8) +
    "<br/>" +
    "Source = Digit";

  markID.bindPopup(markerPopup)
  digitNumberID += 1
}
