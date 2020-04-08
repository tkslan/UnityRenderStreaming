import { VideoPlayer } from "./video-player.js";
import { registerKeyboardEvents, registerMouseEvents, sendClickEvent } from "./register-events.js";

let playButton;
let videoPlayer;

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
        console.log("Rock and roll baby...");
        document.getElementById('playButton').style.display= 'block';
     };
  });
  showPlayButton();
/*
  // add green button
  let elementBlueButton = document.createElement('img');
  elementBlueButton.id = "blueButton";
  elementBlueButton.innerHTML = "Start";
  elementBlueButton.src = 'images/Play.png';
  playerDiv.appendChild(elementBlueButton);
  elementBlueButton.addEventListener ("click", function() {
  videoPlayer.video.play();
  elementBlueButton.style.display= 'none';
});

  // add green button
  const elementGreenButton = document.createElement('button');
  elementGreenButton.id = "greenButton";
  elementGreenButton.innerHTML = "Light off";
  playerDiv.appendChild(elementGreenButton);
  elementGreenButton.addEventListener ("click", function() {
    sendClickEvent(videoPlayer, 2);
  });

  // add orange button
  const elementOrangeButton = document.createElement('button');
  elementOrangeButton.id = "orangeButton";
  elementOrangeButton.innerHTML = "Play audio";
  playerDiv.appendChild(elementOrangeButton);
  elementOrangeButton.addEventListener ("click", function() {
    sendClickEvent(videoPlayer, 3);
  });
*/
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
