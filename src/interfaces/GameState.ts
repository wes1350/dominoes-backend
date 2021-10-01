import { GameConfigDescription } from "./GameConfigDescription";

export interface GameState {
    config: GameConfigDescription;
    seatNumberForTurn: number;
    players: {
        me: {
            seatNumber: number;
            score: number;
            hand: { head: number; tail: number }[];
        };
        opponents: {
            seatNumber: number;
            score: number;
            dominoesInHand: number;
        }[];
    };
    board: { head: number; tail: number; x: number; y: number }[];
    spinner: number;
}
