import Signaling from "./signaling.js"

export class VideoPlayer {
  constructor(element, config) {
    const _this = this;
    this.answerIsSet = false;
    this.candidatesArray = [];
    this.cfg = VideoPlayer.getConfiguration(config);
    this.pc = null;
    this.channel = null;
    this.offerOptions = {
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    };
    this.video = element;
    this.video.playsInline = true;
    this.video.addEventListener('loadedmetadata', function () {
      //_this.video.play();
      _this.resizeVideo();
    }, true);
    this.onMessage = new Event('onMessage');
    this.interval = 1000;
    this.signaling = new Signaling();
    this.ondisconnect = function(){};
    this.sleep = msec => new Promise(resolve => setTimeout(resolve, msec),reject=>console.log(error));   
  }
  get getConnection(){
  return this.pc; 
}

  static getConfiguration(config) {
    if(config === undefined) {
      config = {};
    }
    config.sdpSemantics = 'unified-plan';
    config.iceServers = [
    {
	urls: ["stun:stun.resimo.io:5349","turn:turn.resimo.io:5349"],
	credential: "och6eiRail1a",
	username: "test5"
    }];
   return config;
  }


  async setupConnection() {
    const _this = this;
    // close current RTCPeerConnection
    if (this.pc) {
      console.log('Close current PeerConnection');
      this.pc.close();
      this.pc = null;
    }
    // RTCDataChannel don't work on iOS safari
    // https://github.com/webrtc/samples/issues/1123
    if (
      navigator.userAgent.match(/iPad/i) ||
      navigator.userAgent.match(/iPhone/i) ||
      navigator.userAgent.match(/Safari/i) && !navigator.userAgent.match(/Chrome/i)
    ) {
      	var v = (navigator.appVersion).match(/OS (\d+)_(\d+)_?(\d+)?/);
	if(v!=null) //Not iOS Safari, maybe MacOs
	{
	  var verInfo = [parseInt(v[1], 10), parseInt(v[2], 10), parseInt(v[3] || 0, 10)];
      	  if(verInfo[0] <= 12)
      	  {
           alert("Twój system iOS nie jest aktualny.\nProsimy o potwierdzenie dodatkowych uprawnień w następnym okienku.");
           let stream = await navigator.mediaDevices.getUserMedia({audio: true});
           stream.getTracks().forEach(t => t.stop()); 
          }
	}
     }

    // Create peerConnection with proxy server and set up handlers
    this.pc = new RTCPeerConnection(this.cfg);
    this.pc.onsignalingstatechange = function (e) {
      console.log('signalingState changed:', e);
    };
    this.pc.oniceconnectionstatechange = function (e) {
      console.log('iceConnectionState changed:', e);
      console.log('pc.iceConnectionState:' + _this.pc.iceConnectionState);
      if(_this.pc.iceConnectionState === 'disconnected') {
        _this.ondisconnect();
      }
    };
    this.pc.onicegatheringstatechange = function (e) {
      console.log('iceGatheringState changed:', e);
    };
    this.pc.ontrack = function (e) {
      console.log('New track added: ', e.streams);
      _this.video.srcObject = e.streams[0];
    };
    this.pc.onicecandidate = function (e) {
      if(e.candidate != null) {
        _this.signaling.sendCandidate(_this.sessionId, _this.connectionId, e.candidate.candidate, e.candidate.sdpMid, e.candidate.sdpMLineIndex);
      }
    };
    // Create data channel with proxy server and set up handlers
    this.channel = this.pc.createDataChannel('data');
    this.channel.onopen = function () {
      console.log('Datachannel connected. playin...');
    };

    this.channel.onmessage = function (e){
    let messageData = e.data;
    if(messageData[0]==='R')
        _this.onMessage(messageData[1]);
     console.log("Message recived: "+messageData[1]);
};
    this.channel.onerror = function (e) {
      console.log("The error " + e.error.message + " occurred\n while handling data with proxy server.");
    };

    this.channel.onclose = function () {
      console.log('Datachannel disconnected.');
    };

    const createResponse = await this.signaling.create();
    const data = await createResponse.json();
    this.sessionId = data.sessionId;

    // create offer
    const offer = await this.pc.createOffer(this.offerOptions);

    await this.createConnection();
    // set local sdp
    offer.sdp = offer.sdp.replace(/(a=fmtp:\d+ .*level-asymmetry-allowed=.*)\r\n/gm, "$1;x-google-start-bitrate=20000;x-google-max-bitrate=100000\r\n");
    //offer.sdp = offer.sdp.replace(/useinbandfec=1/, 'useinbandfec=1;stereo=1;maxaveragebitrate=10485760');
    const desc = new RTCSessionDescription({sdp:offer.sdp, type:"offer"});
    await this.pc.setLocalDescription(desc);
    await this.sendOffer(offer);
  }

