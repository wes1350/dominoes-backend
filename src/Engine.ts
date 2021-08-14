// import sys, random, json, time
// sys.path.insert(0, '..')  # For importing app config, required for using db
// from dominos.Config import Config
// from dominos.classes.Board import Board
// from dominos.classes.Pack import Pack
// from dominos.classes.Player import Player

import { Board } from "./Board";
// var Board = require("./Board");
// var Config = require("./Config");
// var Pack = require("./Pack");
// var Player = require("./Player");
import { Config } from "./Config";
import { Domino } from "./Domino";
import { Pack } from "./Pack";
import { Player } from "./Player";
import * as _ from "lodash";
import * as readline from "readline";
import { QueryType, MessageType, Direction } from "./Enums";

export class Engine {
    private _config: Config;
    private _n_players: number;
    private _hand_size: number;
    private _win_threshold: number;
    private _check_5_doubles: boolean;
    private _players: Player[];
    private _board: Board;
    private _pack: Pack;
    private _current_player: number;
    private _n_passes: number;
    private _local: boolean;
    private _shout: (type: MessageType, message: string) => void;
    private _whisper: (
        type: MessageType,
        message: string,
        index: number
    ) => void;
    private _query: (
        type: QueryType,
        message: string,
        player: number
    ) => Promise<string>;
    private rl: any;

    public constructor(
        n_players: number,
        whisper_f: (
            type: MessageType,
            message: string,
            index: number
        ) => void = null,
        shout_f: (type: MessageType, message: string) => void = null,
        query_f: (
            type: QueryType,
            message: string,
            player: number
        ) => Promise<string> = null
    ) {
        this._config = new Config();
        this._n_players = n_players ?? this._config.NPlayers;
        this._hand_size = this._config.HandSize;
        this._win_threshold = this._config.WinThreshold;
        this._check_5_doubles = this._config.Check5Doubles;
        this._players = [];
        this._board = null;
        this._pack = null;
        for (let i = 0; i < this._n_players; i++) {
            this._players.push(new Player(i));
        }
        this._current_player = null;
        this._n_passes = 0;

        // if ([shout_f, whisper_f, query_f].includes(null)) {
        //     throw new Error(
        //         "Must specify both shout, whisper, and retrieve functions or omit all"
        //     );
        // }

        this._local = shout_f === null;
        if (this._local) {
            throw new Error("Should not be local for now");
        }
        this._shout = shout_f;
        this._whisper = whisper_f;
        this._query = query_f;
        this.rl = this._local
            ? readline.createInterface({
                  input: process.stdin,
                  output: process.stdout
              })
            : null;
    }

    public async RunGame() {
        // Start && run a game until completion, handling game logic as necessary.
        this.ShowScores();
        if (this._local) {
            this.InitializeRound(true);
        }
        let next_round_fresh = await this.PlayRound(true);
        while (!this.GameIsOver()) {
            this.InitializeRound(next_round_fresh);
            next_round_fresh = await this.PlayRound(next_round_fresh);
        }

        const scores = this.GetScores();

        const winner = scores.findIndex(
            (score: number) => score === Math.max(...scores)
        );
        this.shout(
            MessageType.GAME_OVER,
            `Game is over!\n\nPlayer ${winner} wins!`
        );
        return winner;
    }

    public InitializeRound(fresh_round = false) {
        this._board = new Board();
        this.DrawHands(fresh_round);
        this.shout(MessageType.CLEAR_BOARD, "");
    }

    public async PlayRound(fresh_round = false) {
        if (fresh_round) {
            this._current_player = this.DetermineFirstPlayer();
        }
        let blocked = false;
        let play_fresh = fresh_round;
        while (this.PlayersHaveDominos() && !blocked && !this.GameIsOver()) {
            blocked = await this.PlayTurn(play_fresh);
            this.NextTurn();
            this.ShowScores();
            play_fresh = false;
        }
        if (!this.PlayersHaveDominos()) {
            // Reverse current player switch
            this._current_player =
                (this._current_player + this._n_players - 1) % this._n_players;
            this._players[this._current_player].AddPoints(
                this.GetValueOnDomino(this._current_player)
            );
            console.log(`Player ${this._current_player} dominoed!`);
            this.ShowScores();
            this.shout(MessageType.ROUND_OVER, "");
            return false;
        } else if (blocked) {
            console.log("Game blocked!");
            let [blocked_scorer, points] = this.GetBlockedResult();
            if (blocked_scorer !== null) {
                console.log(`Player ${blocked_scorer} scores ${points}`);
                this._players[blocked_scorer].AddPoints(points);
            }
            this.ShowScores();
            return true;
        } else {
            // Game is over
            return false;
        }
    }

