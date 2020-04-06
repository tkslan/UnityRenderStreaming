using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using Unity.WebRTC;
using System.Text.RegularExpressions;

namespace Unity.RenderStreaming
{
    [Serializable]
    public class ButtonClickEvent : UnityEngine.Events.UnityEvent<int> { }

    [Serializable]
    public class ButtonClickElement
    {
        [Tooltip("Specifies the ID on the HTML")]
        public int elementId;
        public ButtonClickEvent click;
    }

    public class RenderStreaming : MonoBehaviour
    {
#pragma warning disable 0649
        [SerializeField, Tooltip("Address for signaling server")]
        private string urlSignaling = "http://localhost";

        [SerializeField, Tooltip("Array to set your own STUN/TURN servers")]
        private RTCIceServer[] iceServers = new RTCIceServer[]
        {
            new RTCIceServer()
            {
                urls = new string[] { "stun:stun.l.google.com:19302" }
            }
        };

        [SerializeField, Tooltip("Streaming size should match display aspect ratio")]
        private Vector2Int streamingSize = new Vector2Int(1280, 720);

        [SerializeField, Tooltip("Streaming bit rate")]
        private int bitRate = 1000000;

        [SerializeField, Tooltip("Time interval for polling from signaling server")]
        private float interval = 5.0f;

        [SerializeField, Tooltip("Camera to capture video stream")]
        private Camera captureCamera;

        [SerializeField, Tooltip("Enable or disable hardware encoder")]
        private bool hardwareEncoderSupport = true;

        [SerializeField, Tooltip("Array to set your own click event")]
        private ButtonClickElement[] arrayButtonClickEvent;
#pragma warning restore 0649

        private Signaling signaling;
        private Dictionary<string, RTCPeerConnection> pcs = new Dictionary<string, RTCPeerConnection>();
        private Dictionary<RTCPeerConnection, Dictionary<int, RTCDataChannel>> mapChannels = new Dictionary<RTCPeerConnection, Dictionary<int, RTCDataChannel>>();
        private Dictionary<RemoteInput, SimpleCameraController> m_remoteInputAndCameraController = new Dictionary<RemoteInput, SimpleCameraController>();
        private Dictionary<RTCDataChannel, RemoteInput> m_channelIdAndRemoteInput = new Dictionary<RTCDataChannel, RemoteInput>();
        private List<SimpleCameraController> m_listController = new List<SimpleCameraController>();
        private RTCConfiguration conf;
        private string sessionId;
        private MediaStream videoStream;
        private MediaStream audioStream;


        private static RenderStreaming s_instance;

        public static RenderStreaming Instance { get { return s_instance; } }

        public void Awake()
        {
            s_instance = this;
            var encoderType = hardwareEncoderSupport ? EncoderType.Hardware : EncoderType.Software;
            WebRTC.WebRTC.Initialize(encoderType);
            //RemoteInput.Initialize();
            //RemoteInput.ActionButtonClick = OnButtonClick;
        }

        public void OnDestroy()
        {
            s_instance = null;
            WebRTC.WebRTC.Dispose();
            RemoteInputReceiver.Dispose();
            //RemoteInput.Destroy();
            Unity.WebRTC.Audio.Stop();
        }

        public IEnumerator Start()
        {
            videoStream = captureCamera.CaptureStream(streamingSize.x, streamingSize.y, bitRate);
            audioStream = Unity.WebRTC.Audio.CaptureStream();
            signaling = new Signaling(urlSignaling);
            var opCreate = signaling.Create();
            yield return opCreate;
            if (opCreate.webRequest.isNetworkError)
            {
                Debug.LogError($"Network Error: {opCreate.webRequest.error}");
                yield break;
            }
            var newResData = opCreate.webRequest.DownloadHandlerJson<NewResData>().GetObject();
            sessionId = newResData.sessionId;

            conf = default;
            conf.iceServers = iceServers;
            StartCoroutine(WebRTC.WebRTC.Update());
            StartCoroutine(LoopPolling());
        }

        public Vector2Int GetStreamingSize() { return streamingSize; }

        public void AddController(SimpleCameraController controller)
        {
            m_listController.Add(controller);
        }

        public void RemoveController(SimpleCameraController controller)
        {
            m_listController.Remove(controller);
        }

        long lastTimeGetOfferRequest = 0;
        long lastTimeGetCandidateRequest = 0;

        IEnumerator LoopPolling()
        {
            // ignore messages arrived before 30 secs ago
            lastTimeGetOfferRequest = DateTime.UtcNow.ToJsMilliseconds() - 30000;
            lastTimeGetCandidateRequest = DateTime.UtcNow.ToJsMilliseconds() - 30000;

            while (true)
            {
                yield return StartCoroutine(GetOffer());
                yield return StartCoroutine(GetCandidate());
                yield return new WaitForSeconds(interval);
            }
        }

