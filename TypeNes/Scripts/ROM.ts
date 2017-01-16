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

module NES {
    export enum MIRRORING_TYPE {
        VERTICAL_MIRRORING=0,
        HORIZONTAL_MIRRORING=1,
        FOURSCREEN_MIRRORING=2,
        SINGLESCREEN_MIRRORING=3,
        SINGLESCREEN_MIRRORING2=4,
        SINGLESCREEN_MIRRORING3=5,
        SINGLESCREEN_MIRRORING4=6,
        CHRROM_MIRRORING=7,
    };

    export class ROM {
        private machine: Machine;
        private mapperName: Array<string>;

        private header: Array<number>;
        public rom: Array<number>[];
        public vrom: Array<number>[];
        public vromTile: Tile[][];

        public romCount: number;
        public vromCount: number;
        private mirroring: MIRRORING_TYPE;
        public batteryRam: boolean;
        private trainer: boolean;
        private fourScreen: boolean;
        private mapperType: number;
        public valid: boolean;

        constructor(nesMachine: Machine) {
            this.machine = nesMachine;
            this.header = undefined;
            this.rom = undefined;
            this.vrom = undefined;
            this.vromTile = undefined;

            this.romCount = undefined;
            this.vromCount = undefined;
            this.mirroring = undefined;
            this.batteryRam = undefined;
            this.trainer = undefined;
            this.fourScreen = undefined;
            this.mapperType = undefined;
            this.valid = false;
        }

        public load(data: Array<number>) {
            var i, j, v;

            this.header = new Array(16);
            for (i = 0; i < 16; i++) {
                this.header[i] = data[i];
            }
            this.romCount = this.header[4];
            this.vromCount = this.header[5] * 2; // Get the number of 4kB banks, not 8kB
            this.mirroring = ((this.header[6] & 1) !== 0 ? 1 : 0);
            this.batteryRam = (this.header[6] & 2) !== 0;
            this.trainer = (this.header[6] & 4) !== 0;
            this.fourScreen = (this.header[6] & 8) !== 0;
            this.mapperType = (this.header[6] >> 4) | (this.header[7] & 0xF0);

            var foundError = false;
            for (i = 8; i < 16; i++) {
                if (this.header[i] !== 0) {
                    foundError = true;
                    break;
                }
            }
            if (foundError) {
                this.mapperType &= 0xF; // Ignore byte 7
            }
            // Load PRG-ROM banks:
            this.rom = new Array(this.romCount);
            var offset = 16;
            for (i = 0; i < this.romCount; i++) {
                this.rom[i] = new Array(16384);
                for (j = 0; j < 16384; j++) {
                    if (offset + j >= data.length) {
                        break;
                    }
                    //this.rom[i][j] = data.charCodeAt(offset + j) & 0xFF;
                    this.rom[i][j] = data[offset + j] & 0xFF;
                }
                offset += 16384;
            }
            // Load CHR-ROM banks:
            this.vrom = new Array(this.vromCount);
            for (i = 0; i < this.vromCount; i++) {
                this.vrom[i] = new Array(4096);
                for (j = 0; j < 4096; j++) {
                    if (offset + j >= data.length) {
                        break;
                    }
                    //this.vrom[i][j] = data.charCodeAt(offset + j) & 0xFF;
                    this.vrom[i][j] = data[offset + j] & 0xFF;
                }
                offset += 4096;
            }

            // Create VROM tiles:
            this.vromTile = new Array(this.vromCount);
            for (i = 0; i < this.vromCount; i++) {
                this.vromTile[i] = new Array(256);
                for (j = 0; j < 256; j++) {
                    this.vromTile[i][j] = new Tile();
                }
            }

            // Convert CHR-ROM banks to tiles:
            var tileIndex;
            var leftOver;
            for (v = 0; v < this.vromCount; v++) {
                for (i = 0; i < 4096; i++) {
                    tileIndex = i >> 4;
                    leftOver = i % 16;
                    if (leftOver < 8) {
                        this.vromTile[v][tileIndex].setScanline(
                            leftOver,
                            this.vrom[v][i],
                            this.vrom[v][i + 8]
                            );
                    }
                    else {
                        this.vromTile[v][tileIndex].setScanline(
                            leftOver - 8,
                            this.vrom[v][i - 8],
                            this.vrom[v][i]
                            );
                    }
                }
            }

            this.valid = true;
        }

        public getMirroringType(): MIRRORING_TYPE {
            if (this.fourScreen) {
                return MIRRORING_TYPE.FOURSCREEN_MIRRORING;
            }
            if (this.mirroring === 0) {
                return MIRRORING_TYPE.HORIZONTAL_MIRRORING;
            }
            return MIRRORING_TYPE.VERTICAL_MIRRORING;
        }

        public getMapperName(): string {
            if (this.mapperType >= 0 && this.mapperType < this.mapperName.length) {
                return this.mapperName[this.mapperType];
            }
            return "Unknown Mapper, " + this.mapperType;
        }

        public createMapper(): IMapper{
            switch (this.mapperType) {
                case 0:
                    return new Mapper0(this.machine);
                    break;
                case 1:
                    return new Mapper1(this.machine);
                    break;
                case 2:
                    return new Mapper2(this.machine);
                    break;
                case 4:
                    return new Mapper4(this.machine);
                    break;
                default:
                    return new Mapper0(this.machine);
            }
        }
    }
}