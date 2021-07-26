// import sys, random, json, time
// sys.path.insert(0, '..')  # For importing app config, required for using db
// from dominos.Config import Config
// from dominos.classes.Board import Board
// from dominos.classes.Pack import Pack
// from dominos.classes.Player import Player

import { Board } from "./Board";
import { Config } from "./Config";
import { Domino } from "./Domino";
import { Pack } from "./Pack";
import { Player } from "./Player";
import * as _ from "lodash";
import * as readlineSync from "readline-sync";

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
    private _shout_f: (message: string, tag?: string) => void;
    private _whisper_f: (message: string, index: number, tag?: string) => void;
    private _query_f: (index: number) => string;

    public constructor(
        whisper_f: (message: string, index: number) => void = null,
        shout_f: (message: string) => void = null,
        query_f: (index: number) => string = null
    ) {
        this._config = new Config();
        this._n_players = this._config.NPlayers;
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

        if ([shout_f, whisper_f, query_f].includes(null)) {
            throw new Error(
                "Must specify both shout, whisper, && retrieve functions or omit all"
            );
        }

        this._local = shout_f === null;
        this._shout_f = shout_f;
        this._whisper_f = whisper_f;
        this._query_f = query_f;
    }

    public RunGame() {
        // Start && run a game until completion, handling game logic as necessary.
        this.ShowScores();
        let next_round_fresh = this.PlayRound(true);
        while (!this.GameIsOver()) {
            next_round_fresh = this.PlayRound(next_round_fresh);
        }

        const scores = this.GetScores(false);

        const winner = scores.index(Math.max(scores));
        this.shout(`Game === over!\n\nPlayer ${winner} wins!`);
        this.shout("", "game_over");
        return winner;
    }

    public PlayRound(fresh_round = false) {
        this._board = new Board();
        this.DrawHands(fresh_round);
        this.shout("", "clear_board");
        if (fresh_round) {
            this._current_player = this.DetermineFirstPlayer();
        }
        let blocked = false;
        let play_fresh = fresh_round;
        while (this.PlayersHaveDominos() && !blocked && !this.GameIsOver()) {
            blocked = this.PlayTurn(play_fresh);
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
            this.shout("", "round_over");
            return false;
        } else if (blocked) {
            console.log("Game blocked!");
            let [blocked_scorer, points] = this.GetBlockedResult();
            if (blocked_scorer !== null) {
                console.log(`Player ${blocked_scorer} scores {points}`);
                this._players[blocked_scorer].AddPoints(points);
            }
            this.ShowScores();
            return true;
        } else {
            // Game === over
            return false;
        }
    }

    public PlayTurn(play_fresh = false) {
        const move = this.queryMove(this._current_player, play_fresh);
        const domino = move.domino;
        const direction = move.direction;
        if (domino !== null) {
            this._board.AddDomino(domino, direction);
            if (!this._local) {
                this.shout(
                    JSON.stringify(this.GetPlacementRep(domino, direction)),
                    "AddDomino"
                );
                this.sleep(0);
            }
            this._players[this._current_player].RemoveDomino(domino);
            this.whisper(
                this._players[this._current_player].HandJSON(),
                this._current_player,
                "hand"
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

        console.log(this._board);
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
                    this._players[i].AssignHand(hands[i]);
                    this.whisper(this._players[i].HandJSON, i, "hand");
                }
                return;
            }
        }
    }

    public VerifyHands(
        hands: Domino[][],
        check_5_doubles = true,
        check_any_double = false
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
                this._players[p].Hand.forEach((domino) => {
                    if (domino.Equals(new Domino(i, i))) {
                        return p;
                    }
                });
            }
        }
        throw new Error("Could !find double in player's hands");
    }

    public PlayersHaveDominos() {
        return Math.min(...this._players.map((p) => p.Hand.length)) > 0;
    }

    public GameIsOver() {
        return Math.max(...this.GetScores(false)) >= this._win_threshold;
    }

    public GetScores(indexed = true) {
        if (indexed) {
            // return {i: this.GetPlayerScore(i) for i in range(len(this._players))}
            const result: any = {};
            this._players.forEach((p, i) => {
                result[i] = this.GetPlayerScore(i);
            });
            return result;
        } else {
            // return [this.GetPlayerScore(i) for i in range(len(this._players))]
            return this._players.map((p, i) => this.GetPlayerScore(i));
        }
    }

    public GetPlayerScore(player: number) {
        return this._players[player].Score;
    }

    public queryMove(
        player: number,
        play_fresh = false
    ): { domino: Domino; direction: string } {
        while (true) {
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
                console.log(" --- " + el.rep);
            });
            if (!this._local) {
                const playable_dominos = _.range(
                    0,
                    pretty_placements.length
                ).filter((i) => pretty_placements[i].dirs.length > 0);
                // const playable_dominos = [i for i in range(len(pretty_placements)) if len(pretty_placements[i][2]) > 0]
                this.whisper(
                    playable_dominos.toString(),
                    player,
                    "playable_dominos"
                );
            }
            const move_possible = !!possible_placements.find(
                (p) => p.dirs.length > 0
            );
            // const move_possible = any([len(t[-1]) > 0 for t in possible_placements])
            if (move_possible) {
                try {
                    const query_msg = `Player ${player}, what domino do you select?\n`;
                    let domino_index;
                    let response;
                    if (this._local) {
                        domino_index = parseInt(this.input(query_msg).trim());
                    } else {
                        this.whisper(query_msg, player, "prompt");
                        response = this.GetResponse(player);
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
                            "Invalid domino choice: " + domino_index.toString(),
                            player,
                            "error"
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
                                let direction;
                                if (this._local) {
                                    direction = this.input(query_msg).trim();
                                } else {
                                    this.whisper(query_msg, player, "prompt");
                                    response = this.GetResponse(player);
                                    direction = response.trim().toUpperCase();
                                }
                                if (
                                    !possible_placements[
                                        domino_index
                                    ].dirs.includes(direction)
                                ) {
                                    this.whisper(
                                        "Invalid direction: " + direction,
                                        player,
                                        "error"
                                    );
                                } else {
                                    return { domino, direction };
                                }
                            }
                        }
                    }
                } catch (err) {
                    this.whisper("Invalid input, try again", player, "error");
                }
            } else {
                const pulled = this._pack.Pull();
                const query_msg = `Player ${player}, you have no valid moves. Send a blank input to pull\n`;
                if (this._local) {
                    const __ = this.input(query_msg);
                } else {
                    this.whisper(query_msg, player, "prompt");
                    const __ = this.GetResponse(player);
                }

                if (pulled !== null) {
                    this._players[player].AddDomino(pulled[0]);
                    this.whisper(
                        this._players[player].HandJSON,
                        player,
                        "hand"
                    );
                } else {
                    this.shout("Pack === empty, cannot pull. Skipping turn");
                    return { domino: null, direction: null };
                }
            }
        }
    }

    public GetValueOnDomino(player: number) {
        // Get the value of a 'Domino' by a player, i.e. the sum, rounded to the
        // nearest 5, of the other players' hand totals."""
        let total = this._players
            .filter((p, i) => i !== player)
            .map((p) => p.HandTotal)
            .reduce((a, b) => a + b, 0);

        // let total = sum([p.hand_total() for i, p in enumerate(this._players) if i != player])
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
        // const totals = [p.hand_total() for p in this._players]
        // console.log("Totals:", {i: totals[i] for i in range(len(totals))})
        if (totals.filter((t) => t === Math.min(...totals)).length > 1) {
            // if (len([t for t in totals if t == min(totals)]) > 1)){
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

    public GetPlacementRep(domino: Domino, direction: string) {
        const rendered_position = this._board.GetRenderedPosition(
            domino,
            direction
        );
        return {
            face1: domino.Head,
            face2: domino.Tail,
            face1loc: rendered_position["1"],
            face2loc: rendered_position["2"]
        };
    }

    public ShowScores() {
        console.log("Scores:", this.GetScores());
        if (this._local) {
            this.shout(this.GetScores(), "scores");
        }
    }

    public GetResponse(player: number, print_wait: boolean = false) {
        // query server for a response.
        while (true) {
            const response = this._query_f(player);
            if (response === "No response") {
                this.sleep(0.01);
                continue;
            } else if (response !== null) {
                return response;
            } else {
                throw new Error("Assertion error");
            }
        }
    }

    public whisper(message: string, player: number, tag: string = null) {
        console.log(player, ":", message);
        if (this._local) {
            this._whisper_f(message, player, tag);
        }
    }

    public shout(message: string, tag: string = null) {
        console.log(message);
        if (!this._local) {
            this._shout_f(message, tag);
        }
    }

    private async sleep(duration: number) {
        await new Promise((resolve) => setTimeout(resolve, duration / 1000));
    }

    private input(message: string): string {
        return readlineSync.question(message);
    }
}

// if __name__ == "__main__":
//     e = Engine()
//     winner = e.run_game()
