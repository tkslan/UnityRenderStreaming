import { VideoPlayer } from "./video-player.js";
import { registerKeyboardEvents, registerMouseEvents, sendClickEvent } from "./register-events.js";

let loader;
let playButton;
let videoPlayer;
let connection;
let bitrateDiv;
let bitrateInfo;
let elementVideo;
let currentResolutionIndex = 5; //720p 
const fpsSamplingRate = 30;
const useAutoSwitch=false;
let eventsRegistered=false;
startVideoPlayer();
showLoader();
setupVideo();


window.document.oncontextmenu = function () {
  return false;     // cancel default menu
}

window.addEventListener('resize', function() {
  videoPlayer.resizeVideo();
}, true);

window.addEventListener('onclose',function(){
videoPlayer.close();
},true);

// Display statistics
setInterval(() => {
  if (connection) {
      loader.style.display = 'none';
      connection.getStats(null)
        .then(showRemoteStats, err => console.log(err));
  }
},1000);

let timestampPrev;
let bytesPrev;
var fpsSum=0;
var fpsMeasures=0;
 function showRemoteStats(results) {
    // calculate video bitrate
  results.forEach(report => {
    const now = report.timestamp;
    let bitrate;
    let fps;
    let mbps;
    if (report.type === 'inbound-rtp' && report.mediaType === 'video' && !report.isRemote) {
      const bytes = report.bytesReceived;
      fps = Number.parseFloat(report.framerateMean).toFixed(2);
      mbps= Number.parseFloat(report.bitrateMean/1000000).toFixed(2);
      if (timestampPrev) {
        bitrate = 8 * (bytes - bytesPrev) / (now - timestampPrev);
        bitrate = Math.floor(bitrate);
      }
      fpsMeasures++;
      fpsSum += report.framerateMean;

      let avrFps = fpsSum / fpsMeasures;
      if(fpsMeasures > fpsSamplingRate && useAutoSwitch){
	
        fpsMeasures = 0;
	fpsSum = 0; 
        
        if(avrFps < 13 && currentResolution > 1) { // && confirm("Fps is too low ("+ (avrFps).toFixed(2)+"), lower resolution")){
          updateResolution(--currentResolution);
        }

        if(avrFps > 18 && currentResolution < 6) { // && confirm("Fps is good ("+ (avrFps).toFixed(2)+"), higher resolution")){
          updateResolution(++currentResolution);
        }
      }
      bytesPrev = bytes;
      timestampPrev = now;
    }
    if (bitrate) {
      bitrate += ' kbits/sec';
      bitrateInfo.innerHTML = `Debug: ${fps} fps, ${mbps} mbps`;
    }
  });
 }

function updateResolution(index) {
 if(videoPlayer!=null && index > 0 && index < 7){ 
  sendClickEvent(videoPlayer,index);
  console.log("New resolution index: "+index);
  currentResolutionIndex = index;
  videoPlayer.close();
  connection=null;
  showLoader();
  setupVideo();
}
}

function showLoader(){
if(!document.getElementById('loader'))
{
loader = document.createElement('img');
loader.id = 'loader';
loader.src = 'images/wobbly.gif';
document.getElementById('player').appendChild(loader);
}
else
{
loader.style.display = 'inherit';
}
}

function showPlayButton() {
  if (!document.getElementById('playButton')) {
    let elementPlayButton = document.createElement('img');
    elementPlayButton.id = 'playButton';
    elementPlayButton.src = 'images/Play.png';
    elementPlayButton.alt = 'Start Streaming';

    playButton = document.getElementById('player').appendChild(elementPlayButton);
    playButton.addEventListener('click',function(){
     videoPlayer.video.play();
    playButton.style.display = 'none';
    });
    playButton.style.display = 'none';
  }
}


function setupVideo(){
  setupVideoPlayer(elementVideo).then((value) =>{
     videoPlayer = value;
     
     videoPlayer.channel.onopen = function(){
	connection = videoPlayer.getConnection;	
        console.log("Rock and roll baby..."+ videoPlayer.connectionId);
        document.getElementById('playButton').style.display= 'block';
        videoPlayer.video.play();

     };
     videoPlayer.onMessage = function(e){
     let resIndex=Number.parseInt(e[0]);
     console.log("Resolution change request: "+resIndex);
     document.querySelector('#bitrateSelect [value="' + resIndex + '"]').selected = true; 
     updateResolution(resIndex);
     }
  });
}
function populateResoultionSelector(defaultIndex, bitrateDiv){

  var bitrates = ["0","144p","240p","360p","480p","720p","1080p"];
  var bitrateSelect = document.createElement("select");
  bitrateSelect.id ="bitrateSelect";
  bitrateDiv.innerHTML="Quality:";
  bitrateDiv.appendChild(bitrateSelect);

 for(var i = 2;i < bitrates.length;i++){
  var option=document.createElement("option");
  option.setAttribute("value", i);
  if(i==defaultIndex)
    option.setAttribute("selected","selected");
  option.text = bitrates[i];
  bitrateSelect.appendChild(option);
  }
  
bitrateSelect.onchange = (evt) => { updateResolution(Number.parseInt(evt.srcElement.value)); } 

}

function startVideoPlayer() {

  //playButton.style.display = 'none';

  const playerDiv = document.getElementById('player');

  // add video player
  elementVideo = document.createElement('video');
  elementVideo.id = 'Video';
  elementVideo.style.touchAction = 'none';
  playerDiv.appendChild(elementVideo);
  showPlayButton();
// add black button
  bitrateDiv = document.createElement('div');
  bitrateDiv.id = "bitrateDiv";

  bitrateInfo = document.createElement('span');
  bitrateInfo.id ="bitrateInfo";
  bitrateInfo.innterHTML="<br> Informations:";
  bitrateDiv.appendChild(bitrateInfo);
  playerDiv.appendChild(bitrateDiv);
  populateResoultionSelector(currentResolutionIndex, bitrateDiv);

  // add fullscreen button
  const elementFullscreenButton = document.createElement('img');
  elementFullscreenButton.id = 'fullscreenButton';
  elementFullscreenButton.src = 'images/FullScreen.png';
  playerDiv.appendChild(elementFullscreenButton);
  elementFullscreenButton.addEventListener ("click", function() {
    if (!document.fullscreenElement) {
      if(document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen();
      }
      else if(document.documentElement.webkitRequestFullscreen){
        document.documentElement.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
      }
    }
  });
  document.addEventListener('webkitfullscreenchange', onFullscreenChange);
  document.addEventListener('fullscreenchange', onFullscreenChange);

  function onFullscreenChange(e) {
    if(document.webkitFullscreenElement || document.fullscreenElement) {
      elementFullscreenButton.style.display = 'none';
    }
    else {
      elementFullscreenButton.style.display = 'block';
    }
  }
}

async function setupVideoPlayer(element, config) {
  const videoPlayer = new VideoPlayer(element, config);
  await videoPlayer.setupConnection();

  videoPlayer.ondisconnect = onDisconnect;
  registerKeyboardEvents(videoPlayer);
  registerMouseEvents(videoPlayer, element, eventsRegistered);
  eventsRegistered=true;
  return videoPlayer;
}

function onDisconnect() {
  const playerDiv = document.getElementById('player')
  clearChildren(playerDiv);
  videoPlayer.close();
  videoPlayer = null;
  showPlayButton();
}

function clearChildren(element) {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}
