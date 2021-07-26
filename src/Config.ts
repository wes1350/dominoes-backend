export class Config {
    private _n_players: number;
    private _hand_size: number;
    private _win_threshold: number;
    private _check_5_doubles: boolean;

    constructor() {
        this._n_players = 4;
        this._hand_size = 7;
        this._win_threshold = 150;
        this._check_5_doubles = true;
    }

    public get NPlayers(): number {
        return this._n_players;
    }

    public get HandSize(): number {
        return this._hand_size;
    }

    public get WinThreshold(): number {
        return this._win_threshold;
    }

    public get Check5Doubles(): boolean {
        return this._check_5_doubles;
    }
}
