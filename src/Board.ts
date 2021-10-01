import _ from "lodash";
import { Domino } from "./Domino";
import { Direction } from "./enums/Direction";

export class Board {
    private _board: Map<number, Map<number, Domino>>;
    private _north: number;
    private _east: number;
    private _south: number;
    private _west: number;
    private _spinner_x: number;

    constructor() {
        this._board = new Map<number, Map<number, Domino>>();
        this._north = null;
        this._east = null;
        this._south = null;
        this._west = null;
        this._spinner_x = null;
    }

    private _addToBoard(domino: Domino, x: number, y: number): void {
        if (!this._board.has(x)) {
            this._board.set(x, new Map<number, Domino>());
        }
        this._board.get(x).set(y, domino);
    }

    private _dominoExistsAt(x: number, y: number): boolean {
        return this._board.get(x)?.has(y);
    }

    private _getDominoAt(x: number, y: number): Domino {
        return this._board.get(x)?.get(y);
    }

    public AddDomino(
        domino: Domino,
        direction = Direction.NONE
    ): { x: number; y: number } {
        let [valid, reverse] = this.VerifyPlacement(domino, direction);
        let x, y;
        if (!valid) {
            throw new Error(
                `Domino ${domino.Rep} cannot be added in the ${direction} direction`
            );
        }

        if (direction === Direction.NONE) {
            // When placing the first domino
            if (this._dominoExistsAt(0, 0)) {
                throw new Error(
                    "Must specify a valid direction if the board contains dominoes"
                );
            }
            x = 0;
            y = 0;
            this._north = 0;
            this._east = 0;
            this._south = 0;
            this._west = 0;

            if (domino.IsDouble()) {
                this._spinner_x = 0;
                domino.MarkAsSpinner();
            }
        } else if (direction === Direction.NORTH) {
            if (this._spinner_x === null) {
                throw new Error(
                    "Cannot add domino to north side when spinner isn't set"
                );
            }
            this._north += 1;
            x = this._spinner_x;
            y = this._north;
        } else if (direction === Direction.EAST) {
            this._east += 1;
            x = this._east;
            y = 0;
            if (this._spinner_x === null && domino.IsDouble()) {
                this._spinner_x = this._east;
                domino.MarkAsSpinner();
            }
        } else if (direction === Direction.SOUTH) {
            if (this._spinner_x === null) {
                throw new Error(
                    "Cannot add domino to south side when spinner isn't set"
                );
            }
            this._south -= 1;
            x = this._spinner_x;
            y = this._south;
        } else if (direction === Direction.WEST) {
            this._west -= 1;
            x = this._west;
            y = 0;
            if (this._spinner_x === null && domino.IsDouble()) {
                this._spinner_x = this._west;
                domino.MarkAsSpinner();
            }
        } else {
            throw new Error("Unknown direction:" + direction);
        }

        this._addToBoard(domino, x, y);
        if (reverse) {
            domino.Reverse();
        }
        return { x, y };
    }

    public VerifyPlacement(domino: Domino, direction: Direction): boolean[] {
        // Return whether a domino can be placed in the given direction
        // and whether it needs to be reversed in order to be valid.
        let x, y;
        if (direction === Direction.NONE) {
            if (this._dominoExistsAt(0, 0)) {
                return [false, false];
            }
            return [true, false]; // No need to check in this case as it's the first placement
        } else if (direction === Direction.NORTH) {
            if (
                this._spinner_x === null ||
                this._east === this._spinner_x ||
                this._west === this._spinner_x
            ) {
                return [false, false];
            }
            x = this._spinner_x;
            y = this._north;
        } else if (direction === Direction.EAST) {
            x = this._east;
            y = 0;
        } else if (direction === Direction.SOUTH) {
            if (
                this._spinner_x === null ||
                this._east === this._spinner_x ||
                this._west === this._spinner_x
            ) {
                return [false, false];
            }
            x = this._spinner_x;
            y = this._south;
        } else if (direction === Direction.WEST) {
            x = this._west;
            y = 0;
        } else {
            throw new Error("Invalid direction:" + direction);
        }

        let hook;
        if ([Direction.NORTH, Direction.WEST].includes(direction)) {
            hook = this._getDominoAt(x, y).Head;
        } else {
            hook = this._getDominoAt(x, y).Tail;
        }
        if (this.GetLinkEnd(domino, direction) === hook) {
            return [true, false];
        } else if (this.GetFreeEnd(domino, direction) === hook) {
            return [true, true];
        }
        return [false, false];
    }

    public GetLinkEnd(domino: Domino, direction: Direction) {
        return [Direction.NORTH, Direction.WEST].includes(direction)
            ? domino.Tail
            : domino.Head;
    }

