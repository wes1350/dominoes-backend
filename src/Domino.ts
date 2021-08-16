export class Domino {
    private _ends: { big: number; small: number };
    private _is_spinner: boolean;
    private _reversed: boolean;

    constructor(big: number, small: number) {
        if (big < small) {
            throw new Error("Must pass in big end of Domino first");
        }
        this._ends = { big, small };
        this._is_spinner = false;
        this._reversed = false;
    }

    public get Big(): number {
        return this._ends["big"];
    }

    public get Small(): number {
        return this._ends["small"];
    }

    public IsDouble(): boolean {
        return this.Big === this.Small;
    }

    public IsSpinner(): boolean {
        return this._is_spinner;
    }

    public MarkAsSpinner(): void {
        if (!this.IsDouble()) {
            throw new Error("Cannot mark non-double as spinner");
        }
        this._is_spinner = true;
    }

    public Reverse(): void {
        if (this._reversed) {
            throw new Error("Domino should not be reversed twice");
        }
        this._reversed = true;
    }

    public IsReversed() {
        return this._reversed;
    }

    public get Head(): number {
        return this._reversed ? this.Small : this.Big;
    }

    public get Tail(): number {
        return this._reversed ? this.Big : this.Small;
    }

    public get Total(): number {
        return this.Big + this.Small;
    }

    public Equals(domino: Domino) {
        return this.Big === domino.Big && this.Small === domino.Small;
    }

    public get Rep(): string {
        return this._reversed
            ? `[${this.Small},${this.Big}]`
            : `[${this.Big},${this.Small}]`;
    }
}
