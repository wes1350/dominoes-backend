export class Domino {
    private _ends: { big: number; small: number };
    // private coordinates: string | null;
    private _is_spinner: boolean;
    private _reversed: boolean;

    constructor(big: number, small: number) {
        if (big < small) {
            throw new Error("Must pass in big end of Domino first");
        }
        this._ends = { big, small };
        // this.coordinates = null;
        this._is_spinner = false;
        this._reversed = false;
    }

    // public get_coordinates() {
    //     return this.coordinates;
    // }

    // public set_coordinates(coordinates: string | null) {
    //     this.coordinates = coordinates;
    // }

    public get Big(): number {
        return this._ends["big"];
    }

    public get Small(): number {
        return this._ends["small"];
    }

    public IsDouble(): boolean {
        return this.Big == this.Small;
    }

    public IsSpinner(): boolean {
        return this._is_spinner;
    }

    public MarkAsSpinner(): void {
        if (this.IsDouble()) {
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

    public get Head(): number {
        return this._reversed ? this.Small : this._ends["big"];
    }

    public get Tail(): number {
        return this._reversed ? this.Big : this.Small;
    }

    public get Total(): number {
        return this._ends["big"] + this.Big;
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
