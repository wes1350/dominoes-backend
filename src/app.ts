import express from "express";
import * as http from "http";
import { Socket } from "socket.io";
import { MessageType } from "./Enums";
import { GameConfigDescription } from "./interfaces/GameConfigDescription";
import { Room } from "./Room";
const app = express();
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"],
        transports: ["websocket", "polling"],
        credentials: true
    },
    allowEIO3: true
});

const socketIdsToSockets = new Map<string, Socket>();
const roomIdsToRooms = new Map<string, Room>();
const socketIdsToRoomIds = new Map<string, string>();

io.on("connection", (socket: Socket) => {
    console.log("a user connected");
    socketIdsToSockets.set(socket.id, socket);

    socket.on("disconnect", () => {
        // Maybe instead of deleting, we flag it as disconnected?
        // This could help with reconnect?
        socketIdsToSockets.delete(socket.id);
        if (socketIdsToRoomIds.has(socket.id)) {
            const room = roomIdsToRooms.get(socketIdsToRoomIds.get(socket.id));
            room.RemoveSocketWithId(socket.id);
            // Replace null here
            room.BroadcastToRoom(MessageType.LEAVE_ROOM, null);
        }
        console.log("user disconnected");
    });

    socket.on(
        MessageType.JOIN_ROOM,
        (roomId: string, userInfo: { name: string }) => {
            console.log(`user joining room ${roomId}`);
            socketIdsToRoomIds.set(socket.id, roomId);
            if (!roomIdsToRooms.get(roomId)) {
                roomIdsToRooms.set(roomId, new Room(io));
            }
            const room = roomIdsToRooms.get(roomId);
            room.AddSocket(socket);
            room.BroadcastToRoom(MessageType.JOIN_ROOM, userInfo);
        }
    );

    socket.on(
        MessageType.LEAVE_ROOM,
        (roomId: string, userInfo: { name: string }) => {
            console.log(`user leaving room ${roomId}`);
            socketIdsToRoomIds.delete(socket.id);
            const room = roomIdsToRooms.get(roomId);
            room.BroadcastToRoom(MessageType.LEAVE_ROOM, userInfo);
        }
    );

    socket.on(
        MessageType.GAME_START,
        (roomId: string, config: GameConfigDescription) => {
            console.log(`starting game for room ${roomId}`);

            roomIdsToRooms.get(roomId).StartGame(config);
        }
    );
});

const port = 3001;
server.listen(port, () => {
    console.log(`listening on *:${port}`);
});