        IEnumerator GetOffer()
        {
            var op = signaling.GetOffer(sessionId, lastTimeGetOfferRequest);
            yield return op;
            if (op.webRequest.isNetworkError)
            {
                Debug.LogError($"Network Error: {op.webRequest.error}");
                yield break;
            }
            var date = DateTimeExtension.ParseHttpDate(op.webRequest.GetResponseHeader("Date"));
            lastTimeGetOfferRequest = date.ToJsMilliseconds();

            var obj = op.webRequest.DownloadHandlerJson<OfferResDataList>().GetObject();
            if (obj == null)
            {
                yield break;
            }
            foreach (var offer in obj.offers)
            {
                RTCSessionDescription _desc;
                _desc.type = RTCSdpType.Offer;
                _desc.sdp = offer.sdp;
                var connectionId = offer.connectionId;
                if (pcs.ContainsKey(connectionId))
                {
                    continue;
                }
                var pc = new RTCPeerConnection();
                pcs.Add(offer.connectionId, pc);

                pc.OnDataChannel = new DelegateOnDataChannel(channel => { OnDataChannel(pc, channel); });
                pc.SetConfiguration(ref conf);
                pc.OnIceCandidate = new DelegateOnIceCandidate(candidate => { StartCoroutine(OnIceCandidate(offer.connectionId, candidate)); });
                pc.OnIceConnectionChange = new DelegateOnIceConnectionChange(state =>
                {
                    if(state == RTCIceConnectionState.Disconnected)
                    {
                        pc.Close();
                    }
                });
                //make video bit rate starts at 16000kbits, and 160000kbits at max.
                string pattern = @"(a=fmtp:\d+ .*level-asymmetry-allowed=.*)\r\n";
                _desc.sdp = Regex.Replace(_desc.sdp, pattern, "$1;x-google-start-bitrate=16000;x-google-max-bitrate=160000\r\n");
                pc.SetRemoteDescription(ref _desc);
                foreach (var track in videoStream.GetTracks())
                {
                    pc.AddTrack(track);
                }
                foreach(var track in audioStream.GetTracks())
                {
                    pc.AddTrack(track);
                }
                StartCoroutine(Answer(connectionId));
            }
        }

        IEnumerator Answer(string connectionId)
        {
            RTCAnswerOptions options = default;
            var pc = pcs[connectionId];
            var op = pc.CreateAnswer(ref options);
            yield return op;
            if (op.IsError)
            {
                Debug.LogError($"Network Error: {op.Error}");
                yield break;
            }

            var desc = op.Desc;
            var opLocalDesc = pc.SetLocalDescription(ref desc);
            yield return opLocalDesc;
            if (opLocalDesc.IsError)
            {
                Debug.LogError($"Network Error: {opLocalDesc.Error}");
                yield break;
            }
            var op3 = signaling.PostAnswer(this.sessionId, connectionId, op.Desc.sdp);
            yield return op3;
            if (op3.webRequest.isNetworkError)
            {
                Debug.LogError($"Network Error: {op3.webRequest.error}");
                yield break;
            }
        }

        IEnumerator GetCandidate()
        {
            var op = signaling.GetCandidate(sessionId, lastTimeGetCandidateRequest);
            yield return op;

            if (op.webRequest.isNetworkError)
            {
                Debug.LogError($"Network Error: {op.webRequest.error}");
                yield break;
            }
            var date = DateTimeExtension.ParseHttpDate(op.webRequest.GetResponseHeader("Date"));
            lastTimeGetCandidateRequest = date.ToJsMilliseconds();

            var obj = op.webRequest.DownloadHandlerJson<CandidateContainerResDataList>().GetObject();
            if (obj == null)
            {
                yield break;
            }
            foreach (var candidateContainer in obj.candidates)
            {
                RTCPeerConnection pc;
                if (!pcs.TryGetValue(candidateContainer.connectionId, out pc))
                {
                    continue;
                }
                foreach (var candidate in candidateContainer.candidates)
                {
                    RTCIceCandidate​ _candidate = default;
                    _candidate.candidate = candidate.candidate;
                    _candidate.sdpMLineIndex = candidate.sdpMLineIndex;
                    _candidate.sdpMid = candidate.sdpMid;

                    pcs[candidateContainer.connectionId].AddIceCandidate(ref _candidate);
                }
            }
        }

        IEnumerator OnIceCandidate(string connectionId, RTCIceCandidate​ candidate)
        {
            var opCandidate = signaling.PostCandidate(sessionId, connectionId, candidate.candidate, candidate.sdpMid, candidate.sdpMLineIndex);
            yield return opCandidate;
            if (opCandidate.webRequest.isNetworkError)
            {
                Debug.LogError($"Network Error: {opCandidate.webRequest.error}");
                yield break;
            }
        }
        void OnDataChannel(RTCPeerConnection pc, RTCDataChannel channel)
        {
            if (!mapChannels.TryGetValue(pc, out var channels))
            {
                channels = new Dictionary<int, RTCDataChannel>();
                mapChannels.Add(pc, channels);
            }
            channels.Add(channel.Id, channel);

            if (channel.Label != "data")
            {
                return;
            }

            RemoteInput input = RemoteInputReceiver.Create();
            m_channelIdAndRemoteInput.Add(channel, input);
            channel.OnMessage = bytes => m_channelIdAndRemoteInput[channel].ProcessInput(bytes);
            channel.OnClose = () => OnCloseChannel(channel);

            SimpleCameraController controller = m_listController
                .FirstOrDefault(_controller => !m_remoteInputAndCameraController.ContainsValue(_controller));

            if(controller != null)
            {
                controller.SetInput(input);
                m_remoteInputAndCameraController.Add(input, controller);
            }
        }

        void OnCloseChannel(RTCDataChannel channel)
        {
            RemoteInput input = m_channelIdAndRemoteInput[channel];
            SimpleCameraController controller = m_remoteInputAndCameraController[input];
            controller.Reset();
            m_remoteInputAndCameraController.Remove(input);
            m_channelIdAndRemoteInput.Remove(channel);
            RemoteInputReceiver.Delete(input);
        }

        void OnButtonClick(int elementId)
        {
            foreach (var element in arrayButtonClickEvent)
            {
                if (element.elementId == elementId)
                {
                    element.click.Invoke(elementId);
                }
            }
        }
    }
}
