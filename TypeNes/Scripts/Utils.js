//module NES {
//    export class Utils {
//        public static copyArrayElements(src, srcPos: number, dest, destPos: number, length: number): void {
//            for (var i: number = 0; i < length; i++) {
//                dest[destPos + i] = src[srcPos + i];
//            }
//        }
//        public static copyArray(src: Array<number>): Array<number> {
//            var dest: Array<number> = new Array<number>(src.length);
//            for (var i: number = 0; i < src.length; i++) {
//                dest[i] = src[i];
//            }
//            return dest;
//        }
//        public static fromJSON(obj: Object, state: Object): void {
//            for (var i: number = 0; i < obj["JSON_PROPERTIES"].length; i++) {
//                obj[obj["JSON_PROPERTIES"][i]] = state[obj["JSON_PROPERTIES"][i]];
//            }
//        }
//        public static toJSON(obj: Object): Object {
//            var state = new Object();
//            for (var i: number = 0; i < obj["JSON_PROPERTIES"].length; i++) {
//                state[obj["JSON_PROPERTIES"][i]] = obj[obj["JSON_PROPERTIES"][i]];
//            }
//            return state;
//        }
//        public static isIE(): boolean {
//            return true;
//        }
//        private static setOp(opdata: Array<number>, inst: number, op: number, addr: number, size: number, cycles: number) {
//            opdata[op] = ((inst & 0xFF)) |
//                ((addr & 0xFF) << 8) |
//                ((size & 0xFF) << 16) |
//                ((cycles & 0xFF) << 24);
//        }
//    }
//} 
//# sourceMappingURL=Utils.js.map