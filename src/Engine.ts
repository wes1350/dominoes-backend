import { Board } from "./Board";
import { Config } from "./Config";
import { Domino } from "./Domino";
import { Pack } from "./Pack";
import { Player } from "./Player";
import * as _ from "lodash";
import * as readline from "readline";
import { QueryType, MessageType, Direction } from "./Enums";
import { GameLogMessage } from "./MessageTypes";

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
    private _shout: (type: MessageType, payload: any) => void;
    private _whisper: (type: MessageType, payload: any, index: number) => void;
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
            payload: any,
            index: number
        ) => void = null,
        shout_f: (type: MessageType, payload: any) => void = null,
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
        this.shout(MessageType.GAME_OVER, winner);
        return winner;
    }

    public InitializeRound(fresh_round = false) {
        this._board = new Board();
        this.DrawHands(fresh_round);
        this.shout(MessageType.CLEAR_BOARD);
    }

    public async PlayRound(fresh_round = false) {
        if (fresh_round) {
            this._current_player = this.DetermineFirstPlayer();
        }
        if (!this._local) {
            this.shout(MessageType.NEW_ROUND, {
                currentPlayer: this._current_player
            });
        }
        let blocked = false;
        let play_fresh = fresh_round;
        while (this.PlayersHaveDominos() && !blocked && !this.GameIsOver()) {
            blocked = await this.PlayTurn(play_fresh);
            this.NextTurn();
            play_fresh = false;
        }
        if (!this.PlayersHaveDominos()) {
            // Reverse current player switch
            this._current_player =
                (this.CurrentPlayer + this._n_players - 1) % this._n_players;
            const scoreOnDomino = this.GetValueOnDomino(this._current_player);
            this._players[this.CurrentPlayer].AddPoints(scoreOnDomino);
            this.shout(MessageType.SCORE, {
                seat: this.CurrentPlayer,
                score: scoreOnDomino
            });
            this.shoutLog(
                `Player ${this.CurrentPlayer} dominoed and scored ${scoreOnDomino} points.`
            );
            this.shout(MessageType.ROUND_OVER);
            return false;
        } else if (blocked) {
            this.shoutLog("Board is blocked.");
            let [blocked_scorer, points] = this.GetBlockedResult();
            if (blocked_scorer !== null) {
                this.shoutLog(`Player ${blocked_scorer} scores ${points}.`);
                this.shout(MessageType.SCORE, {
                    seat: blocked_scorer,
                    score: points
                });
                this._players[blocked_scorer].AddPoints(points);
            } else {
                this.shoutLog(`Nobody scores any points from the block.`);
            }
            return true;
        } else {
            // Game is over
            return false;
        }
    }

    public async PlayTurn(play_fresh = false) {
        const move = await this.queryMove(this._current_player, play_fresh);
        const domino = move.domino;
        const direction = move.direction;
        if (domino !== null) {
            const addedCoordinate = this._board.AddDomino(domino, direction);
            const placementRep = this.GetPlacementRep(domino, direction);
            this._players[this._current_player].RemoveDomino(domino);
            if (!this._local) {
                this.shout(MessageType.TURN, {
                    seat: this._current_player,
                    domino: {
                        face1: domino.Big,
                        face2: domino.Small,
                        direction: placementRep.direction,
                        x: addedCoordinate.x,
                        y: addedCoordinate.y
                    }
                });

                this.whisper(
                    MessageType.HAND,
                    this._players[this._current_player].HandRep,
                    this._current_player
                );

                this.shout(MessageType.DOMINO_PLAYED, {
                    seat: this._current_player
                });

                this.shoutLog(
                    `Player ${this._current_player} plays ${domino.Rep}.`
                );

                if (this._board.Score) {
                    this.shout(MessageType.SCORE, {
                        seat: this._current_player,
                        score: this._board.Score
                    });

                    this.shoutLog(
                        `Player ${this._current_player} scores ${this._board.Score}.`
                    );
                }
            }

            this._players[this._current_player].AddPoints(this._board.Score);
            this._n_passes = 0;
        } else {
            // Player passes
            this._n_passes += 1;
            this.shoutLog(`Player ${this._current_player} passes.`);
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
                    if (this._local) {
                        this.whisper(
                            MessageType.HAND,
                            this._players[i].HandJSON,
                            i
                        );
                    } else {
                        this.whisper(
                            MessageType.HAND,
                            this._players[i].HandRep,
                            i
                        );
                    }
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
        // Determine who has the largest double, and thus who will play first.
        // Assumes each player's hand is assigned and a double exists among them.
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

                if (pulled !== null) {
                    if (this._local) {
                        this.shout(
                            MessageType.PULL,
                            `Player ${player} cannot play, pulls a domino`
                        );
                    } else {
                        this.shout(MessageType.PULL, {
                            seat: this._current_player
                        });
                    }
                    this._players[player].AddDomino(pulled[0]);
                    if (this._local) {
                        this.whisper(
                            MessageType.HAND,
                            this._players[player].HandJSON,
                            player
                        );
                    } else {
                        this.whisper(
                            MessageType.HAND,
                            this._players[player].HandRep,
                            player
                        );
                    }
                } else {
                    this.shout(
                        MessageType.PACK_EMPTY,
                        `Player ${player} cannot play and pack is empty, skipping turn`
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
        // After adding a domino to the board, return how it will look in its rendered form
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

        return {
            face1: domino.Head,
            face2: domino.Tail,
            direction: dominoOrientationDirection,
            x: dominoCoordinates.x,
            y: dominoCoordinates.y
        };
    }

    public get Players(): Player[] {
        return this._players;
    }

    public get CurrentPlayer(): number {
        return this._current_player;
    }

    public whisper(type: MessageType, payload: any, player: number) {
        if (this._local) {
            console.log("whisper to player:", player, ":", payload);
            // this._whisper_f(message, player, tag);
            // this.input(message);
        } else {
            this._whisper(type, payload, player);
        }
    }

    public shout(type: MessageType, payload?: any) {
        console.log("shout:", payload);
        if (!this._local) {
            this._shout(type, payload);
        }
    }

    public shoutLog(message: string) {
        if (!this._local) {
            this.shout(MessageType.GAME_LOG, {
                public: true,
                message: message
            } as GameLogMessage);
        }
    }

    public whisperLog(message: string, player: number) {
        if (!this._local) {
            this.whisper(
                MessageType.GAME_LOG,
                {
                    public: false,
                    message: message
                } as GameLogMessage,
                player
            );
        }
    }

    public input(message: string): Promise<string> {
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
