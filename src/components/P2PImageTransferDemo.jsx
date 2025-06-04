import React, { useRef, useState } from 'react';
import { db } from '../utils/firebase';
import { doc, setDoc, onSnapshot, deleteDoc } from 'firebase/firestore';

// Hardcoded room for demo
const SIGNAL_ROOM = 'p2p-demo-room';

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binary = window.atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export default function P2PImageTransferDemo() {
  const [localImage, setLocalImage] = useState(null);
  const [receivedImage, setReceivedImage] = useState(null);
  const [status, setStatus] = useState('Idle');
  const pcRef = useRef(null);
  const dataChannelRef = useRef(null);
  const [isSender, setIsSender] = useState(false);

  // --- Signaling helpers ---
  async function sendSignal(data) {
    await setDoc(doc(db, 'p2p_signals', SIGNAL_ROOM), data);
  }
  function listenSignal(onSignal) {
    return onSnapshot(doc(db, 'p2p_signals', SIGNAL_ROOM), (snap) => {
      if (snap.exists()) onSignal(snap.data());
    });
  }
  async function clearSignal() {
    await deleteDoc(doc(db, 'p2p_signals', SIGNAL_ROOM));
  }

  // --- WebRTC setup ---
  async function startAsSender() {
    setIsSender(true);
    setStatus('Creating offer...');
    const pc = new RTCPeerConnection();
    pcRef.current = pc;
    const dc = pc.createDataChannel('file');
    dataChannelRef.current = dc;
    dc.binaryType = 'arraybuffer';
    dc.onopen = () => setStatus('Data channel open! Ready to send.');
    dc.onclose = () => setStatus('Data channel closed');
    dc.onerror = (e) => setStatus('Data channel error: ' + e.message);
    
    // Listen for answer
    const unsub = listenSignal(async (data) => {
      if (data.answer) {
        await pc.setRemoteDescription({ type: 'answer', sdp: data.answer });
        setStatus('Connected!');
        unsub();
      }
    });

    // Create offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await sendSignal({ offer: offer.sdp });

    // ICE
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        // For demo, skip trickle ICE (not needed for localhost)
      }
    };
  }

  async function startAsReceiver() {
    setIsSender(false);
    setStatus('Waiting for offer...');
    const pc = new RTCPeerConnection();
    pcRef.current = pc;
    pc.ondatachannel = (event) => {
      const dc = event.channel;
      dataChannelRef.current = dc;
      dc.binaryType = 'arraybuffer';
      dc.onmessage = (e) => {
        setStatus('Receiving image...');
        const blob = new Blob([e.data]);
        setReceivedImage(URL.createObjectURL(blob));
        setStatus('Image received!');
      };
      dc.onopen = () => setStatus('Data channel open! Waiting for image...');
      dc.onclose = () => setStatus('Data channel closed');
      dc.onerror = (e) => setStatus('Data channel error: ' + e.message);
    };

    // Listen for offer
    const unsub = listenSignal(async (data) => {
      if (data.offer) {
        await pc.setRemoteDescription({ type: 'offer', sdp: data.offer });
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await sendSignal({ answer: answer.sdp });
        setStatus('Connected!');
        unsub();
      }
    });

    // ICE
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        // For demo, skip trickle ICE
      }
    };
  }

  async function sendImage() {
    if (!dataChannelRef.current || dataChannelRef.current.readyState !== 'open') {
      setStatus('Data channel not open');
      return;
    }
    if (!localImage) {
      setStatus('No image selected');
      return;
    }
    setStatus('Sending image...');
    const arrayBuffer = await localImage.arrayBuffer();
    dataChannelRef.current.send(arrayBuffer);
    setStatus('Image sent!');
  }

  function handleFileChange(e) {
    const file = e.target.files[0];
    setLocalImage(file);
  }

  function resetDemo() {
    setLocalImage(null);
    setReceivedImage(null);
    setStatus('Idle');
    if (pcRef.current) pcRef.current.close();
    clearSignal();
  }

  return (
    <div style={{ padding: 24, background: '#f7f8fa', borderRadius: 16, maxWidth: 420, margin: '40px auto', boxShadow: '0 2px 12px rgba(44,62,80,0.08)' }}>
      <h2>P2P Image Transfer Demo (WebRTC)</h2>
      <div style={{ marginBottom: 12 }}>
        <button onClick={startAsSender} disabled={isSender || status !== 'Idle'}>Start as Sender</button>
        <button onClick={startAsReceiver} disabled={isSender || status !== 'Idle'} style={{ marginLeft: 8 }}>Start as Receiver</button>
        <button onClick={resetDemo} style={{ marginLeft: 8 }}>Reset</button>
      </div>
      <div>Status: <b>{status}</b></div>
      {isSender && (
        <div style={{ marginTop: 16 }}>
          <input type="file" accept="image/*" onChange={handleFileChange} />
          <button onClick={sendImage} disabled={!localImage || status !== 'Connected!'} style={{ marginLeft: 8 }}>Send Image</button>
          {localImage && <div style={{ marginTop: 8 }}>Selected: {localImage.name}</div>}
        </div>
      )}
      {receivedImage && (
        <div style={{ marginTop: 24 }}>
          <div>Received Image:</div>
          <img src={receivedImage} alt="Received" style={{ maxWidth: 320, borderRadius: 8, marginTop: 8 }} />
        </div>
      )}
    </div>
  );
} 