/* global chrome, MediaRecorder, FileReader */

const streams = {};
const peers = {};

const socket = io.connect('http://localhost:8000');

socket.on('ping', room => {
	try {
		if (streams[room] === undefined) {
			throw new Error(`no stream for room "${room}"`);
		}
		socket.emit('pong', room);
	} catch (err) {
		window.log('ping error', room, socket.id, err.message || JSON.stringify(err));
	}
});

socket.on('joined', async (room, socketId) => {
	try {
		if (streams[room] === undefined) {
			throw new Error(`no stream yet for room "${room}"`);
		}

		window.log(`joined: ${room}`, socketId);

		let makingOffer = true;
		const remotePeerConnection = new RTCPeerConnection(null);
		window.log('Created remote peer connection object remotePeerConnection.');

		const stream = streams[room];

		stream.getTracks().forEach(track => remotePeerConnection.addTrack(track, stream));

		remotePeerConnection.addEventListener('icecandidate', handleIceCandidate);
		// remotePeerConnection.addEventListener('iceconnectionstatechange', handleIceCandidate);
		remotePeerConnection.onnegotiationneeded = async () => {
			window.log('BROADCASTER onnegotiationneeded', makingOffer);
			try {
				if (!makingOffer) return;
				makingOffer = true;
				await setLocalAndSendMessage(await remotePeerConnection.createOffer());
			} catch (err) {
				window.log('error', err);
			} finally {
				makingOffer = false;
			}
		};
		remotePeerConnection.oniceconnectionstatechange = () => {
			if (remotePeerConnection.iceConnectionState === 'failed') {
				remotePeerConnection.restartIce();
			}
		};

		function handleIceCandidate(event) {
			window.log(
				'icecandidate event: ',
				event.candidate,
				socketId,
				remotePeerConnection.iceGatheringState
			);
			if (event.candidate !== null) {
				window.log('new candidate');
				sendMessage(socketId, {
					type: 'candidate',
					candidate: event.candidate.toJSON()
				});
			} else {
				window.log('End of candidates.');
			}
		}

		async function setLocalAndSendMessage(offer) {
			await remotePeerConnection.setLocalDescription(offer);
			window.log('setLocalAndSendMessage');
			sendMessage(socketId, offer);
		}

		await setLocalAndSendMessage(await remotePeerConnection.createOffer());

		makingOffer = false;
		window.log('!! peer is ready', socketId);
		peers[socketId] = remotePeerConnection;
	} catch (err) {
		window.log('error', room, socketId, err.message || JSON.stringify(err));
	}
	// (setLocalAndSendMessage, handleCreateOfferError);
});

// This client receives a message
socket.on('message', (message, peerSocketId) => {
	try {
		window.log('broadcaster received message:' /* , message */, peerSocketId);
		if (!peers[peerSocketId]) {
			window.log(`no peer connection found for ${peerSocketId}... retry later!`);
			return;
		}
		if (message.type === 'answer') {
			window.log('set remote description', peerSocketId);
			peers[peerSocketId].setRemoteDescription(new RTCSessionDescription(message));
		} else if (message.type === 'candidate') {
			const candidate = new RTCIceCandidate(message.candidate);
			peers[peerSocketId].addIceCandidate(candidate);
			window.log('remotePeerConnection.iceGatheringState', peers[peerSocketId].iceGatheringState);
		} else {
			window.log('!!! unhandled message', message);
		}
	} catch (err) {
		window.log('on receive message error', err.message || JSON.stringify(err));
	}
});

/// /////////////////////////////////////////////
function sendMessage(room, message) {
	window.log('Client sending message'); // , message, room);
	socket.emit('message', message, room);
}

const tabIdToRoom /*= {[tabId: string]: string} */ = {};
chrome.tabs.addListener((tabId, detachInfo) => {
	const room = tabIdToRoom[tabId];
	window.log('TAB CLOSED', tabId, room, detachInfo);
	if (room) {
		streams[room] = undefined;
	}
});

async function START_RECORDING({ index, room: roomName, zoom }) {
	const room = roomName || `room${index}`;

	window.log('START_RECORDING', index, room);
	try {
		const currentTab = await new Promise((resolve, reject) =>
			chrome.tabs.query({ active: true }, tab => {
				if (!tab) {
					reject('no current active tab');
					return;
				}
				resolve(tab);
			})
		);

		if (zoom) {
			chrome.tabs.setZoom(currentTab.id, zoom);
		}

		const width = 1280; // 960; // 1920; // 960
		const height = 720; // 540; // 1080; // 540
		const fps = 24;

		const stream = await new Promise((resolve, reject) =>
			chrome.tabCapture.capture(
				{
					audio: true,
					video: true,
					videoConstraints: {
						mandatory: {
							// minWidth: width,
							// minHeight: height,
							maxWidth: width,
							maxHeight: height,
							maxFrameRate: fps
						}
					}
				},
				streamResult => {
					if (!streamResult) {
						reject(new Error('got no stream'));
						return;
					}
					resolve(streamResult);
				}
			)
		);

		socket.emit('join', room, 'broadcaster');
		streams[room] = stream;
		tabIdToRoom[currentTab.id] = room;
		window.log('!!! room ready', room);
	} catch (err) {
		window.log('ERROR', room, err.message || err || 'unknown');
		throw err;
	}
}
