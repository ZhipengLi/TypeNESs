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
    export class Machine {
        public mmap: IMapper;
        public crashMessage: string;
        public Stop() { }
        public cpu: CPU;
        public ppu: PPU;
        public papu: PAPU;
        public keyboard: Keyboard;
        public rom: ROM;
        public ui: UI;
        public debugger: Debugger;

        public opt_preferredFrameRate: number = 60;
        public opt_fpsInterval: number = 500;            //Time between updating FPS in ms
        public opt_showDisplay: boolean = true;
        public opt_emulateSound: boolean = true;
        public opt_sampleRate: number = 44100;             //Sound sample rate in hz
        public opt_CPU_FREQ_NTSC: number = 1789772.5;
        public opt_CPU_FREQ_PAL: number = 1773447.4;
        public opt_isIE: boolean = false;
        public opt_isSafari: boolean = false;

        private isRunning: boolean;
        private fpsFrameCount: number;
        private limitFrames: boolean;
        private romData: number[];
        private frameInterval: number;
        private fpsInterval: number;
        private frameTime: number;
        private lastFrameTime: number;
        private lastFpsTime: number;
        // Frame begin time is used to control the frame rate in 
        private frameBeginTime: number;

        public drawScreen: boolean;

        constructor() {
            var ua = window.navigator.userAgent.toLowerCase();
            var msie = ua.indexOf("msie ");
            if (msie > 0 || !!navigator.userAgent.match(/Trident.*rv\:11\./)) 
                this.opt_isIE = true;

            if (ua.indexOf('safari') != -1) {
                if (ua.indexOf('chrome') > -1) {
                    this.opt_isSafari = false; // Chrome
                } else {
                    this.opt_isSafari = true; // Safari
                    }
                }

            this.isRunning = false;
            this.fpsFrameCount = 0;
            this.limitFrames = true;
            this.romData = undefined;

            this.frameTime = 1000 / this.opt_preferredFrameRate;
            this.ui = new UI(this);
            this.cpu = new CPU(this);
            this.ppu = new PPU(this);
            //this.papu = new PAPU(this);
            this.papu = new PAPU(this);
            this.mmap = null; // set in loadRom()
            this.keyboard = new Keyboard();
            this.debugger = new Debugger(this);
            this.drawScreen = true;

            this.ui.updateStatus("Ready to load a ROM.");
        }

        // Resets the system
        public reset() {
            if (this.mmap !== null) {
                this.mmap.reset();
            }

            this.cpu.reset();
            this.ppu.reset();
            this.papu.reset();
        }

        public start(): void{
            var self = this;
            if (this.rom !== null && this.rom.valid) {
                if (!this.isRunning) {
                    this.isRunning = true;

                    //this.frameInterval = setInterval(function () {
                    //                            self.frame();
                    //                        }, self.frameTime);
                    this.frame(true);

                    this.resetFps();
                    this.printFps();
                    this.fpsInterval = setInterval(function () {
                                            self.printFps();
                                            }, self.opt_fpsInterval);
                }
            }
            else {
                this.ui.updateStatus("There is no ROM loaded, or it is invalid.");
            }
        }

        private frame(draw: boolean) {
            this.drawScreen = draw;
            var self = this;

            this.frameBeginTime = +new Date();

            this.ppu.drawFullScreenBg();
            var cycles = 0;
            var emulateSound = this.opt_emulateSound;
            var cpu = this.cpu;
            var ppu = this.ppu;
            var papu = this.papu;
            FRAMELOOP: for (; ;) {
                if (cpu.haltCycles === 0) {

                    // Execute a CPU instruction
                    cycles = cpu.step();
                    if (cycles == -1)
                        return;
                    if (emulateSound) {
                        papu.addCycles(cycles);
                    }
                    cycles *= 3;                        // for NTSC, PPU is 5.37MHz, and CPU is 1.79MHz, 3 times speed of CPU.
                }
                else {
                    if (cpu.haltCycles > 8) {
                        cycles = 24;
                        if (emulateSound) {
                            papu.addCycles(8);
                        }
                        cpu.haltCycles -= 8;
                    }
                    else {
                        cycles = cpu.haltCycles * 3;
                        if (emulateSound) {
                            papu.addCycles(cpu.haltCycles);
                        }
                        cpu.haltCycles = 0;
                    }
                }

                if (ppu.incrementCycle(cycles)) {
                    break FRAMELOOP;
                }
            }

            this.fpsFrameCount++;
            this.lastFrameTime = +new Date();

            var current = +new Date();
            var dt = current - this.frameBeginTime;
            if (dt >= 1000 / this.opt_preferredFrameRate) {
                setTimeout(function () { self.frame(false); });
            } else {
                setTimeout(function () { self.frame(true); }, 1000 / this.opt_preferredFrameRate - dt);
            }
        }

        private printFps() {
            var now = +new Date();
            var s = 'Running';
            if (this.lastFpsTime) {
                s += ': ' + (
                    this.fpsFrameCount / ((now - this.lastFpsTime) / 1000)
                    ).toFixed(2) + ' FPS';
            }
            this.ui.updateStatus(s);
            this.fpsFrameCount = 0;
            this.lastFpsTime = now;
        }

        private stop() {
            clearInterval(this.frameInterval);
            clearInterval(this.fpsInterval);
            this.isRunning = false;
        }

        private reloadRom(): void {
            if (this.romData !== null) {
                this.loadRom(this.romData);
            }
        }

        // Loads a ROM file into the CPU and PPU.
        // The ROM file is validated first.
        public loadRom(data: number[]): boolean {
            if (this.isRunning) {
                this.stop();
            }

            this.ui.updateStatus("Loading ROM...");

            // Load ROM file:
            this.rom = new ROM(this);
            this.rom.load(data);

            if (this.rom.valid) {
                this.reset();
                this.mmap = this.rom.createMapper();
                if (!this.mmap) {
                    return;
                }
                this.mmap.loadROM();
                this.ppu.setMirroringType(this.rom.getMirroringType());
                this.romData = data;

                this.ui.updateStatus("Successfully loaded. Ready to be started.");
            }
            else {
                this.ui.updateStatus("Invalid ROM!");
            }
            return this.rom.valid;
        }

        public resetFps() {
            this.lastFpsTime = null;
            this.fpsFrameCount = 0;
        }
    }
}
