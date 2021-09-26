import { Socket } from "socket.io";
import { Engine } from "./Engine";
import { MessageType, QueryType } from "./Enums";
import { GameConfigDescription } from "./interfaces/GameConfigDescription";
import { shuffleArray, sleep } from "./utils";

export class Room {
    private io: any;
    private id: string;
    private socketIdsToResponses: Map<string, string>;
    private socketIdsToNames: Map<string, string>;
    private playersToSocketIds: Map<number, string>;

    constructor(id: string, io: any) {
        this.io = io;
        this.id = id;
        this.socketIdsToResponses = new Map<string, string>();
        this.socketIdsToNames = new Map<string, string>();
        this.playersToSocketIds = new Map<number, string>();
    }

    private get players(): number[] {
        return Array.from(this.playersToSocketIds.keys());
    }

    private get socketIds(): string[] {
        return Array.from(this.socketIdsToResponses.keys());
    }

    private getSocketFromId(socketId: string): Socket {
        return this.io.sockets.sockets.get(socketId) as Socket;
    }

    public get PlayerDetails(): { name: string }[] {
        return Array.from(this.socketIdsToNames.values()).map((name) => ({
            name: name
        }));
    }

    public AddPlayer(socketId: string, playerName: string): void {
        console.log(
            `adding socket with ID ${socketId} and name ${playerName} to room ${this.id}`
        );
        if (!this.socketIdsToResponses.has(socketId)) {
            this.socketIdsToResponses.set(socketId, null);
        } else {
            console.warn(
                `Tried to add socket id ${socketId} to room ${this.id} when it already existed in the room`
            );
        }

        this.socketIdsToNames.set(socketId, playerName);
    }

    public RemovePlayerBySocketId(socketId: string): void {
        // this.sockets = this.sockets.filter((socket) => socket.id !== id);
        this.socketIdsToResponses.delete(socketId);
        this.socketIdsToNames.delete(socketId);
    }

    public StartGame(config: GameConfigDescription): void {
        console.log("config:", config);
        const randomlyOrderedSocketIds = shuffleArray(this.socketIds);
        randomlyOrderedSocketIds.forEach((socketId: string, i: number) => {
            this.playersToSocketIds.set(i, socketId);
            this.socketIdsToResponses.set(socketId, null);

            this.getSocketFromId(socketId).onAny(
                (eventName: string, response: string) => {
                    console.log(
                        "received:",
                        eventName,
                        " -- response:",
                        response
                    );
                    this.socketIdsToResponses.set(socketId, response);
                }
            );
        });

        const engine = new Engine(
            this.socketIds.length,
            config,
            this.emitToClient.bind(this),
            this.broadcast.bind(this),
            this.queryClient.bind(this)
        );

        engine.InitializeRound(true);

        this.players.forEach((player: number) => {
            const gameDetails = {
                players: this.getPlayerRepresentationsForSeat(player),
                config: {
                    n_dominoes: config.HandSize
                }
            };
            const socket = this.getSocketFromId(
                this.playersToSocketIds.get(player)
            );
            socket.emit(MessageType.GAME_START, gameDetails);
            socket.emit(MessageType.HAND, engine.Players[player].HandRep);
        });

        engine.RunGame().then((winner) => {
            console.log("Winner:", winner);
            this.broadcast(MessageType.GAME_OVER, this.getNameBySeat(winner));
            this.clear();
        });
    }

    private clear = () => {
        this.socketIds.forEach((socketId) => {
            this.RemovePlayerBySocketId(socketId);
            this.io.sockets.sockets.get(socketId).leave(this.id);
        });
        this.playersToSocketIds = new Map();
    };

    private getNameBySeat = (seat: number) => {
        return this.socketIdsToNames.get(this.playersToSocketIds.get(seat));
    };

    private getPlayerRepresentationsForSeat(
        seatNumber: number
    ): { seatNumber: number; name: string; isMe: boolean }[] {
        return this.players.map((_p, i) => ({
            seatNumber: i,
            name: this.getNameBySeat(i),
            isMe: i === seatNumber
        }));
    }

    private broadcast(messageType: MessageType, payload: any) {
        console.log(
            `broadcasting ${
                typeof payload === "object" ? JSON.stringify(payload) : payload
            } of type ${messageType} to room ${this.id}`
        );
        this.io.to(this.id).emit(messageType, payload);
    }

    private emitToClient = (
        type: MessageType,
        message: string,
        player: number
    ) => {
        this.getSocketFromId(this.playersToSocketIds.get(player)).emit(
            type as string,
            message
        );
    };

    private queryClient = async (
        type: QueryType,
        message: string,
        player: number
    ): Promise<any> => {
        const socketId = this.playersToSocketIds.get(player);
        // if (!this.socketIdsToResponses.has(socketId)) {
        //     // User disconnected, so their socket ID response key was removed
        //     return null;
        // }
        this.socketIdsToResponses.delete(socketId);
        this.getSocketFromId(this.playersToSocketIds.get(player)).emit(
            type as string,
            message
        );

        while (!this.socketIdsToResponses.get(socketId)) {
            await sleep(100);
        }

        if (!this.socketIdsToResponses.has(socketId)) {
            // User disconnected, so their socket ID response key was removed
            return null;
        }

        console.log("response:", this.socketIdsToResponses.get(socketId));
        return this.socketIdsToResponses.get(socketId);
    };

    public get NPlayers(): number {
        return this.socketIds.length;
    }
}
