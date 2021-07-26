import { Domino } from "./Domino";

export class Player {
    private _id: string;
    private _hand: Domino[];
    private _score: number;

    constructor(_id: string, score = 0) {
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
        // for i, d in enumerate(this._hand):
        //     if d == domino:
        //         this._hand.pop(i)
        //         return
        // for (const d of this._hand) {
        //     if (d.Equals(domino)) {
        //         this._hand.splice()
        //     }
        // }
        const requestedDomino = this._hand.find((d) => d.Equals(domino));
        if (!requestedDomino) {
            throw new Error(`Could not find domino${domino.Rep} in hand.`);
        } else {
            this._hand = this._hand.filter((d) => !d.Equals(domino));
            return requestedDomino;
        }

        // raise Exception(f"Could not find domino {str(domino)} in hand. Hand: {[str(dom) for dom in this._hand]}")
    }

    public AddPoints(points: number): void {
        this._score += points;
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
        // return sum([d.total() for d in this._hand])
    }

    public HandIsEmpty(): boolean {
        return this._hand.length === 0;
    }

    public get HandJSON(): any {
        return this._hand.map((domino) => {
            [domino.Head, domino.Tail];
        });
    }
}
