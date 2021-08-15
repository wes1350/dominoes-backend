import { Domino } from "./Domino";

export class Player {
    private _id: number;
    private _hand: Domino[];
    private _score: number;

    constructor(_id: number, score = 0) {
        this._id = _id;
        this._hand = [];
        this._score = score;
    }

    public AssignHand(hand: Domino[]) {
        this._hand = hand;
    }

    public AddDomino(domino: Domino) {
        this._hand.push(domino);
    }

    public RemoveDomino(domino: Domino) {
        const requestedDomino = this._hand.find((d) => d.Equals(domino));
        if (!requestedDomino) {
            throw new Error(`Could not find domino${domino.Rep} in hand.`);
        } else {
            this._hand = this._hand.filter((d) => !d.Equals(domino));
            return requestedDomino;
        }
    }

    public AddPoints(points: number): void {
        this._score += points;
    }

    public get Id(): number {
        return this._id;
    }

    public get Score(): number {
        return this._score;
    }

    public get Hand(): Domino[] {
        return this._hand;
    }

    public get HandTotal(): number {
        return this._hand
            .map((domino) => domino.Total)
            .reduce((a, b) => a + b, 0);
    }

    public HandIsEmpty(): boolean {
        return this._hand.length === 0;
    }

    public get HandJSON(): string {
        return JSON.stringify(
            this._hand.map((domino) => [domino.Head, domino.Tail])
        );
    }

    public get HandRep(): { face1: number; face2: number }[] {
        return this.Hand.map((domino) => ({
            face1: domino.Big,
            face2: domino.Small
        }));
    }
}
