import { Socket } from "socket.io";
import { Engine } from "./Engine";
import { MessageType, QueryType } from "./Enums";
import { GameConfigDescription } from "./interfaces/GameConfigDescription";
import { sleep } from "./utils";

export class Room {
    private io: any;
    private sockets: Socket[];
    private socketIdsToResponses: Map<string, Map<string, string>>;
    private playersToSockets: Map<number, Socket>;

    constructor(io: any) {
        this.io = io;
        this.sockets = [];
        this.socketIdsToResponses = new Map<string, Map<string, string>>();
        this.playersToSockets = new Map<number, Socket>();
    }

    private get socketIds(): string[] {
        return this.sockets.map((socket) => socket.id);
    }

    public AddSocket(socket: Socket): void {
        if (!this.socketIds.includes(socket.id)) {
            this.sockets.push(socket);
            this.socketIdsToResponses.set(socket.id, new Map<string, string>());
        }
    }

    public RemoveSocketWithId(id: string): void {
        this.sockets = this.sockets.filter((socket) => socket.id !== id);
        this.socketIdsToResponses.delete(id);
    }

    public BroadcastToRoom(messageType: MessageType, payload: any) {
        this.sockets.forEach((socket) => {
            socket.emit(messageType, payload);
        });
    }

    public StartGame(config: GameConfigDescription): void {
        console.log("config:", config);
        this.sockets.forEach((socket: Socket, i: number) => {
            this.playersToSockets.set(i, socket);
            this.socketIdsToResponses.set(socket.id, new Map<string, string>());

            socket.onAny((eventName: string, response: string) => {
                console.log("received:", eventName, " -- response:", response);
                this.socketIdsToResponses
                    .get(socket.id)
                    .set(eventName, response);
            });
        });

        const engine = new Engine(
            Array.from(this.playersToSockets.keys()).length,
            config,
            this.emitToClient,
            this.broadcast,
            this.queryClient
        );

        engine.InitializeRound(true);

        Array.from(this.playersToSockets.keys()).forEach((player: number) => {
            const gameDetails = {
                players: engine.PlayerRepresentationsForSeat(player),
                config: {
                    n_dominoes: config.HandSize
                }
            };
            const socket = this.playersToSockets.get(player);
            socket.emit(MessageType.GAME_START, gameDetails);
            socket.emit(MessageType.HAND, engine.Players[player].HandRep);
        });

        engine.RunGame().then((winner) => {
            console.log("Winner:", winner);
        });
    }

    private emitToClient = (
        type: MessageType,
        message: string,
        player: number
    ) => {
        this.playersToSockets.get(player).emit(type as string, message);
    };

    private broadcast = (type: MessageType, payload: string | object) => {
        this.io.emit(type as string, payload);
    };

    private queryClient = async (
        type: QueryType,
        message: string,
        player: number
    ): Promise<any> => {
        const socketId = this.playersToSockets.get(player).id;
        if (!this.socketIdsToResponses.has(socketId)) {
            // User disconnected, so their socket ID response key was removed
            return null;
        }
        this.socketIdsToResponses.get(socketId).delete(type);
        this.playersToSockets.get(player).emit(type as string, message);

        while (!this.socketIdsToResponses.get(socketId)?.get(type)) {
            await sleep(100);
        }

        if (!this.socketIdsToResponses.has(socketId)) {
            // User disconnected, so their socket ID response key was removed
            return null;
        }

        console.log(
            "response:",
            this.socketIdsToResponses.get(socketId).get(type)
        );
        return this.socketIdsToResponses.get(socketId).get(type);
    };
}
