import { Engine } from "./Engine";
import * as readline from "readline";
import { MessageType, QueryType } from "./Enums";

// Run the game locally on the command line

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const input = (message: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        rl.question(message, (input: string) => resolve(input));
    });
};

const query = (
    _type: QueryType,
    message: string,
    _player: number
): Promise<any> => {
    // locally, you must respond in the format 'dominoIndex direction', e.g. '3 W'
    // if there is only one possible direction, you can skip specifying the direction
    return input(message + "\n").then((response) => {
        return {
            domino: response.split(" ")[0],
            direction: response.split(" ")[1]
        };
    });
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
const winner = engine.RunGame();
