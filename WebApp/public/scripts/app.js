import { VideoPlayer } from "./video-player.js";
import { registerKeyboardEvents, registerMouseEvents, sendClickEvent } from "./register-events.js";

let playButton;
let videoPlayer;
let connection;
let bitrateDiv;

startVideoPlayer();

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
      connection.getStats(null)
        .then(showRemoteStats, err => console.log(err));
  }
},1000);

let timestampPrev;
let bytesPrev;

 function showRemoteStats(results) {
    // calculate video bitrate
  results.forEach(report => {
    const now = report.timestamp;
    let bitrate;
    let fps;
    let mbps;
    if (report.type === 'inbound-rtp' && report.mediaType === 'video') {
      const bytes = report.bytesReceived;
      fps = (report.framerateMean).toFixed(2);
      mbps= (report.bitrateMean/1000000).toFixed(2);
      if (timestampPrev) {
        bitrate = 8 * (bytes - bytesPrev) / (now - timestampPrev);
        bitrate = Math.floor(bitrate);
      }
     
      bytesPrev = bytes;
      timestampPrev = now;
    }
    if (bitrate) {
      bitrate += ' kbits/sec';
      bitrateDiv.innerHTML = `Bitrate: ${bitrate}, ${fps} fps, ${mbps} mbps`;
    }
  });
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

function startVideoPlayer() {

  //playButton.style.display = 'none';

  const playerDiv = document.getElementById('player');

  // add video player
  const elementVideo = document.createElement('video');
  elementVideo.id = 'Video';
  elementVideo.style.touchAction = 'none';
  playerDiv.appendChild(elementVideo);
  setupVideoPlayer(elementVideo).then((value) =>{
     videoPlayer = value;
     
     videoPlayer.channel.onopen = function(){
	connection = videoPlayer.getConnection;	
        console.log("Rock and roll baby..."+ videoPlayer.connectionId);
        document.getElementById('playButton').style.display= 'block';
     };
  });
  showPlayButton();

  // add green button
  const b144 = document.createElement('button');
  b144.id = "b144";
  b144.class = "button";
  b144.innerHTML = "144p";
  playerDiv.appendChild(b144);
  b144.addEventListener ("click", function() {
  sendClickEvent(videoPlayer,1);
  window.location.reload(false);	
});

  // add green button
  const b240 = document.createElement('button');
  b240.id = "b240";
  b240.innerHTML = "240p";
  playerDiv.appendChild(b240);
  b240.addEventListener ("click", function() {
    sendClickEvent(videoPlayer, 2);
    window.location.reload(false);
  });

  // add orange button
  const b360 = document.createElement('button');
  b360.id = "b360";
  b360.innerHTML = "360p";
  playerDiv.appendChild(b360);
  b360.addEventListener ("click", function() {
    sendClickEvent(videoPlayer, 3);
    window.location.reload(false);
  });

   // add green button
  let b480 = document.createElement('button');
  b480.id = "b480";
  b480.innerHTML = "480p";
  playerDiv.appendChild(b480);
  b480.addEventListener ("click", function() {
  sendClickEvent(videoPlayer,4);
  window.location.reload(false);	
});
 // add green button
  let b720 = document.createElement('button');
  b720.id = "b720";
  b720.innerHTML = "720p";
  playerDiv.appendChild(b720);
  b720.addEventListener ("click", function() {
  sendClickEvent(videoPlayer,5);
  window.location.reload(false);	
});
// add black button
  const b1080 = document.createElement('button');
  b1080.id = "b1080";
  b1080.innerHTML = "1080p";
  playerDiv.appendChild(b1080);
  b1080.addEventListener ("click", function() {
    sendClickEvent(videoPlayer, 6);
    window.location.reload(false);
  });
// add black button
  bitrateDiv = document.createElement('div');
  bitrateDiv.id = "bitrateDiv";
  bitrateDiv.innerHTML = "Bitrate";
  playerDiv.appendChild(bitrateDiv);

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
  registerMouseEvents(videoPlayer, element);

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
