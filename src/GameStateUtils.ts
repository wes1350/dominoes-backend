import { Direction } from "./enums/Direction";
import { GameState } from "./interfaces/GameState";

export class GameStateUtils {
    public static ProcessScore(score: number): number {
        return score % 5 === 0 ? score : 0;
    }

    public static CalculateScoreAfterPlay(
        gameState: GameState,
        play: { domino: number; direction: Direction }
    ): number {
        const board = gameState.board;
        const playedDomino = gameState.players.me.hand[play.domino];

        if (board.length === 0) {
            return GameStateUtils.ProcessScore(
                playedDomino.head + playedDomino.tail
            );
        } else {
            const northEdge = Math.max(...board.map((domino) => domino.y));
            const southEdge = Math.min(...board.map((domino) => domino.y));
            const northEdgeDomino = board.find(
                (domino) => domino.y === northEdge
            );
            const southEdgeDomino = board.find(
                (domino) => domino.y === southEdge
            );
            let northValue;

            if (play.direction === Direction.NORTH) {
                const freeEnd =
                    playedDomino.head === northEdgeDomino.head
                        ? playedDomino.tail
                        : playedDomino.head;
                northValue =
                    freeEnd * (playedDomino.head === playedDomino.tail ? 2 : 1);
            } else {
                northValue =
                    northEdge > 0
                        ? northEdgeDomino.head *
                          (northEdgeDomino.head === northEdgeDomino.tail
                              ? 2
                              : 1)
                        : 0;
            }

            let southValue;
            if (play.direction === Direction.SOUTH) {
                const freeEnd =
                    playedDomino.head === southEdgeDomino.tail
                        ? playedDomino.tail
                        : playedDomino.head;
                southValue =
                    freeEnd * (playedDomino.head === playedDomino.tail ? 2 : 1);
            } else {
                southValue =
                    southEdge < 0
                        ? southEdgeDomino.tail *
                          (southEdgeDomino.head === southEdgeDomino.tail
                              ? 2
                              : 1)
                        : 0;
            }

            const westEdge = Math.min(...board.map((domino) => domino.x));
            const eastEdge = Math.max(...board.map((domino) => domino.x));
            const westEdgeDomino = board.find(
                (domino) => domino.x === westEdge
            );
            const eastEdgeDomino = board.find(
                (domino) => domino.x === eastEdge
            );
            let westValue;
            if (play.direction === Direction.WEST) {
                const freeEnd =
                    playedDomino.head === westEdgeDomino.head
                        ? playedDomino.tail
                        : playedDomino.head;
                westValue =
                    freeEnd * (playedDomino.head === playedDomino.tail ? 2 : 1);
            } else {
                westValue =
                    westEdgeDomino.head *
                    (westEdgeDomino.head === westEdgeDomino.tail ? 2 : 1);
            }

            let eastValue;
            if (play.direction === Direction.EAST) {
                const freeEnd =
                    playedDomino.head === eastEdgeDomino.tail
                        ? playedDomino.tail
                        : playedDomino.head;
                eastValue =
                    freeEnd * (playedDomino.head === playedDomino.tail ? 2 : 1);
            } else {
                eastValue =
                    eastEdgeDomino.tail *
                    (eastEdgeDomino.head === eastEdgeDomino.tail ? 2 : 1);
            }

            return GameStateUtils.ProcessScore(
                northValue + southValue + eastValue + westValue
            );
        }
    }
}