    public async PlayTurn(play_fresh = false) {
        console.log("BEFORE MOVE");
        const move = await this.queryMove(this._current_player, play_fresh);
        console.log("AFTER MOVE");
        const domino = move.domino;
        const direction = move.direction;
        console.log("Direction:", direction)
        if (domino !== null) {
            this._board.AddDomino(domino, direction);
            if (!this._local) {
                this.shout(
                    MessageType.ADD_DOMINO,
                    JSON.stringify(this.GetPlacementRep(domino, direction))
                );
            }
            this._players[this._current_player].RemoveDomino(domino);
            this.whisper(
                MessageType.HAND,
                this._players[this._current_player].HandJSON,
                this._current_player
            );

            this._players[this._current_player].AddPoints(this._board.Score);
            this._n_passes = 0;
        } else {
            // Player passes
            this._n_passes += 1;
        }
        if (this._n_passes == this._n_players) {
            return true;
        }

        console.log(this._board.Rep);
        return false;
    }

    public NextTurn() {
        // Update the player to move.
        this._current_player = (this._current_player + 1) % this._n_players;
    }

    public DrawHands(fresh_round = false) {
        while (true) {
            this._pack = new Pack();
            const hands = [];
            for (let i = 0; i < this._n_players; i++) {
                hands.push(this._pack.Pull(this._hand_size));
            }
            if (this.VerifyHands(hands, fresh_round, this._check_5_doubles)) {
                for (let i = 0; i < this._n_players; i++) {
                    console.log("Sending hand:", i);
                    this._players[i].AssignHand(hands[i]);
                    this.whisper(
                        MessageType.HAND,
                        this._players[i].HandJSON,
                        i
                    );
                }
                return;
            }
        }
    }

    public VerifyHands(
        hands: Domino[][],
        check_any_double = false,
        check_5_doubles = true
    ) {
        if (!check_5_doubles && !check_any_double) {
            return true;
        }

        // Check that no hand has 5 doubles
        let no_doubles = true;
        hands.forEach((hand) => {
            const n_doubles = hand.filter((d) => d.IsDouble()).length;
            if (check_5_doubles) {
                if (n_doubles >= 5) {
                    return false;
                }
                if (n_doubles > 0) {
                    no_doubles = false;
                }
            }
        });
        // Check that some hand has a double
        if (check_any_double) {
            if (no_doubles) {
                return false;
            }
        }

        return true;
    }

    public DetermineFirstPlayer(): number {
        // Determine who has the largest double, && thus who will play first.
        // Assumes each player's hand === assigned && a double exists among them.
        for (let i = 6; i >= 0; i--) {
            for (let p = 0; p < this._n_players; p++) {
                for (const domino of this._players[p].Hand) {
                    if (domino.Equals(new Domino(i, i))) {
                        return p;
                    }
                }
            }
        }
        throw new Error("Could not find double in any player's hands");
    }

    public PlayersHaveDominos() {
        return Math.min(...this._players.map((p) => p.Hand.length)) > 0;
    }

    public GameIsOver() {
        return Math.max(...this.GetScores()) >= this._win_threshold;
    }

    public GetScores(): number[] {
        return this._players.map((p, i) => this.GetPlayerScore(i));
    }

    public GetPlayerScore(player: number) {
        return this._players[player].Score;
    }

    public PlayerRepresentationsForSeat(
        seatNumber: number
    ): { seatNumber: number; name: string; isMe: boolean }[] {
        return this._players.map((player, i) => {
            return {
                seatNumber: i,
                name: player.Id.toString(),
                isMe: i === seatNumber
            };
        });
    }

    public get Players(): Player[] {
        return this._players;
    }

