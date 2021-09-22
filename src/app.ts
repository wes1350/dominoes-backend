import express from "express";
import * as http from "http";
import cors from "cors";
import { Socket } from "socket.io";
import { MessageType } from "./Enums";
import { GameConfigDescription } from "./interfaces/GameConfigDescription";
import { Room } from "./Room";
import { getRandomInt } from "./utils";
import redis from "redis";
import session, { SessionOptions } from "express-session";
import connectRedis from "connect-redis";

declare module "express-session" {
    interface SessionData {
        playerName: string;
    }
}

const redisClient = redis.createClient();
const redisStore = connectRedis(session);

const corsOptions = {
    origin: "http://localhost:3000",
    credentials: true
    // optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
};

const devTestSecret = "dev-test-secret";

const app = express();
app.use(cors(corsOptions));
app.use(express.json());

const sessionOptions: SessionOptions = {
    cookie: {
        // domain: ".app.localhost",
        path: "/",
        httpOnly: true,
        secure: false,
        maxAge: null
    },
    store: new redisStore({ client: redisClient }),
    saveUninitialized: false,
    secret: devTestSecret,
    resave: false
};

const sessionMiddleware = session(sessionOptions);

app.use(sessionMiddleware);

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

// From https://socket.io/docs/v4/middlewares/
const wrap =
    (middleware: any) => (socket: Socket, next: express.NextFunction) =>
        middleware(socket.request, {}, next);

io.use(wrap(sessionMiddleware));

// Is this necessary? Maybe store in the session as a property
// Map each session ID to all connected socket IDs (e.g. if there are multiple tabs)
const sessionIdsToSocketIds = new Map<string, string[]>();

const addSocketIdToSession = (sessionId: string, socketId: string) => {
    if (!sessionIdsToSocketIds.has(sessionId)) {
        sessionIdsToSocketIds.set(sessionId, [socketId]);
    } else {
        sessionIdsToSocketIds.get(sessionId).push(socketId);
    }
};

const removeSocketIdFromSession = (sessionId: string, socketId: string) => {
    if (sessionIdsToSocketIds.has(sessionId)) {
        if (sessionIdsToSocketIds.get(sessionId).length === 1) {
            sessionIdsToSocketIds.delete(sessionId);
        } else {
            sessionIdsToSocketIds.set(
                sessionId,
                sessionIdsToSocketIds
                    .get(sessionId)
                    .filter((id) => id !== socketId)
            );
        }
    }
};

// Move this to Redis later
const roomIdsToRooms = new Map<string, Room>();

io.on("connection", (socket: Socket) => {
    const session = (socket.request as any).session;
    const sessionId = session.id;

    console.log(`a user with session ID ${sessionId} connected`);
    addSocketIdToSession(sessionId, socket.id);

    socket.on("disconnect", () => {
        console.log(`user with session ID ${sessionId} disconnected`);
        removeSocketIdFromSession(sessionId, socket.id);

        socket.rooms.forEach((roomId) => {
            if (roomId !== socket.id) {
                const room = roomIdsToRooms.get(roomId);
                room.RemovePlayerBySocketId(socket.id);
                // Replace with a user ID or something here
                io.to(roomId).emit(MessageType.PLAYER_LEFT_ROOM, null);
            }
        });
    });

    socket.on(
        MessageType.GAME_START,
        (roomId: string, config: GameConfigDescription) => {
            console.log(`starting game for room ${roomId}`);
            roomIdsToRooms.get(roomId).StartGame(config);
        }
    );

    socket.on(
        MessageType.JOIN_ROOM,
        (roomId: string, userInfo: { name: string }) => {
            console.log(`user joining room ${roomId}`);
            if (!roomIdsToRooms.get(roomId)) {
                roomIdsToRooms.set(roomId, new Room(roomId, io));
            }
            socket.join(roomId);
            roomIdsToRooms.get(roomId).AddPlayerBySocketId(socket.id);
            // Replace with user ID or something similar
            socket.to(roomId).emit(MessageType.PLAYER_JOINED_ROOM, "user");
        }
    );

    socket.on(MessageType.LEAVE_ROOM, (roomId: string) => {
        console.log(`user leaving room ${roomId}`);
        if (!roomIdsToRooms.get(roomId)) {
            console.warn("warning: tried to leave a room that did not exist");
        }
        roomIdsToRooms.get(roomId)?.RemovePlayerBySocketId(socket.id);
        socket.leave(roomId);
        // Replace with user ID or something similar
        socket.to(roomId).emit(MessageType.PLAYER_LEFT_ROOM, "user");
    });
});

app.get(
    "/getName",
    (
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
    ) => {
        res.send({ name: req.session.playerName });
    }
);

app.post(
    "/setName",
    (
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
    ) => {
        const name = req.body.name;
        if (name) {
            req.session.playerName = name;
            res.send(true);
        } else {
            res.send(false);
        }
    }
);

app.get(
    "/rooms",
    (
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
    ) => {
        const roomIds = Array.from(roomIdsToRooms.keys());
        const roomDetails = roomIds.map((roomId) => ({
            id: roomId,
            nPlayers: roomIdsToRooms.get(roomId).NPlayers
        }));
        res.json({ rooms: roomDetails });
    }
);

app.post(
    "/createRoom",
    (
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
    ) => {
        console.log("got a request to /createRoom");
        const roomIds = Array.from(roomIdsToRooms.keys());
        while (true) {
            const roomId = getRandomInt(0, 100000000).toString();
            if (!roomIds.includes(roomId)) {
                roomIdsToRooms.set(roomId, new Room(roomId, io));
                res.send(roomId);
                break;
            }
        }
    }
);

const port = 3001;
server.listen(port, () => {
    console.log(`listening on *:${port}`);
});
