import _ from "lodash";
import { Direction } from "../enums/Direction";
import { GameEventType } from "../enums/GameEventType";
import { QueryType } from "../enums/QueryType";
import { GameState } from "../interfaces/GameState";
import { Agent } from "./Agent";

const RandomAgent: Agent = {
    process: (
        eventType: GameEventType,
        gameState: GameState,
        internalState: any
    ) => {
        return null;
    },
    respond: async (
        queryType: QueryType,
        gameState: GameState,
        internalState: any,
        options: { domino: number; direction: Direction }[]
    ): Promise<number> => {
        return _.sample(_.range(options.length));
    }
};

export default RandomAgent;
