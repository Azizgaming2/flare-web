import { useEffect, useRef, useState } from "react";
import { auth } from "../firebase";
import { classSocketUrl } from "../api/classApi";

const END_BY_CODE = { 4002: "replaced", 4003: "kicked", 4004: "not_found", 4005: "full" };

function bitrateFor(role, count) {
  if (role !== "host") return 200000;
  if (count <= 6) return 500000;
  return count <= 15 ? 300000 : 180000;
}

export function useClassRoom(code, userName) {
  const [me, setMe] = useState(null);
  const [peers, setPeers] = useState({});
  const [msgs, setMsgs] = useState([]);
  const [title, setTitle] = useState("");
  const [streams, setStreams] = useState({});
  const [mic, setMic] = useState(false);
  const [cam, setCam] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [screenOn, setScreenOn] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [ended, setEnded] = useState("");
  const [notice, setNotice] = useState("");

  const ws = useRef(null);
  const pcs = useRef(new Map());
  const ice = useRef([]);
  const meRef = useRef(null);
  const peersRef = useRef({});
  const media = useRef({ audio: null, cam: null, screen: null });
  const noticeTimer = useRef(null);

  function send(obj) {
    if (ws.current && ws.current.readyState === 1) ws.current.send(JSON.stringify(obj));
  }

  function flash(key) {
    setNotice(key);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(""), 4000);
  }

  function setP(update) {
    peersRef.current = update(peersRef.current);
    setPeers(peersRef.current);
  }

  function eachSender(kind, fn) {
    pcs.current.forEach((pc) =>
      pc.getTransceivers().forEach((t) => {
        if (t.receiver.track && t.receiver.track.kind === kind) fn(t.sender);
      })
    );
  }

  function capBitrate() {
    const bps = bitrateFor(meRef.current?.role, Object.keys(peersRef.current).length);
    eachSender("video", (sender) => {
      try {
        const params = sender.getParameters();
        if (!params.encodings || !params.encodings.length) params.encodings = [{}];
        params.encodings[0].maxBitrate = bps;
        sender.setParameters(params).catch(() => {});
      } catch {
        return;
      }
    });
  }

  function outgoingVideo() {
    return media.current.screen || media.current.cam || null;
  }

  function applyVideo() {
    const track = outgoingVideo();
    eachSender("video", (sender) => sender.replaceTrack(track).catch(() => {}));
    setLocalStream(track ? new MediaStream([track]) : null);
    capBitrate();
  }

  function applyAudio() {
    eachSender("audio", (sender) => sender.replaceTrack(media.current.audio).catch(() => {}));
  }

  function pushState() {
    send({ type: "state", mic: !!media.current.audio, cam: !!outgoingVideo() });
  }

  function closePc(pid) {
    const pc = pcs.current.get(pid);
    if (pc) {
      pc.close();
      pcs.current.delete(pid);
    }
    setStreams((s) => {
      if (!s[pid]) return s;
      const next = { ...s };
      delete next[pid];
      return next;
    });
  }

  function makePc(pid) {
    const pc = new RTCPeerConnection({ iceServers: ice.current });
    pc.queue = [];
    pc.onicecandidate = (e) => {
      if (e.candidate) send({ type: "signal", to: pid, data: { candidate: e.candidate } });
    };
    pc.ontrack = (e) => {
      pc.ms = pc.ms || new MediaStream();
      pc.ms.addTrack(e.track);
      setStreams((s) => ({ ...s, [pid]: pc.ms }));
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") capBitrate();
      if (pc.connectionState === "failed" && meRef.current?.role === "host") {
        closePc(pid);
        setTimeout(() => {
          if (peersRef.current[pid]) callPeer(pid);
        }, 1500);
      }
    };
    pcs.current.set(pid, pc);
    return pc;
  }

  async function callPeer(pid) {
    closePc(pid);
    const pc = makePc(pid);
    const audio = pc.addTransceiver("audio", { direction: "sendrecv" });
    const video = pc.addTransceiver("video", { direction: "sendrecv" });
    await Promise.all([
      audio.sender.replaceTrack(media.current.audio),
      video.sender.replaceTrack(outgoingVideo()),
    ]).catch(() => {});
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    send({ type: "signal", to: pid, data: { sdp: pc.localDescription } });
  }

  function flushQueue(pc) {
    pc.queue.forEach((c) => pc.addIceCandidate(c).catch(() => {}));
    pc.queue = [];
  }

  async function onSignal(from, data) {
    if (!data) return;
    let pc = pcs.current.get(from);
    if (data.sdp) {
      if (data.sdp.type === "offer") {
        if (!pc || pc.remoteDescription) {
          if (pc) closePc(from);
          pc = makePc(from);
        }
        await pc.setRemoteDescription(data.sdp);
        for (const t of pc.getTransceivers()) {
          t.direction = "sendrecv";
          const track = t.receiver.track.kind === "audio" ? media.current.audio : outgoingVideo();
          await t.sender.replaceTrack(track).catch(() => {});
        }
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        send({ type: "signal", to: from, data: { sdp: pc.localDescription } });
        flushQueue(pc);
        capBitrate();
      } else if (pc) {
        await pc.setRemoteDescription(data.sdp);
        flushQueue(pc);
      }
    } else if (data.candidate) {
      if (!pc) pc = makePc(from);
      if (pc.remoteDescription) pc.addIceCandidate(data.candidate).catch(() => {});
      else pc.queue.push(data.candidate);
    }
  }

  function stopMic() {
    if (media.current.audio) media.current.audio.stop();
    media.current.audio = null;
    setMic(false);
    applyAudio();
    pushState();
  }

  function handle(m) {
    switch (m.type) {
      case "joined": {
        ice.current = m.ice;
        meRef.current = { pid: m.you, role: m.role };
        setMe(meRef.current);
        const map = {};
        m.peers.forEach((p) => {
          map[p.pid] = p;
        });
        peersRef.current = map;
        setPeers(map);
        setMsgs(m.history);
        setTitle(m.title);
        if (m.role === "host") m.peers.filter((p) => p.pid !== m.you).forEach((p) => callPeer(p.pid));
        break;
      }
      case "peer_join":
        setP((p) => ({ ...p, [m.peer.pid]: m.peer }));
        if (meRef.current?.role === "host") callPeer(m.peer.pid);
        capBitrate();
        break;
      case "peer_leave":
        closePc(m.pid);
        setP((p) => {
          const next = { ...p };
          delete next[m.pid];
          return next;
        });
        capBitrate();
        break;
      case "chat":
        setMsgs((a) => [...a.slice(-299), m.msg]);
        break;
      case "signal":
        onSignal(m.from, m.data).catch(() => {});
        break;
      case "state":
        setP((p) => (p[m.pid] ? { ...p, [m.pid]: { ...p[m.pid], mic: m.mic, cam: m.cam, muted: m.muted } } : p));
        if (m.pid === meRef.current?.pid && m.muted && media.current.audio) stopMic();
        break;
      case "screen":
        setScreenOn(m.on);
        break;
      case "closed":
        setEnded("closed");
        break;
      case "kicked":
        setEnded("kicked");
        break;
      case "error":
        setEnded(m.reason === "full" ? "full" : "not_found");
        break;
      default:
        break;
    }
  }

  useEffect(() => {
    let stopped = false;
    const socket = new WebSocket(classSocketUrl(code));
    ws.current = socket;
    socket.onopen = async () => {
      try {
        const token = await auth.currentUser.getIdToken();
        socket.send(JSON.stringify({ type: "auth", token, name: userName }));
      } catch {
        socket.close();
      }
    };
    socket.onmessage = (e) => {
      try {
        handle(JSON.parse(e.data));
      } catch {
        return;
      }
    };
    socket.onclose = (e) => {
      if (!stopped) setEnded((v) => v || END_BY_CODE[e.code] || "lost");
    };
    const ping = setInterval(() => send({ type: "ping" }), 25000);
    const mediaRef = media.current;
    const pcMap = pcs.current;
    return () => {
      stopped = true;
      clearInterval(ping);
      clearTimeout(noticeTimer.current);
      socket.close();
      pcMap.forEach((pc) => pc.close());
      pcMap.clear();
      Object.values(mediaRef).forEach((track) => track && track.stop());
      mediaRef.audio = null;
      mediaRef.cam = null;
      mediaRef.screen = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  async function toggleMic() {
    if (media.current.audio) {
      stopMic();
      return;
    }
    if (peersRef.current[meRef.current?.pid]?.muted) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      media.current.audio = stream.getAudioTracks()[0];
      setMic(true);
      applyAudio();
      pushState();
    } catch {
      flash("mic_denied");
    }
  }

  async function toggleCam() {
    if (media.current.cam) {
      media.current.cam.stop();
      media.current.cam = null;
      setCam(false);
      applyVideo();
      pushState();
      return;
    }
    try {
      const many = Object.keys(peersRef.current).length > 8;
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: many ? 480 : 640 },
          height: { ideal: many ? 270 : 360 },
          frameRate: { ideal: many ? 10 : 15 },
        },
      });
      media.current.cam = stream.getVideoTracks()[0];
      setCam(true);
      applyVideo();
      pushState();
    } catch {
      flash("cam_denied");
    }
  }

  function stopScreen() {
    if (media.current.screen) media.current.screen.stop();
    media.current.screen = null;
    setSharing(false);
    send({ type: "screen", on: false });
    applyVideo();
    pushState();
  }

  async function toggleScreen() {
    if (media.current.screen) {
      stopScreen();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 10 } });
      const track = stream.getVideoTracks()[0];
      track.onended = stopScreen;
      media.current.screen = track;
      setSharing(true);
      send({ type: "screen", on: true });
      applyVideo();
      pushState();
    } catch {
      return;
    }
  }

  return {
    me,
    peers,
    msgs,
    title,
    streams,
    mic,
    cam,
    sharing,
    screenOn,
    localStream,
    ended,
    notice,
    canShare: !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia),
    flash,
    toggleMic,
    toggleCam,
    toggleScreen,
    sendChat: (text, md) => send({ type: "chat", text, md: !!md }),
    mute: (target, value) => send({ type: "mute", target, value }),
    kick: (target) => send({ type: "kick", target }),
    endClass: () => send({ type: "end" }),
  };
}
