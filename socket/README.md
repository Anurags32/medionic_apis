# 🔌 Socket.IO Plug-and-Play Setup

Ye modular aur lightweight Socket.IO setup hai jise aap kisi bhi Node.js + Express project me direct copy-paste karke use kar sakte hain.

---

## 📦 1. Installation

Project ke root directory me sirf ek dependency install karni hai:

```bash
npm install socket.io
```

---

## 🚀 2. Server Setup (Express / Node.js)

Apne `server.js` ya `app.js` me bas HTTP server banakar socket initialize karein:

```javascript
const express = require('express');
const http = require('http');
const initSocket = require('./socket'); // <-- Import socket module

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO with HTTP server
initSocket(server);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

---

## 📡 3. Supported Events & Payloads

### 🔑 Authentication / User Mapping
| Event Name | Direction | Payload Example | Description |
|---|---|---|---|
| `socket_login` | Client ➡️ Server | `{ "userId": "64f1a2b3c4d5e", "role": "doctor", "doctorId": "...", "setOnline": true }` | User/Doctor ki `userId` ko socket se map karta hai. Doctor ko online set kar sakta hai. |
| `socket_login_success` | Server ➡️ Client | `{ "userId": "...", "socketId": "...", "isDoctor": true }` | Login confirmation. |
| `socket_logout` | Client ➡️ Server | `{ "userId": "64f1a2b3c4d5e" }` | Mapping remove karta hai aur doctor ko offline mark karta hai. |
| `socket_logout_success` | Server ➡️ Client | `{ "message": "..." }` | Logout confirmation. |

---

### 🟢 Doctor Online / Offline Status Events
| Event Name | Direction | Payload Example | Description |
|---|---|---|---|
| `doctor_set_status` / `doctor_status_change` | Doctor ➡️ Server | `{ "doctorId": "...", "isOnline": true, "status": "online" }` | Doctor apna status online/offline toggle karta hai. |
| `doctor_status_updated` | Server ➡️ All Clients (Broadcast) | `{ "doctorId": "...", "userId": "...", "fullName": "Dr. ...", "isOnline": true, "status": "online" }` | Sabhi users (patients) ko live notification milti hai jab doctor online/offline hota hai. |
| `doctor_status_change_success` | Server ➡️ Doctor | `{ "doctorId": "...", "isOnline": true, "status": "online" }` | Status change acknowledgment for doctor. |
| `get_doctor_status` | Patient ➡️ Server | `{ "doctorId": "..." }` | Kisi specific doctor ka live status check karna. |
| `doctor_status_response` | Server ➡️ Patient | `{ "doctorId": "...", "isOnline": true, "status": "online" }` | Doctor status response. |

---

### 📞 Call Flow Events (Direct Socket Emit)
| Event Name | Direction | Payload Example | Description |
|---|---|---|---|
| `call_request` | Client ➡️ Server ➡️ Receiver | `{ "fromUserId": "u1", "toUserId": "u2", "callType": "video" }` | Caller call start karta hai. |
| `call_accept` | Receiver ➡️ Server ➡️ Caller | `{ "fromUserId": "u2", "toUserId": "u1" }` | Receiver call accept karta hai. |
| `call_reject` | Receiver ➡️ Server ➡️ Caller | `{ "fromUserId": "u2", "toUserId": "u1", "reason": "declined" }` | Receiver call reject karta hai. |
| `call_busy` | Receiver ➡️ Server ➡️ Caller | `{ "fromUserId": "u2", "toUserId": "u1" }` | Receiver already call me busy hai. |
| `call_end` | Any ➡️ Server ➡️ Other User | `{ "fromUserId": "u1", "toUserId": "u2" }` | Call hangup ya cut karna. |
| `call_offline` | Server ➡️ Sender | `{ "toUserId": "u2", "message": "..." }` | Agar target user offline ho to sender ko notify karta hai. |

---

## 💻 4. Client Side Usage Examples

### A. React / React Native Example

```javascript
import { useEffect } from 'react';
import { io } from 'socket.io-client';

