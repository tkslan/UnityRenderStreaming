using UnityEngine;
using UnityEngine.TestTools;
using NUnit.Framework;
using System.Collections;
using Unity.RenderStreaming;
using Unity.WebRTC;

namespace Unity.Template.RenderStreaming
{
    public class SignalingTest
    {
        const string urlSignaling = "http://localhost";

        Signaling signaling;

        [SetUp]
        public void SetUp()
        {
            WebRTC.WebRTC.Initialize();
            signaling = new Signaling(urlSignaling);
        }

        [TearDown]
        public void TearDown()
        {
            WebRTC.WebRTC.Finalize();
        }

        public IEnumerator CreateSession()
        {
            var signaling = new Signaling(urlSignaling);
            var opCreate = signaling.Create();
            yield return opCreate;
            Assert.False(opCreate.webRequest.isNetworkError);
            var newResData = opCreate.webRequest.DownloadHandlerJson<NewResData>().GetObject();
            yield return newResData.sessionId;
        }

        public IEnumerator CreateConnection(string sessionId)
        {
            var createSession = signaling.CreateConnection(sessionId);
            yield return createSession;
            Assert.IsFalse(createSession.webRequest.isNetworkError);
            var createConnectionResData = createSession.webRequest.DownloadHandlerJson<CreateConnectionResData>().GetObject();
            yield return createConnectionResData.connectionId;
        }

        public IEnumerator PostOffer(string sessionId, string connectionId, string sdp)
        {
            var postOffer = signaling.PostOffer(sessionId, connectionId, sdp);
            yield return postOffer;
            Assert.IsFalse(postOffer.webRequest.isNetworkError);
        }

        public IEnumerator GetOffer(string sessionId, string connectionId)
        {
            var getOffer = signaling.GetOffer(sessionId);
            yield return getOffer;
            Assert.IsFalse(getOffer.webRequest.isNetworkError);
            var offerResData = getOffer.webRequest.DownloadHandlerJson<OfferResDataList>().GetObject();
            yield return offerResData.offers;
        }

        [UnityTest]
        public IEnumerator TestCreateSession()
        {
            var coroutine = CreateSession();
            yield return coroutine;
            var sessionId = coroutine.Current as string;
            Assert.IsNotEmpty(sessionId);
        }

        [UnityTest]
        public IEnumerator TestCreateConnection()
        {
            var coroutine = CreateSession();
            yield return coroutine;
            var sessionId = coroutine.Current as string;

            var coroutine2 = CreateConnection(sessionId);
            yield return coroutine2;
            var connectionId = coroutine2.Current as string;
            Assert.IsNotEmpty(connectionId);
        }

        [UnityTest]
        public IEnumerator TestPostOffer()
        {
            var coroutine = CreateSession();
            yield return coroutine;
            var sessionId = coroutine.Current as string;

            var coroutine2 = CreateConnection(sessionId);
            yield return coroutine2;
            var connectionId = coroutine2.Current as string;

            var peer = new RTCPeerConnection();
            RTCOfferOptions options = default;
            var op = peer.CreateOffer(ref options);
            yield return op;
            var op2 = peer.SetLocalDescription(ref op.desc);
            var coroutine3 = PostOffer(sessionId, connectionId, op2.desc.sdp);
            yield return coroutine3;
            var coroutine4 = GetOffer(sessionId, connectionId);
            yield return coroutine4;
            var offers = coroutine4.Current as OfferResData[];
            Assert.AreEqual(1, offers.Length);
        }
    }
}
