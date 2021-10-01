import { Engine } from "./Engine";
import * as readline from "readline";
import { shuffleArray } from "./utils";
import { QueryType } from "./enums/QueryType";
import { MessageType } from "./enums/MessageType";
import RandomAgent from "./agents/RandomAgent";
import _ from "lodash";
import { Agent } from "./agents/Agent";
import { PossiblePlaysMessage } from "./interfaces/PossiblePlaysMessage";
import { Direction } from "./enums/Direction";
import { GameState } from "./interfaces/GameState";

// Run the game locally on the command line

const playerMap = {
    Human: null as Agent,
    RandomAgent: RandomAgent
};

const N_Humans = 1;
const agents = [RandomAgent];
let players: Agent[] = _.flatten([
    _.range(N_Humans).map((i) => playerMap["Human"]),
    agents
]);

const shuffle = false;

if (shuffle) {
    players = shuffleArray(players);
}

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const input = (message: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        rl.question(message, (input: string) => resolve(input));
    });
};

const query = async (
    type: QueryType,
    message: string,
    player: number,
    options: { domino: number; direction: Direction }[],
    gameState: GameState
): Promise<any> => {
    // locally, you must respond in the format 'dominoIndex direction', e.g. '3 W'
    // if there is only one possible direction, you can skip specifying the direction
    if (players[player] === playerMap["Human"]) {
        return input(message + "\n").then((response) => {
            return {
                domino: parseInt(response.split(" ")[0]),
                direction: response.split(" ")[1]
            };
        });
    } else {
        console.log("querying agent");
        // console.log("gameState:", JSON.stringify(gameState, null, 4));
        if (options.length === 0) {
            throw new Error(
                "Tried to query an agent when no options were given"
            );
        } else if (options.length === 1) {
            return {
                domino: options[0].domino,
                direction: options[0].direction
            };
        }

        console.log("going to ask agent");

        // For now, send a blank game state. We need to add this later
        const response = await players[player].respond(
            type,
            gameState,
            player,
            options
        );
        console.log("response:", response);
        try {
            return {
                domino: options[response].domino,
                direction: options[response].direction
            };
        } catch (err) {
            console.error(err);
            console.warn("Agent returned an invalid response:", response);
            return {
                domino: options[0].domino,
                direction: options[0].direction
            };
        }
    }
};

const whisper = (type: MessageType, payload: any, player: number) => {
    let processedPayload;

    if (type === MessageType.HAND) {
        processedPayload = JSON.stringify(
            payload.map((domino: { Face1: number; Face2: number }) => [
                domino.Face1,
                domino.Face2
            ])
        );
    } else {
        processedPayload =
            typeof payload === "object" ? JSON.stringify(payload) : payload;
    }

    console.log(
        `whispering ${type} to player ${player} with payload: ${processedPayload}`
    );
};

const typesToIgnore = [MessageType.CLEAR_BOARD];

const shout = (type: MessageType, payload?: any) => {
    // Add log shouting in here based on parameters
    if (!typesToIgnore.includes(type)) {
        console.log(
            `shouting ${type} with payload: ${
                typeof payload === "object" ? JSON.stringify(payload) : payload
            }`
        );
    }
};

const engine = new Engine(2, {}, whisper, shout, query, true);
engine.InitializeRound(true);
engine.RunGame().then((winner) => console.log(winner));
