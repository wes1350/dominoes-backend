// import random
// from dominos.classes.Domino import Domino

import { Domino } from "./Domino";
import { getRandomInt } from "./utils";
// var Domino = require("./Domino");
// var utils = require("./utils");

export class Pack {
    private _dominos: Domino[];

    constructor(max_pips = 6) {
        this._dominos = [];
        for (let i = 0; i < max_pips + 1; i++) {
            for (let j = 0; j <= i; j++) {
                this._dominos.push(new Domino(i, j));
            }
        }
    }

    public Pull(n = 1): Domino[] | null {
        if (n === 1) {
            if (this._dominos.length === 0) {
                return null;
            }
            return this._dominos.splice(
                getRandomInt(0, this._dominos.length),
                1
            );
        } else {
            const pulled = [];
            for (let i = 0; i < n; i++) {
                pulled.push(
                    this._dominos.splice(
                        getRandomInt(0, this._dominos.length),
                        1
                    )[0]
                );
            }
            return pulled;
        }
    }
}
