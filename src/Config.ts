import { GameConfigDescription } from "./interfaces/GameConfigDescription";
import { GameConfigDescriptionMessage } from "./interfaces/GameConfigDescriptionMessage";

export class Config {
    private _n_players: number;
    private _hand_size: number;
    private _win_threshold: number;
    private _check_5_doubles: boolean;

    constructor(config?: GameConfigDescriptionMessage) {
        this._n_players = 4;
        this._hand_size = 7;
        this._win_threshold = 150;
        this._check_5_doubles = true;

        if (config) {
            if (Object.keys(config).includes("Check_5_Doubles")) {
                this._check_5_doubles = config.Check_5_Doubles;
            }

            if (Object.keys(config).includes("WinThreshold")) {
                this._win_threshold = config.WinThreshold;
            }

            if (Object.keys(config).includes("HandSize")) {
                this._hand_size = config.HandSize;
            }
        }
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

    public get ConfigDescription(): GameConfigDescription {
        return {
            nPlayers: this.NPlayers,
            handSize: this.HandSize,
            winThreshold: this.WinThreshold
        };
    }
}