    public async queryMove(
        player: number,
        play_fresh = false
    ): Promise<{ domino: Domino; direction: Direction }> {
        while (true) {
            console.log("In while");
            const possible_placements = this._board.GetValidPlacementsForHand(
                this._players[player].Hand,
                play_fresh
            );
            const pretty_placements = possible_placements.map((el) => {
                return { index: el.index, rep: el.domino.Rep, dirs: el.dirs };
            });
            // const pretty_placements = [(x[0], str(x[1]), x[2]) for x in possible_placements]
            console.log("Possible placements:");
            pretty_placements.forEach((el) => {
                console.log(
                    ` --- ${el.index}: ${el.rep}, [${el.dirs.join(", ")}]`
                );
            });
            if (!this._local) {
                const playable_dominos = _.range(
                    0,
                    pretty_placements.length
                ).filter((i) => pretty_placements[i].dirs.length > 0);
                // const playable_dominos = [i for i in range(len(pretty_placements)) if len(pretty_placements[i][2]) > 0]
                this.whisper(
                    MessageType.PLAYABLE_DOMINOS,
                    playable_dominos.toString(),
                    player
                );
                console.log("sent playable dominos");
            }
            const move_possible = !!possible_placements.find(
                (p) => p.dirs.length > 0
            );
            // const move_possible = any([len(t[-1]) > 0 for t in possible_placements])
            if (move_possible) {
                try {
                    const query_msg = `Player ${player}, what domino do you select?\n`;
                    let domino_index;
                    let response: string;
                    if (this._local) {
                        response = await this.input(query_msg);
                        domino_index = parseInt(response.trim());
                    } else {
                        console.log("HERE");
                        response = await this.query(
                            QueryType.DOMINO,
                            query_msg,
                            player
                        );
                        console.log("type:", typeof response);
                        domino_index = parseInt(response);
                    }
                    if (
                        !(
                            0 <= domino_index &&
                            domino_index <= possible_placements.length
                        ) ||
                        possible_placements[domino_index].dirs.length === 0
                    ) {
                        this.whisper(
                            MessageType.ERROR,
                            "Invalid domino choice: " + domino_index.toString(),
                            player
                        );
                    } else {
                        const domino = possible_placements[domino_index].domino;
                        if (
                            possible_placements[domino_index].dirs.length == 1
                        ) {
                            const direction =
                                possible_placements[domino_index].dirs[0];
                            return { domino, direction };
                        } else {
                            while (true) {
                                const query_msg = `Player ${player}, what direction do you select?\n`;
                                let direction: Direction;
                                if (this._local) {
                                    direction = (
                                        await this.input(query_msg)
                                    ).trim() as Direction;
                                } else {
                                    // this.whisper(query_msg, player, "prompt");
                                    const directionResponse = await this.query(
                                        QueryType.DIRECTION,
                                        query_msg,
                                        player
                                    );
                                    // response = this.GetResponse(player);
                                    direction = directionResponse
                                        .trim()
                                        .toUpperCase() as Direction;
                                }
                                if (
                                    !possible_placements[
                                        domino_index
                                    ].dirs.includes(direction as Direction)
                                ) {
                                    this.whisper(
                                        MessageType.ERROR,
                                        "Invalid direction: " + direction,
                                        player
                                    );
                                } else {
                                    return { domino, direction };
                                }
                            }
                        }
                    }
                } catch (err) {
                    this.whisper(
                        MessageType.ERROR,
                        "Invalid input, try again",
                        player
                    );
                }
            } else {
                const pulled = this._pack.Pull();
                const query_msg = `Player ${player}, you have no valid moves. Send a blank input to pull\n`;
                if (this._local) {
                    const __ = await this.input(query_msg);
                } else {
                    // this.whisper(query_msg, player, "prompt");
                    // const __ = this.GetResponse(player);
                    const __ = await this.query(
                        QueryType.PULL,
                        query_msg,
                        player
                    );
                }

                if (pulled !== null) {
                    this._players[player].AddDomino(pulled[0]);
                    this.whisper(
                        MessageType.HAND,
                        this._players[player].HandJSON,
                        player
                    );
                } else {
                    this.shout(
                        MessageType.PACK_EMPTY,
                        "Pack is empty, cannot pull. Skipping turn"
                    );
                    return { domino: null, direction: null };
                }
            }
        }
    }

    public GetValueOnDomino(player: number) {
        // Get the value of a 'Domino' by a player, i.e. the sum, rounded to the
        // nearest 5, of the other players' hand totals.
        let total = this._players
            .filter((p, i) => i !== player)
            .map((p) => p.HandTotal)
            .reduce((a, b) => a + b, 0);

        if (total % 5 > 2) {
            total += 5 - (total % 5);
        } else {
            total -= total % 5;
        }
        return total;
    }