const SOCKET_SERVER_URL = 'http://localhost:5000'; // Replace with your server URL
const currentUserId = 'user_123'; // Current logged-in user id

export const socket = io(SOCKET_SERVER_URL, {
  transports: ['websocket'],
  autoConnect: true,
});

function CallComponent() {
  useEffect(() => {
    // 1. Connection Event
    socket.on('connect', () => {
      console.log('Connected to socket server:', socket.id);

      // 2. Register userId (socket_login)
      socket.emit('socket_login', { userId: currentUserId });
    });

    // 3. Listen for Incoming Call Request
    socket.on('call_request', (data) => {
      console.log('Incoming Call from:', data.fromUserId, 'Call Type:', data.callType);
      // Show Incoming Call Screen/Modal to User
    });

    // 4. Listen for Call Accepted
    socket.on('call_accept', (data) => {
      console.log('Call was accepted by:', data.fromUserId);
      // Navigate to active call screen / start WebRTC stream
    });

    // 5. Listen for Call Rejected / Busy / End
    socket.on('call_reject', (data) => {
      console.log('Call rejected by receiver:', data.reason);
    });

    socket.on('call_busy', (data) => {
      console.log('User is busy on another call');
    });

    socket.on('call_end', (data) => {
      console.log('Call ended by:', data.fromUserId);
    });

    // 6. Listen if user is offline
    socket.on('call_offline', (data) => {
      alert(`User ${data.toUserId} is currently offline`);
    });

    return () => {
      socket.off('call_request');
      socket.off('call_accept');
      socket.off('call_reject');
      socket.off('call_busy');
      socket.off('call_end');
      socket.off('call_offline');
    };
  }, []);

  // Functions to emit call actions
  const startCall = (receiverId, callType = 'video') => {
    socket.emit('call_request', {
      fromUserId: currentUserId,
      toUserId: receiverId,
      callType: callType,
    });
  };

  const acceptCall = (callerId) => {
    socket.emit('call_accept', {
      fromUserId: currentUserId,
      toUserId: callerId,
    });
  };

  const rejectCall = (callerId) => {
    socket.emit('call_reject', {
      fromUserId: currentUserId,
      toUserId: callerId,
      reason: 'User busy or declined',
    });
  };

  const endCall = (targetUserId) => {
    socket.emit('call_end', {
      fromUserId: currentUserId,
      toUserId: targetUserId,
    });
  };

  return (
    <div>
      <button onClick={() => startCall('user_456', 'video')}>Call User 456</button>
    </div>
  );
}
```

---

### B. Vanilla JavaScript (Browser HTML)

```html
<script src="https://cdn.socket.io/4.8.1/socket.io.min.js"></script>
<script>
  const socket = io('http://localhost:5000');
  const myUserId = 'user_101';

  socket.on('connect', () => {
    console.log('Socket Connected:', socket.id);
    
    // Login
    socket.emit('socket_login', { userId: myUserId });
  });

  // Listen for incoming call
  socket.on('call_request', (data) => {
    const accept = confirm(`Incoming call from ${data.fromUserId}. Accept?`);
    if (accept) {
      socket.emit('call_accept', { fromUserId: myUserId, toUserId: data.fromUserId });
    } else {
      socket.emit('call_reject', { fromUserId: myUserId, toUserId: data.fromUserId });
    }
  });

  socket.on('call_accept', (data) => {
    alert(`Call accepted by ${data.fromUserId}`);
  });

  socket.on('call_end', (data) => {
    alert(`Call ended`);
  });
</script>
```

---

## 🛠️ 5. Accessing `io` Anywhere in Backend

Agar aapko kisi Controller ya Service me socket emit karna ho:

```javascript
const { getIO, getSocketIdByUserId } = require('../socket');

function notifyUser(userId, message) {
  const io = getIO();
  const socketId = getSocketIdByUserId(userId);

  if (socketId) {
    io.to(socketId).emit('new_notification', { message });
  }
}
```
