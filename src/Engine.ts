import { Board } from "./Board";
import { Config } from "./Config";
import { Domino } from "./Domino";
import { Pack } from "./Pack";
import { Player } from "./Player";
import * as _ from "lodash";
import { GameConfigDescriptionMessage } from "./interfaces/GameConfigDescriptionMessage";
import { MessageType } from "./enums/MessageType";
import { QueryType } from "./enums/QueryType";
import { Direction } from "./enums/Direction";
import { PossiblePlaysMessage } from "./interfaces/PossiblePlaysMessage";
import { GameState } from "./interfaces/GameState";

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
    private _shout: (type: MessageType, payload?: any) => void;
    private _whisper: (type: MessageType, payload: any, index: number) => void;
    private _query: (
        type: QueryType,
        message: string,
        player: number,
        options: any,
        gameState: GameState
    ) => Promise<any>;
    private _local?: boolean;

    public constructor(
        n_players: number,
        configDescription: GameConfigDescriptionMessage,
        whisper_f: (
            type: MessageType,
            payload: any,
            index: number
        ) => void = null,
        shout_f: (type: MessageType, payload?: any) => void = null,
        query_f: (
            type: QueryType,
            message: string,
            player: number,
            options: any,
            gameState: GameState
        ) => Promise<any> = null,
        local?: boolean
    ) {
        this._config = new Config(configDescription);
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

        this._shout = shout_f;
        this._whisper = whisper_f;
        this._query = query_f;
        this._local = local;
    }

    public async RunGame(): Promise<number> {
        // Start and run a game until completion, handling game logic as necessary.
        let next_round_fresh = await this.PlayRound(true);
        while (!this.GameIsOver()) {
            this.InitializeRound(next_round_fresh);
            next_round_fresh = await this.PlayRound(next_round_fresh);
        }

        const scores = this.GetScores();

        const winner = scores.findIndex(
            (score: number) => score === Math.max(...scores)
        );
        return winner;
    }

    public InitializeRound(fresh_round = false) {
        this._board = new Board();
        this.DrawHands(fresh_round);
        this._shout(MessageType.CLEAR_BOARD);
    }

    public async PlayRound(fresh_round = false) {
        if (fresh_round) {
            this._current_player = this.DetermineFirstPlayer();
        }
        this._shout(MessageType.NEW_ROUND, {
            currentPlayer: this.CurrentPlayer
        });
        let blocked = false;
        let play_fresh = fresh_round;
        while (this.PlayersHaveDominoes() && !blocked && !this.GameIsOver()) {
            blocked = await this.PlayTurn(play_fresh);
            this.NextTurn();
            play_fresh = false;
        }
        if (blocked === null) {
            // Temporary case for disconnects
            return false;
        }

        if (!this.PlayersHaveDominoes()) {
            this._current_player =
                (this.CurrentPlayer + this._n_players - 1) % this._n_players;
            const scoreOnDomino = this.GetValueOnDomino(this.CurrentPlayer);
            this._players[this.CurrentPlayer].AddPoints(scoreOnDomino);
            this._shout(MessageType.SCORE, {
                seat: this.CurrentPlayer,
                score: scoreOnDomino
            });
            this._shout(MessageType.PLAYER_DOMINOED);
            return false;
        } else if (blocked) {
            this._shout(MessageType.GAME_BLOCKED);
            let [blocked_scorer, points] = this.GetBlockedResult();
            if (blocked_scorer !== null) {
                this._shout(MessageType.SCORE, {
                    seat: blocked_scorer,
                    score: points
                });
                this._players[blocked_scorer].AddPoints(points);
            }
            return true;
        } else {
            // Game is over
            return false;
        }
    }

    public async PlayTurn(play_fresh = false) {
        const move = await this.queryMove(this.CurrentPlayer, play_fresh);
        if (move === null) {
            // Temporary case for disconnects
            return null;
        }
        const domino = move.domino;
        const direction = move.direction;
        if (domino !== null) {
            const addedCoordinate = this._board.AddDomino(domino, direction);
            const placementRep = this.GetPlacementRep(domino, direction);
            this._players[this.CurrentPlayer].RemoveDomino(domino);
            this._shout(MessageType.TURN, {
                seat: this.CurrentPlayer,
                domino: {
                    Face1: domino.Big,
                    Face2: domino.Small
                },
                direction: placementRep.direction,
                coordinate: {
                    X: addedCoordinate.x,
                    Y: addedCoordinate.y
                }
            });

            this._whisper(
                MessageType.HAND,
                this._players[this.CurrentPlayer].HandRep,
                this.CurrentPlayer
            );

            this._shout(MessageType.DOMINO_PLAYED, {
                seat: this.CurrentPlayer
            });

            if (this._board.Score) {
                this._shout(MessageType.SCORE, {
                    seat: this.CurrentPlayer,
                    score: this._board.Score
                });
            }

            this._players[this.CurrentPlayer].AddPoints(this._board.Score);
            this._n_passes = 0;
        } else {
            // Player passes
            this._n_passes += 1;

            this._shout(MessageType.TURN, {
                seat: this.CurrentPlayer,
                domino: null,
                direction: null,
                coordinate: null
            });
        }
        if (this._n_passes == this._n_players) {
            return true;
        }

        if (this._local) {
            console.log("\n\n" + this._board.Rep + "\n");
        }

        return false;
    }

    public NextTurn() {
        // Update the player to move.
        this._current_player = (this.CurrentPlayer + 1) % this._n_players;
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
                    this._whisper(
                        MessageType.HAND,
                        this._players[i].HandRep,
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

    public PlayersHaveDominoes() {
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

    public async queryMove(
        player: number,
        play_fresh = false
    ): Promise<{ domino: Domino; direction: Direction }> {
        while (true) {
            const possible_placements = this._board.GetValidPlacementsForHand(
                this._players[player].Hand,
                play_fresh
            );
            if (this._local) {
                console.log("Possible placements:");
                possible_placements.forEach((el) => {
                    console.log(
                        ` --- ${el.index}: ${el.domino.Rep}, [${el.dirs.join(
                            ", "
                        )}]`
                    );
                });
            }

            const possiblePlays = {
                plays: _.flatten(
                    possible_placements.map((placement) =>
                        placement.dirs.map((dir) => ({
                            domino: placement.index,
                            direction: dir
                        }))
                    )
                )
            } as PossiblePlaysMessage;

            const move_possible = !!possible_placements.find(
                (p) => p.dirs.length > 0
            );
            if (move_possible) {
                try {
                    this._whisper(
                        MessageType.POSSIBLE_PLAYS,
                        possiblePlays,
                        player
                    );
                    const response: { domino: number; direction: string } =
                        await this._query(
                            QueryType.MOVE,
                            `Player ${player}, make a move`,
                            player,
                            possiblePlays.plays,
                            this.getGameStateForPlayer(player)
                        );
                    if (response === null) {
                        // Temporary case for disconnects
                        return null;
                    }
                    const dominoIndex = response.domino;
                    const domino = possible_placements[dominoIndex].domino;

                    if (
                        !(
                            0 <= dominoIndex &&
                            dominoIndex <= possible_placements.length
                        ) ||
                        possible_placements[dominoIndex].dirs.length === 0
                    ) {
                        this._whisper(
                            MessageType.ERROR,
                            "Invalid domino choice: " + dominoIndex.toString(),
                            player
                        );
                        continue;
                    }

                    let direction = response.direction as Direction;

                    if (possible_placements[dominoIndex].dirs.length == 1) {
                        direction = possible_placements[dominoIndex].dirs[0];
                    } else {
                        if (
                            !possible_placements[dominoIndex].dirs.includes(
                                direction
                            )
                        ) {
                            this._whisper(
                                MessageType.ERROR,
                                "Invalid domino choice: " +
                                    dominoIndex.toString(),
                                player
                            );
                            continue;
                        }
                    }

                    return {
                        domino: domino,
                        direction: direction
                    };
                } catch (err) {
                    console.error(err);
                    this._whisper(
                        MessageType.ERROR,
                        "Invalid input, try again",
                        player
                    );
                }
            } else {
                const pulled = this._pack.Pull();

                if (pulled !== null) {
                    this._shout(MessageType.PULL, {
                        seat: this.CurrentPlayer
                    });
                    this._players[player].AddDomino(pulled[0]);
                    this._whisper(
                        MessageType.HAND,
                        this._players[player].HandRep,
                        player
                    );
                } else {
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

    private getPlayerDescriptionOfSelf(seat: number, player: Player) {
        return {
            seatNumber: seat,
            score: this.GetPlayerScore(seat),
            hand: player.Hand.map((domino) => ({
                face1: domino.Big,
                face2: domino.Small
            }))
        };
    }

    private getPlayerDescriptionOfOpponent(seat: number, opponent: Player) {
        return {
            seatNumber: seat,
            score: this.GetPlayerScore(seat),
            dominoesInHand: opponent.Hand.length
        };
    }

    private getPlayerRepresentations(seat: number) {
        const me = this._players.find((p) => p.Id === seat);
        const opponents = this._players.filter((p) => p.Id !== seat);
        return {
            me: this.getPlayerDescriptionOfSelf(seat, me),
            opponents: opponents.map((opponent) =>
                this.getPlayerDescriptionOfOpponent(seat, opponent)
            )
        };
    }

    private getGameStateForPlayer(player: number): GameState {
        return {
            config: this._config.ConfigDescription,
            seatNumberForTurn: this._current_player, // maybe need to go back one player for event notification, depending on call order
            spinner: this._board.Spinner,
            board: this._board.DominoRepresentations,
            players: this.getPlayerRepresentations(player)
        };
    }
}

module.exports = { Engine };
