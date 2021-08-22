import express from "express";
import * as http from "http";
import { Socket } from "socket.io";
import { Engine } from "./Engine";
import { MessageType, QueryType } from "./Enums";
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
    },
    allowEIO3: true
});

const playersToSockets = new Map<number, Socket>();
const socketIdsToSockets = new Map<string, Socket>();
const socketIdsToResponses = new Map<string, Map<string, string>>();

io.on("connection", (socket: Socket) => {
    console.log("a user connected");
    socketIdsToSockets.set(socket.id, socket);

    socket.on("disconnect", () => {
        socketIdsToSockets.delete(socket.id);
        console.log("user disconnected");
    });

    socket.on(MessageType.GAME_START, (socket: Socket) => {
        console.log("starting game");
        // Assign player numbers
        Array.from(socketIdsToSockets.values()).forEach(
            (socket: Socket, i: number) => {
                playersToSockets.set(i, socket);
                socketIdsToResponses.set(socket.id, new Map<string, string>());
            }
        );

        setUpSocketsForGame();

        const engine = new Engine(
            Array.from(playersToSockets.keys()).length,
            emitToClient,
            broadcast,
            queryClient
        );

        engine.InitializeRound(true);

        Array.from(playersToSockets.keys()).forEach((player: number) => {
            const gameDetails = {
                players: engine.PlayerRepresentationsForSeat(player),
                currentPlayer: engine.CurrentPlayer,
                config: {
                    n_dominoes: 7
                }
            };
            const socket = playersToSockets.get(player);
            socket.emit(MessageType.GAME_START, gameDetails);
            socket.emit(MessageType.HAND, engine.Players[player].HandRep);
        });

        engine.RunGame().then(() => {
            // console.log("Winner:", winner);
        });
    });
});

const setUpSocketsForGame = () => {
    Array.from(socketIdsToSockets.values()).forEach((socket) => {
        socket.onAny((eventName: string, response: string) => {
            console.log("received:", eventName, " -- response:", response);
            socketIdsToResponses.get(socket.id).set(eventName, response);
        });
    });
};

// const broadcast = (socket: Socket) => {
// return (message: string, tag?: string) => {
const broadcast = (type: MessageType, payload: string | object) => {
    // Send a message to all clients
    // clear_old_info(room)
    // if (!tag) {
    io.emit(type as string, payload);
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
    playersToSockets.get(player).emit(type as string, message);
};

const queryClient = async (
    type: QueryType,
    message: string,
    player: number
): Promise<any> => {
    const socketId = playersToSockets.get(player).id;
    socketIdsToResponses.get(socketId).delete(type);
    playersToSockets.get(player).emit(type as string, message);

    while (!socketIdsToResponses.get(socketId).get(type)) {
        await sleep(100);
    }

    return socketIdsToResponses.get(socketId).get(type);
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
