import express, { response } from "express";
import * as http from "http";
import { Socket } from "socket.io";
import { Engine } from "./Engine";
import { sleep } from "./utils";
const app = express();
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"],
        transports: ["websocket", "polling"],
        credentials: true
        // methods: ["GET", "POST"]
    },
    allowEIO3: true
});

// app.get("/", (req: express.Request, res: express.Response) => {
//     // res.sendFile(__dirname + "/index.html");
// });

export enum QueryType {
    DOMINO = "DOMINO",
    DIRECTION = "DIRECTION",
    PULL = "PULL"
}

export enum MessageType {
    ADD_DOMINO = "ADD_DOMINO",
    PLAYABLE_DOMINOS = "PLAYABLE_DOMINOS",
    HAND = "HAND",
    GAME_START = "GAME_START",
    GAME_OVER = "GAME_OVER",
    ROUND_OVER = "ROUND_OVER",
    PACK_EMPTY = "PACK_EMPTY",
    CLEAR_BOARD = "CLEAR_BOARD",
    SCORES = "SCORES",
    ERROR = "ERROR"
}

const playersToSockets = new Map<number, Socket>();
// const responses = new Map<string, any>();

io.on("connection", (socket: Socket) => {
    console.log("a user connected");
    console.log(Array.from(playersToSockets.keys()).length);
    playersToSockets.set(Array.from(playersToSockets.keys()).length, socket);

    // socket.on("response", (response: any) => {
    //     responses.set(socket.id, response);
    // });

    socket.on("disconnect", () => {
        console.log("user disconnected");
    });

    socket.on("GAME_START", (socket: Socket) => {
        console.log("starting game");
        broadcast(MessageType.GAME_START, "");
        const winner = new Engine(
            Array.from(playersToSockets.keys()).length,
            emitToClient,
            broadcast,
            queryClient
        )
            .RunGame()
            .then(() => {
                console.log("Winner:", winner);
            });
    });
});

// const broadcast = (socket: Socket) => {
// return (message: string, tag?: string) => {
const broadcast = (type: MessageType, message: string) => {
    // Send a message to all clients
    // clear_old_info(room)
    // if (!tag) {
    io.emit(type as string, message);
    // } else {
    //     throw new Error("Tags not supported yet");
    // }
    // else{
    //     for client in rt.game_rooms[room]["clients"]:
    //         emit_to_client_in_room(room)(msg, client, tag, clear=False)
    // }
};
// };

const emitToClient = (type: MessageType, message: string, player: number) => {
    io.to(playersToSockets.get(player).id).emit(type as string, message);
};

const queryClient = async (
    type: QueryType,
    message: string,
    player: number
): Promise<string> => {
    console.log("IN QUERY");
    let sent = false;
    return new Promise(async (resolve) => {
        console.log("INSIDE PROMISE");
        // console.log("type:", type);
        while (true) {
            console.log("loop");
            if (!sent) {
                sent = true;
                // io.to(playersToSockets.get(player).id).emit(
                playersToSockets
                    .get(player)
                    .emit(type as string, message, (res: string) => {
                        console.log("Got res:", res);
                        resolve(res);
                    });
            }
            await sleep(1000);
        }

        // while (waiting) {
        //     sleep(1000);
        // }
    });
};

// def emit_to_client(msg, client_id, tag=None, clear=True):
//     # Clear response before whispering, to ensure we don't keep a stale one
//     if clear:
//         rt.game_rooms[room]["clients"][client_id]["response"] = "No response"
//     if tag is None:
//         socketio.send(msg, room=rt.game_rooms[room]["clients"][client_id]["sid"])
//     else:
//         emit(tag, msg, room=rt.game_rooms[room]["clients"][client_id]["sid"])
// return emit_to_client

// def retrieve_response(client_id):
//     """Get the current stored response corresponding to the requested client."""
//     return rt.game_rooms[room]["clients"][client_id]["response"]
// return retrieve_response

const port = 3001;
server.listen(port, () => {
    console.log(`listening on *:${port}`);
});
