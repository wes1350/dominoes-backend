export enum QueryType {
    DOMINO = "QUERY_DOMINO",
    DIRECTION = "QUERY_DIRECTION",
    PULL = "QUERY_PULL"
}

export enum MessageType {
    ADD_DOMINO = "ADD_DOMINO",
    PLAYABLE_DOMINOS = "PLAYABLE_DOMINOS",
    HAND = "HAND",
    GAME_START = "GAME_START",
    GAME_OVER = "GAME_OVER",
    ROUND_OVER = "ROUND_OVER",
    PACK_EMPTY = "PACK_EMPTY",
    CLEAR_BOARD = "CLEAR_BOARD",
    SCORES = "SCORES",
    ERROR = "ERROR",
    TURN = "TURN",
    PULL = "PULL",
    OPPONENT_DOMINO_PLAYED = "OPPONENT_DOMINO_PLAYED"
}

export enum Direction {
    NORTH = "N",
    EAST = "E",
    SOUTH = "S",
    WEST = "W",
    NONE = ""
}
