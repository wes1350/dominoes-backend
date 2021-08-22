export enum QueryType {
    MOVE = "QUERY_MOVE"
}

export enum MessageType {
    ADD_DOMINO = "ADD_DOMINO",
    PLAYABLE_DOMINOS = "PLAYABLE_DOMINOS",
    HAND = "HAND",
    GAME_START = "GAME_START",
    GAME_OVER = "GAME_OVER",
    PACK_EMPTY = "PACK_EMPTY",
    CLEAR_BOARD = "CLEAR_BOARD",
    SCORE = "SCORE",
    ERROR = "ERROR",
    TURN = "TURN",
    PULL = "PULL",
    DOMINO_PLAYED = "DOMINO_PLAYED",
    NEW_ROUND = "NEW_ROUND",
    GAME_LOG = "GAME_LOG",
    PLAYER_DOMINOED = "PLAYER_DOMINOED",
    GAME_BLOCKED = "GAME_BLOCKED"
}

export enum Direction {
    NORTH = "N",
    EAST = "E",
    SOUTH = "S",
    WEST = "W",
    NONE = ""
}
