import _ from "lodash";
import { Direction } from "../enums/Direction";
import { GameEventType } from "../enums/GameEventType";
import { QueryType } from "../enums/QueryType";
import { GameStateUtils } from "../GameStateUtils";
import { GameState } from "../interfaces/GameState";
import { Agent } from "./Agent";

const GreedyAgent: Agent = {
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
        const bestOption = _.maxBy(options, (option) =>
            GameStateUtils.CalculateScoreAfterPlay(gameState, option)
        );
        console.log(
            `highest scoring option is ${options.findIndex(
                (option) => option === bestOption
            )} with a score of ${GameStateUtils.CalculateScoreAfterPlay(
                gameState,
                bestOption
            )}`
        );
        return options.findIndex((option) => option === bestOption);
    }
};

export default GreedyAgent;
