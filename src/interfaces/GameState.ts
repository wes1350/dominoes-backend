import { GameConfigDescription } from "./GameConfigDescription";

export interface GameState {
    config: GameConfigDescription;
    seatNumberForTurn: number;
    players: {
        me: {
            seatNumber: number;
            score: number;
            hand: { face1: number; face2: number }[];
        };
        opponents: {
            seatNumber: number;
            score: number;
            dominoesInHand: number;
        }[];
    };
    board: { face1: number; face2: number; x: number; y: number }[];
    spinner: number;
}
