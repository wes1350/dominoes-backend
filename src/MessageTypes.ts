export interface PlayerDescription {
    seatNumber: number;
    name: string;
    isMe: boolean;
}

export interface GameStartMessage {
    players: PlayerDescription[];
    config: {
        n_dominoes: number;
    };
}