  async createConnection() {
    // signaling
    const res = await this.signaling.createConnection(this.sessionId);
    const data = await res.json();
    this.connectionId = data.connectionId;
  }

  async sendOffer(offer) {
    // signaling
    await this.signaling.sendOffer(this.sessionId, this.connectionId, offer.sdp);
    this.loopGetAnswer(this.sessionId, this.interval);
    this.loopGetCandidate(this.sessionId, this.interval);
  }

  async loopGetAnswer(sessionId, interval) {
    // receive answer message from 30secs ago
    let lastTimeRequest = Date.now() - 30000;

    while(true) {
      const res = await this.signaling.getAnswer(sessionId, lastTimeRequest);
      const data = await res.json();
      const answers = data.answers;
      lastTimeRequest = Date.parse(res.headers.get('Date'));

      if(answers.length > 0) {
        const answer = answers[0];
        await this.setAnswer(sessionId, answer.sdp);
	
	this.answerIsSet = true;
	var len = this.candidatesArray.length;
	
	for(var i = 0; i < len; i++)
	{
	   var item  = this.candidatesArray[i];
	   await this.pc.addIceCandidate(item);
	   console.log("Added from cache: " + item);
	}

      }
      await this.sleep(interval);
    }
  }

  async loopGetCandidate(sessionId, interval) {
    // receive answer message from 30secs ago
    let lastTimeRequest = Date.now() - 30000;

    while(true) {
      const res = await this.signaling.getCandidate(sessionId, lastTimeRequest);
      lastTimeRequest = Date.parse(res.headers.get('Date'));

      const data = await res.json();
      const candidates = data.candidates.filter(v => v.connectionId = this.connectionId);
      if(candidates.length > 0) {
        for(let candidate of candidates[0].candidates) {
          var iceCandidate = new RTCIceCandidate({ candidate: candidate.candidate, sdpMid: candidate.sdpMid, sdpMLineIndex: candidate.sdpMLineIndex});
          
	  if (!this.answerIsSet)
	     this.candidatesArray.push(iceCandidate);	
	  else
	     await this.pc.addIceCandidate(iceCandidate);
        }
      }
      await this.sleep(interval);
    }
  }

  async setAnswer(sessionId, sdp) {
    const desc = new RTCSessionDescription({sdp:sdp, type:"answer"});
    await this.pc.setRemoteDescription(desc);
  }

  resizeVideo() {
    const clientRect = this.video.getBoundingClientRect();
    const videoRatio = this.videoWidth / this.videoHeight;
    const clientRatio = clientRect.width / clientRect.height;

    this._videoScale = videoRatio > clientRatio ? clientRect.width / this.videoWidth : clientRect.height / this.videoHeight;
    const videoOffsetX = videoRatio > clientRatio ? 0 : (clientRect.width - this.videoWidth * this._videoScale) * 0.5;
    const videoOffsetY = videoRatio > clientRatio ? (clientRect.height - this.videoHeight * this._videoScale) * 0.5 : 0;
    this._videoOriginX = clientRect.left + videoOffsetX;
    this._videoOriginY = clientRect.top + videoOffsetY;
  }

  get videoWidth() {
    return this.video.videoWidth;
  }

  get videoHeight() {
    return this.video.videoHeight;
  }

  get videoOriginX() {
    return this._videoOriginX;
  }

  get videoOriginY() {
    return this._videoOriginY;
  }

  get videoScale() {
    return this._videoScale;
  }

  close() {
    if (this.pc) {
      this.sleep = null;
      console.log('Close current PeerConnection');
      this.pc.close();
      this.pc = null;
    }
  };


  sendMsg(msg) {
    if(this.channel == null) {
      return;
    }
    switch (this.channel.readyState) {
      case 'connecting':
        console.log('Connection not ready');
        break;
      case 'open':
        this.channel.send(msg);
        break;
      case 'closing':
        console.log('Attempt to sendMsg message while closing');
        break;
      case 'closed':
        console.log( 'Attempt to sendMsg message while connection closed.');
        break;
    }
  };

  showRemoteStats(results) {
    const timestampPrev = null;
    const bytesPrev = null;


    // calculate video bitrate
  results.forEach(report => {
    const now = report.timestamp;
    let bitrate;
    if (report.type === 'inbound-rtp' && report.mediaType === 'video') {
      const bytes = report.bytesReceived;
      if (this.timestampPrev) {
        bitrate = 8 * (bytes - this.bytesPrev) / (now - this.timestampPrev);
        bitrate = Math.floor(bitrate);
      }
      this.bytesPrev = bytes;
      this.timestampPrev = now;
    }
    if (bitrate) {
      bitrate += ' kbits/sec';
      elementFullscreenButton.innerHTML = `<strong>Bitrate:</strong>${bitrate}`;
    }
  });
 };
}