    public GetBlockedResult() {
        // Find the player (if any) that wins points when the game === blocked && return
        // that player && the points they receive.
        const totals = this._players.map((p) => p.HandTotal);
        if (totals.filter((t) => t === Math.min(...totals)).length > 1) {
            // Multiple players have lowest count, so nobody gets points
            return [null, 0];
        } else {
            // Find the player with minimum score && the sum of the other players' hands, rounded to the nearest 5
            const scorer = totals.indexOf(Math.min(...totals));
            let total = totals.reduce((a, b) => a + b, 0) - Math.min(...totals);
            if (total % 5 > 2) {
                total += 5 - (total % 5);
            } else {
                total -= total % 5;
            }
            return [scorer, total];
        }
    }

    public GetPlacementRep(domino: Domino, addedDirection: Direction) {
        // const rendered_position = this._board.GetRenderedPosition(
        //     domino,
        //     direction
        // );
        // return {
        //     face1: domino.Head,
        //     face2: domino.Tail,
        //     face1loc: rendered_position["1"],
        //     face2loc: rendered_position["2"]
        // };
        let dominoOrientationDirection: Direction;
        if (
            addedDirection === Direction.NONE ||
            addedDirection === Direction.EAST ||
            addedDirection === Direction.WEST
        ) {
            if (domino.IsDouble()) {
                dominoOrientationDirection = Direction.SOUTH;
            } else {
                dominoOrientationDirection = domino.IsReversed()
                    ? Direction.WEST
                    : Direction.EAST;
            }
        } else if (
            addedDirection === Direction.NORTH ||
            addedDirection === Direction.SOUTH
        ) {
            if (domino.IsDouble()) {
                dominoOrientationDirection = Direction.EAST;
            } else {
                dominoOrientationDirection = domino.IsReversed()
                    ? Direction.NORTH
                    : Direction.SOUTH;
            }
        }

        const dominoCoordinates =
            addedDirection === Direction.NONE
                ? { x: 0, y: 0 }
                : addedDirection === Direction.NORTH
                ? this._board.NorthEdge
                : addedDirection === Direction.EAST
                ? this._board.EastEdge
                : addedDirection === Direction.SOUTH
                ? this._board.SouthEdge
                : addedDirection === Direction.WEST
                ? this._board.WestEdge
                : null;

        console.log(addedDirection, dominoOrientationDirection)
        console.log(dominoCoordinates)

        return {
            face1: domino.Head,
            face2: domino.Tail,
            direction: dominoOrientationDirection,
            x: dominoCoordinates.x,
            y: dominoCoordinates.y
        };
    }

    public ShowScores() {
        this.shout(MessageType.SCORES, JSON.stringify(this.GetScores()));
    }

    public GetResponse(player: number, print_wait: boolean = false) {
        // query server for a response.
        return "";
        // throw new Error("Should not reach this function yet");
        // while (true) {
        //     const response = this._query_f(player);
        //     if (response === "No response") {
        //         this.sleep(0.01);
        //         continue;
        //     } else if (response !== null) {
        //         return response;
        //     } else {
        //         throw new Error("Assertion error");
        //     }
        // }
    }

    public whisper(type: MessageType, message: string, player: number) {
        if (this._local) {
            console.log("whisper to player:", player, ":", message);
            // this._whisper_f(message, player, tag);
            // this.input(message);
        } else {
            this._whisper(type, message, player);
        }
    }

    public shout(type: MessageType, message: string) {
        if (this._local) {
            console.log("shout:", message);
        } else {
            // this._shout_f(message, tag);
            this._shout(type, message);
        }
    }

    // private async sleep(duration: number) {
    //     await new Promise((resolve) => setTimeout(resolve, duration / 1000));
    // }

    public input(message: string): Promise<string> {
        // const response = readlineSync.question(message);
        // return response;
        return new Promise((resolve, reject) => {
            this.rl.question(message, (input: string) => resolve(input));
        });
    }

    public query = (
        type: QueryType,
        message: string,
        player: number
    ): Promise<string> => {
        return this._query(type, message, player);
    };
}

// if __name__ == "__main__":
//     e = Engine()
//     winner = e.run_game()
