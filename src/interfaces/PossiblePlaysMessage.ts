import { Direction } from "../enums/Direction";

export interface PossiblePlaysMessage {
    plays: { domino: number; direction: Direction }[];
}