    public GetFreeEnd(domino: Domino, direction: Direction) {
        return [Direction.NORTH, Direction.WEST].includes(direction)
            ? domino.Head
            : domino.Tail;
    }

    public GetValidPlacements(domino: Domino): Direction[] {
        // Return which directions a domino can be placed in.
        if (this.IsEmpty()) {
            return [Direction.NONE];
        }
        return Object.values(Direction).filter(
            (d) => this.VerifyPlacement(domino, d)[0]
        );
    }

    public GetValidPlacementsForHand(
        hand: Domino[],
        play_fresh = false
    ): { index: number; domino: Domino; dirs: Direction[] }[] {
        const placements: {
            index: number;
            domino: Domino;
            dirs: Direction[];
        }[] = [];
        let largest_double = -1;
        if (play_fresh) {
            hand.forEach((domino: Domino) => {
                if (domino.IsDouble() && domino.Head > largest_double) {
                    largest_double = domino.Head;
                }
            });
        }
        hand.forEach((domino, i) => {
            if (play_fresh) {
                if (domino.Head !== largest_double || !domino.IsDouble()) {
                    placements.push({ index: i, domino, dirs: [] });
                } else {
                    placements.push({
                        index: i,
                        domino,
                        dirs: this.GetValidPlacements(domino)
                    });
                }
            } else {
                placements.push({
                    index: i,
                    domino,
                    dirs: this.GetValidPlacements(domino)
                });
            }
        });
        return placements;
    }
    public IsEmpty(): boolean {
        return Array.from(this._board.keys()).length === 0;
    }

    public get Score(): number {
        if (this.IsEmpty()) {
            throw new Error("Cannot score an empty board");
        }

        let total = 0;
        if (this._east === 0 && this._west === 0) {
            total += this._getDominoAt(0, 0).Total;
        } else {
            // We have at least two dominoes, so each domino on the end will only count once

            // Handle east-west
            let east = this._getDominoAt(this._east, 0);
            let west = this._getDominoAt(this._west, 0);

            if (east.IsDouble()) {
                total += east.Total;
            } else {
                total += this.GetFreeEnd(east, Direction.EAST);
            }

            if (west.IsDouble()) {
                total += west.Total;
            } else {
                total += this.GetFreeEnd(west, Direction.WEST);
            }

            // Handle north-south
            if (this._north > 0) {
                let north = this._getDominoAt(this._spinner_x, this._north);
                if (north.IsDouble()) {
                    total += north.Total;
                } else {
                    total += this.GetFreeEnd(north, Direction.NORTH);
                }
            }

            if (this._south < 0) {
                let south = this._getDominoAt(this._spinner_x, this._south);
                if (south.IsDouble()) {
                    total += south.Total;
                } else {
                    total += this.GetFreeEnd(south, Direction.SOUTH);
                }
            }
        }
        return total % 5 === 0 ? total : 0;
    }

    public get NorthEdge(): { x: number; y: number } {
        return this._spinner_x !== null
            ? { x: this._spinner_x, y: this._north }
            : null;
    }

    public get EastEdge(): { x: number; y: number } {
        return { x: this._east, y: 0 };
    }

    public get SouthEdge(): { x: number; y: number } {
        return this._spinner_x !== null
            ? { x: this._spinner_x, y: this._south }
            : null;
    }

    public get WestEdge(): { x: number; y: number } {
        return { x: this._west, y: 0 };
    }

    public get Rep(): string {
        // Prints the current board state.
        if (this._north === null) {
            return ".";
        }
        let rep = "";
        for (let r = this._north; r > this._south - 1; r--) {
            for (let c = this._west; c < this._east + 1; c++) {
                if (this._dominoExistsAt(c, r)) {
                    rep += this._getDominoAt(c, r).Rep;
                } else {
                    rep += "  .  ";
                }
            }
            rep += "\n";
        }
        return rep;
    }

    public get Dominoes(): Domino[] {
        return _.flatten(
            Array.from(this._board.values()).map((yMap) =>
                Array.from(yMap.values())
            )
        );
    }

    public get DominoRepresentations(): {
        face1: number;
        face2: number;
        x: number;
        y: number;
    }[] {
        return _.flatten(
            Array.from(this._board.entries()).map((xEntry) => {
                const x = xEntry[0];
                const xMap = xEntry[1];
                return Array.from(xMap.entries()).map((yEntry) => {
                    const y = yEntry[0];
                    const domino = yEntry[1];
                    return { face1: domino.Big, face2: domino.Small, x, y };
                });
            })
        );
    }

    // The face value of the spinner, or null if the spinner doesn't exist
    public get Spinner(): number {
        if (this._spinner_x === null) {
            return null;
        }
        return Array.from(this._board.get(this._spinner_x).values()).find(
            (domino) => domino.IsSpinner()
        ).Big;
    }
}
