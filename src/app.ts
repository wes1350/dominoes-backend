import express from "express";
import * as http from "http";
import cors from "cors";
import { Socket } from "socket.io";
import { MessageType } from "./Enums";
import { GameConfigDescription } from "./interfaces/GameConfigDescription";
import { Room } from "./Room";

const corsOptions = {
    origin: "http://localhost:3000"
    // optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
};

const app = express();
app.use(cors(corsOptions));

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
            room.Broadcast(MessageType.LEAVE_ROOM, null);
        }
        console.log("user disconnected");
    });

    socket.on(
        MessageType.JOIN_ROOM,
        (roomId: string, userInfo: { name: string }) => {
            console.log(`user joining room ${roomId}`);
            socketIdsToRoomIds.set(socket.id, roomId);
            if (!roomIdsToRooms.get(roomId)) {
                roomIdsToRooms.set(roomId, new Room(roomId));
            }
            const room = roomIdsToRooms.get(roomId);
            room.AddSocket(socket);
            room.Broadcast(MessageType.JOIN_ROOM, userInfo);
        }
    );

    socket.on(
        MessageType.LEAVE_ROOM,
        (roomId: string, userInfo: { name: string }) => {
            console.log(`user leaving room ${roomId}`);
            socketIdsToRoomIds.delete(socket.id);
            const room = roomIdsToRooms.get(roomId);
            room.Broadcast(MessageType.LEAVE_ROOM, userInfo);
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

app.get(
    "/rooms",
    (
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
    ) => {
        console.log("got a request to /rooms");
        const roomIds = Array.from(roomIdsToRooms.keys());
        const roomDetails = roomIds.map((roomId) => ({
            id: roomId,
            nPlayers: roomIdsToRooms.get(roomId).NPlayers
        }));
        res.json(roomDetails);
    }
);

const port = 3001;
server.listen(port, () => {
    console.log(`listening on *:${port}`);
});
