/*
Copyright (C) 2017 Charlie Lee

TypeNESs has referred to Ben Firshman's JSNES
https://github.com/bfirsh/jsnes

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/
var NES;
(function (NES) {
    var CPUStatus = (function () {
        function CPUStatus(no, addr, code, A, X, Y, S, P, N, V, B, D, I, Z, C) {
            this.no = 0;
            this.addr = 0;
            this.code = 0;
            this.A = 0;
            this.X = 0;
            this.Y = 0;
            this.S = 0;
            this.P = 0;
            this.N = 0;
            this.V = 0;
            this.B = 0;
            this.D = 0;
            this.I = 0;
            this.Z = 0;
            this.C = 0;
            this.cycles = 0;
            this.no_prev = no;
            this.addr_prev = addr;
            this.code_prev = code;
            this.A_prev = A;
            this.X_prev = X;
            this.Y_prev = Y;
            this.S_prev = S;
            this.P_prev = P;
            this.N_prev = N;
            this.V_prev = V;
            this.B_prev = B;
            this.D_prev = D;
            this.I_prev = I;
            this.Z_prev = Z;
            this.C_prev = C;
        }
        CPUStatus.prototype.setAfter = function (no, addr, code, A, X, Y, S, P, N, V, B, D, I, Z, C, cycles) {
            this.no = no;
            this.addr = addr;
            this.code = code;
            this.A = A;
            this.X = X;
            this.Y = Y;
            this.S = S;
            this.P = P;
            this.N = N;
            this.V = V;
            this.B = B;
            this.D = D;
            this.I = I;
            this.Z = Z;
            this.C = C;
            this.cycles = cycles;
        };
        CPUStatus.prototype.buildString = function (prop, oldVal, newVal) {
            if (oldVal == newVal) {
                return ' ' + prop + ':' + oldVal.toString(16);
            }
            return ' ' + prop + ':' + oldVal.toString(16) + '=><span class="highlight">' + newVal.toString(16) + '</span>';
        };
        CPUStatus.prototype.printStatus = function () {
            var res = '';
            res += this.buildString('no', this.no_prev, this.no_prev);
            res += this.buildString('addr', this.addr_prev, this.addr);
            res += this.buildString('code', this.code_prev, this.code);
            res += this.buildString('A', this.A_prev, this.A);
            res += this.buildString('X', this.X_prev, this.X);
            res += this.buildString('Y', this.Y_prev, this.Y);
            //res += this.buildString('S', this.S_prev, this.S);
            //res += this.buildString('P', this.P_prev, this.P);
            res += this.buildString('N', this.N_prev, this.N);
            res += this.buildString('V', this.V_prev, this.V);
            res += this.buildString('B', this.B_prev, this.B);
            res += this.buildString('D', this.D_prev, this.D);
            res += this.buildString('I', this.I_prev, this.I);
            //res += this.buildString('Z', this.Z_prev, this.Z);
            res += this.buildString('C', this.C_prev, this.C);
            res += this.buildString('cycles', this.cycles, this.cycles);
            return res + '<br/>';
        };
        return CPUStatus;
    })();
    var Debugger = (function () {
        function Debugger(nesMachine) {
            this.start = -1;
            this.stop = -1;
            this.hasPrinted = false;
            this.machine = nesMachine;
            this.debugWnd = document.getElementById("debugWnd");
            this.historyStatus = new Array();
            this.apuDbgInfo = new Array();
        }
        Debugger.prototype.isDebuggerEnabled = function (counter) {
            return (counter >= this.start) && (counter <= this.stop);
        };
        Debugger.prototype.setBefore = function (no, addr, code, A, X, Y, S, P, N, V, B, D, I, Z, C) {
            this.historyStatus.push(new CPUStatus(no, addr, code, A, X, Y, S, P, N, V, B, D, I, Z, C));
        };
        Debugger.prototype.setAfter = function (no, addr, code, A, X, Y, S, P, N, V, B, D, I, Z, C, cycles) {
            this.historyStatus[this.historyStatus.length - 1].setAfter(no, addr, code, A, X, Y, S, P, N, V, B, D, I, Z, C, cycles);
            //this.historyStatus.push(new CPUStatus(no, addr, code, A, X, Y, S, P, N, V, B, D, I, Z, C));
            if (no == this.stop) {
                this.outputHistoryStatus();
            }
        };
        Debugger.prototype.outputHistoryStatus = function () {
            this.debugWnd.innerHTML = '';
            var result = "";
            for (var _i = 0, _a = this.historyStatus; _i < _a.length; _i++) {
                var status_1 = _a[_i];
                result += status_1.printStatus();
            }
            //this.debugWnd.innerHTML = result;
            var x = window.open();
            x.document.open();
            x.document.write(result);
            x.document.close();
            this.hasPrinted = true;
        };
        Debugger.prototype.printDebuggingMsg = function (no, addr, code, A, X, Y, S, P, N, V, B, D, I, Z, C, cycles) {
            //var debugWnd = <HTMLTextAreaElement>document.getElementById("debugWnd");
            this.debugWnd.innerHTML += no + ' : ' + addr + ' :  ' + code;
            this.debugWnd.innerHTML += ' A:' + '<b>' + A + '</b>';
            this.debugWnd.innerHTML += ' X:' + X;
            this.debugWnd.innerHTML += ' Y:' + Y;
            this.debugWnd.innerHTML += ' S:' + S;
            this.debugWnd.innerHTML += ' P:' + P;
            this.debugWnd.innerHTML += ' N:' + N;
            this.debugWnd.innerHTML += ' V:' + V;
            this.debugWnd.innerHTML += ' B:' + B;
            this.debugWnd.innerHTML += ' D:' + D;
            this.debugWnd.innerHTML += ' I:' + I;
            this.debugWnd.innerHTML += ' Z:' + Z;
            this.debugWnd.innerHTML += ' C:' + C;
            this.debugWnd.innerHTML += '\n';
        };
        //private Draw8x8(canvasContext, gridX: number, gridY: number, patternBytes: number[], attrib: number) {
        //    var canvasData = canvasContext.getImageData(0, 0, 256, 256);
        //    var imageData = canvasData.data;
        //    var attribValue = attrib == undefined ? 0 : (attrib << 2);
        //    for (var row = 0; row < 8; row++) {
        //        for (var col = 7; col >= 0; col--) {
        //            var firstBit: number = ((patternBytes[row] >> col) & 0x01) == 0x01 ? 1 : 0;
        //            var secondBit: number = ((patternBytes[row + 8] >> col) & 0x01) == 0x01 ? 1 : 0;
        //            var colorVal: number = firstBit + (secondBit << 1);
        //            var rawColorVal: number = this.machine.ppu.imgPalette[colorVal + attribValue];
        //            var x = gridX * 8 + (7 - col);
        //            var y = gridY * 8 + row;
        //            imageData[(y * 256 + x) * 4] = rawColorVal & 0xff;
        //            imageData[(y * 256 + x) * 4 + 1] = (rawColorVal >> 8) & 0xff;
        //            imageData[(y * 256 + x) * 4 + 2] = (rawColorVal >> 16) & 0xff;
        //        }
        //    }
        //    canvasContext.putImageData(canvasData, 0, 0);
        //}
        //public DrawNametable(canvasID: string, patterntableStartAddr: number, nametableStartAddr: number) {
        //    var screen = <HTMLCanvasElement>document.getElementById(canvasID);
        //    var canvasContext = screen.getContext('2d');
        //    //canvasContext.fillStyle = 'black';
        //    var r = this.machine.ppu.imgPalette[0] & 0xff;
        //    var g = (this.machine.ppu.imgPalette[0] >> 8) & 0xff;
        //    var b = (this.machine.ppu.imgPalette[0] >> 16) & 0xff;
        //    canvasContext.fillStyle = "rgb(" + r + "," + g + "," + b + ")";
        //    // set alpha to opaque
        //    canvasContext.fillRect(0, 0, 256, 240);
        //    var canvasImageData = canvasContext.getImageData(0, 0, 256, 240);
        //    // Set alpha
        //    for (var i = 3; i < canvasImageData.data.length - 3; i += 4) {
        //        canvasImageData.data[i] = 0xFF;
        //    }
        //    for (var i = 0; i < 960; i++) {
        //        var tableValue = this.machine.ppu.vramMem[nametableStartAddr + i];
        //        //console.log(i.toString() + ":" + tableValue.toString());
        //        var tileStartAddr = patterntableStartAddr + tableValue * 16;
        //        var chars = [];
        //        for (var j = 0; j < 16; j++) {
        //            var num = this.machine.ppu.vramMem[tileStartAddr];
        //            tileStartAddr++;
        //            chars.push(num);
        //        }
        //        var attrByteIndex = Math.floor(i / 128) * 8 + Math.floor((i % 32) / 4);
        //        var attrByte = this.machine.ppu.vramMem[nametableStartAddr + 960 + attrByteIndex];
        //        var attrValue = (attrByte >> (((Math.floor((i % 128) / 64) << 1) | Math.floor((i % 4) / 2)) * 2)) & 0x3;
        //        this.Draw8x8(canvasContext, i % 32, Math.floor(i / 32), chars, attrValue);
        //    }
        //}
        Debugger.prototype.DrawPalette = function (canvasID) {
            var screen = document.getElementById(canvasID);
            var canvasContext = screen.getContext('2d');
            canvasContext.fillStyle = 'white';
            canvasContext.fillRect(0, 0, 256, 240);
            for (var i = 0; i < 16; i++) {
                var r = this.machine.ppu.palettes[0].RGBColors[i] & 0xff;
                var g = (this.machine.ppu.palettes[0].RGBColors[i] >> 8) & 0xff;
                var b = (this.machine.ppu.palettes[0].RGBColors[i] >> 16) & 0xff;
                //if (i % 4 == 0) {
                //    r = this.machine.ppu.palettes[0].RGBColors[i] & 0xff;
                //    g = (this.machine.ppu.palettes[0].RGBColors[i] >> 8) & 0xff;
                //    b = (this.machine.ppu.imgPalette[0] >> 16) & 0xff;
                //}
                canvasContext.fillStyle = "rgb(" + r + "," + g + "," + b + ")";
                canvasContext.fillRect(i * 16, 0, 16, 16);
            }
            for (var i = 0; i < 16; i++) {
                var r = this.machine.ppu.palettes[1].RGBColors[i] & 0xff;
                var g = (this.machine.ppu.palettes[1].RGBColors[i] >> 8) & 0xff;
                var b = (this.machine.ppu.palettes[1].RGBColors[i] >> 16) & 0xff;
                //if (i % 4 == 0) {
                //    r = this.machine.ppu.imgPalette[0] & 0xff;
                //    g = (this.machine.ppu.imgPalette[0] >> 8) & 0xff;
                //    b = (this.machine.ppu.imgPalette[0] >> 16) & 0xff;
                //}
                canvasContext.fillStyle = "rgb(" + r + "," + g + "," + b + ")";
                canvasContext.fillRect(i * 16, 16, 16, 16);
            }
        };
        Debugger.prototype.DrawNametableWithOffset = function (canvasID, x, y, fx, fy, nameTableIndex) {
            //var baseTile = this.machine.ppu.f_bgPatternTable ? 256 : 0;
            var baseTile = 256;
            //var nameTable = this.machine.ppu.nameTable;
            var nameTable = this.machine.ppu.nametables;
            var cntX = x;
            var cntY = y;
            var cntFx = fx;
            var cntFy = fy;
            var cntNameTableIndex = nameTableIndex;
            var buffer = new Array(256 * 240);
            for (var scanline = 0; scanline < 240; scanline++) {
                cntNameTableIndex = ((Math.floor(cntNameTableIndex / 2)) << 1) + (nameTableIndex % 2);
                for (var dot = 0; dot < 256; dot++) {
                    //var tile: Tile = this.machine.ppu.ptTile[baseTile + nameTable[this.machine.ppu.nametableMapper[cntNameTableIndex]].getTileIndex(cntX, cntY)];
                    var tile = this.machine.ppu.tiles[baseTile + nameTable[this.machine.ppu.getRealNametableNo(cntNameTableIndex)].getTileIndex(cntX, cntY)];
                    //buffer[scanline << 8 + dot] = tile[(scanline % 8) << 8 + (dot % 8)];
                    var dotLow2Bits = tile.pixels[(cntFy << 3) + cntFx];
                    //var dotHigh2Bits = nameTable[cntNameTableIndex].getAttrib(cntX, cntY);
                    var dotHigh2Bits = (this.machine.ppu.attrTables[this.machine.ppu.getRealNametableNo(cntNameTableIndex)].getAttr(cntX, cntY) << 2);
                    //var dotHigh2Bits = 0;
                    //buffer[(scanline << 8) + dot] = this.machine.ppu.imgPalette[dotHigh2Bits + dotLow2Bits];
                    buffer[(scanline << 8) + dot] = this.machine.ppu.palettes[0].RGBColors[dotHigh2Bits + dotLow2Bits];
                    cntFx++;
                    if (cntFx == 8) {
                        cntFx = 0;
                        cntX++;
                        if (cntX == 32) {
                            cntX = 0;
                            //if (dot < 255) {
                            cntNameTableIndex = ((Math.floor(cntNameTableIndex / 2)) << 1) + ((cntNameTableIndex + 1) % 2);
                        }
                    }
                }
                cntFy++;
                if (cntFy == 8) {
                    cntFy = 0;
                    cntY++;
                    if (cntY == 30) {
                        cntY = 0;
                        cntNameTableIndex = (cntNameTableIndex + 2) % 4;
                    }
                }
            }
            var screen = document.getElementById(canvasID);
            var canvasContext = screen.getContext('2d');
            var r = this.machine.ppu.palettes[0].RGBColors[0] & 0xff;
            var g = (this.machine.ppu.palettes[0].RGBColors[0] >> 8) & 0xff;
            var b = (this.machine.ppu.palettes[0].RGBColors[0] >> 16) & 0xff;
            canvasContext.fillStyle = "rgb(" + r + "," + g + "," + b + ")";
            // set alpha to opaque
            canvasContext.fillRect(0, 0, 256, 240);
            var canvasImageData = canvasContext.getImageData(0, 0, 256, 240);
            // Set alpha
            for (var i = 3; i < canvasImageData.data.length - 3; i += 4) {
                canvasImageData.data[i] = 0xFF;
            }
            for (var i = 0; i < 256 * 240; i++) {
                canvasImageData.data[i << 2] = buffer[i] & 0xff;
                canvasImageData.data[(i << 2) + 1] = (buffer[i] >> 8) & 0xff;
                canvasImageData.data[(i << 2) + 2] = (buffer[i] >> 16) & 0xff;
            }
            canvasContext.putImageData(canvasImageData, 0, 0);
        };
        Debugger.prototype.recordAPUDebuggingMsg = function (no, square1, square2, triangle, noise) {
            //var debugWnd = <HTMLTextAreaElement>document.getElementById("debugWnd");
            //this.debugWnd.innerHTML += no + '  ' + 'square1:' + square1 + ' ';
            //this.debugWnd.innerHTML += 'square2:' + square2 + ' ';
            //this.debugWnd.innerHTML += 'triangle:' + triangle + ' ';
            //this.debugWnd.innerHTML += 'noise:' + noise + ' ';
            //this.debugWnd.innerHTML += '<br/>';
            this.apuDbgInfo.push([no, square1, square2, triangle, noise]);
        };
        Debugger.prototype.printAPUDBGInfo = function () {
            var str = '';
            for (var i = 0; i < this.apuDbgInfo.length; i++) {
                str += this.apuDbgInfo[i][0] + ' ' + 'square1:' + this.apuDbgInfo[i][1] + ' ';
                str += 'square2:' + this.apuDbgInfo[i][2] + ' ';
                str += 'triangle:' + this.apuDbgInfo[i][3] + ' ';
                str += 'noise:' + this.apuDbgInfo[i][4] + ' ';
                str += '<br/>';
            }
            this.debugWnd.innerHTML = str;
            this.drawSoundWave();
        };
        Debugger.prototype.drawSoundWave = function () {
            //var arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
            var screen = document.getElementById('saveScreen');
            var canvasContext = screen.getContext('2d');
            canvasContext.fillStyle = 'black';
            for (var i = 0; i < 1024; i++) {
                canvasContext.fillRect(i, 239 - this.apuDbgInfo[i][4], 1, 1);
            }
        };
        return Debugger;
    })();
    NES.Debugger = Debugger;
})(NES || (NES = {}));
//# sourceMappingURL=Debugger.js.map