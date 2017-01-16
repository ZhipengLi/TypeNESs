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

// http://wiki.nesdev.com/w/index.php/APU

declare var webkitAudioContext: any;

module NES {
    class SquareChannel {
        private papu: PAPU;
        public isEnabled: boolean;
        public lengthCounter: number;
        public sweepTimer: number;

        private lengthCounterCycleCounter: number; // This will help determine if we want to deduct length counter
        private lengthCounterCycleCounterMax: number;

        // register 0x4000/0x4004
        private dutyMode: number;
        private lengthCounterEnalbled: boolean;
        private isConstantVolume: boolean;
        private volume: number;

        // register 0x4001/4005
        public sweepUnitEnabled: boolean;
        private sweepPeriod: number;
        private sweepMode: number;
        private sweepShift: number;


        // register 0x4002/4006
        private timer: number;

        // register 0x4003/4007
        private lengthCounterIndex: number;

        private dutyLookup: number[] = [
            0, 1, 0, 0, 0, 0, 0, 0,
            0, 1, 1, 0, 0, 0, 0, 0,
            0, 1, 1, 1, 1, 0, 0, 0,
            1, 0, 0, 1, 1, 1, 1, 1
        ];

        public dutyIndex: number;
        private wavePeriodLength: number;
        private waveStepLength: number;
        private cycleCounter: number;

        public currentOutput: number;

        constructor(papu: PAPU) {
            this.papu = papu;
            this.reset();
            this.lengthCounterCycleCounterMax = this.papu.machine.opt_CPU_FREQ_NTSC / 120;
        }

        public reset() {
            this.isEnabled = false;
            //this.lengthCounter = 0;
            this.dutyIndex = 0;
            this.timer = 0;
            this.cycleCounter = 0;
            this.sweepTimer = 0;

            //this.lengthCounterCycleCounter = 0;
            this.waveStepLength = 0;
            this.currentOutput = 0;

        }

        private updateWaveStatus() {
            this.wavePeriodLength = (this.timer + 1) * 16;// this.papu.machine.opt_CPU_FREQ_NTSC
            this.waveStepLength = this.wavePeriodLength / 8;
            this.dutyIndex = 0;
            this.cycleCounter = 0;
        }

        public addCycles(nCycles: number) {
            this.cycleCounter += nCycles;
            if (this.waveStepLength> 0 && this.cycleCounter >= this.waveStepLength) {
                this.dutyIndex = (this.dutyIndex + 1) % 8;
                this.cycleCounter = this.cycleCounter - this.waveStepLength;
                if (this.timer >= 8 && this.isEnabled && this.lengthCounter > 0) {
                    this.currentOutput = this.dutyLookup[(this.dutyMode << 3) + this.dutyIndex] * this.volume;
                }
                else {
                    this.currentOutput = 0;
                }
            }
        }

        // Length counter is centrally controlled by a 240HZ timer in apu
        public lengthCounterDeduct(): void {
            if (this.lengthCounter > 0) {
                this.lengthCounter--;
            }
        }

        public sweep(): void {
            this.sweepTimer++;
            if (this.sweepTimer >= this.sweepPeriod) {
                this.sweepTimer = 0;
                if (this.sweepShift > 0 && this.timer > 7){
                    if (this.sweepMode == 0) {
                        this.timer += (this.timer >> this.sweepShift);
                        if (this.timer > 4095) {
                            this.timer = 4095;
                        }
                    } else {
                        this.timer -= (this.timer >> this.sweepShift);
                    }
                }
                this.updateWaveStatus();
            }
        }

        public writeRegister(regNum: number, val: number) {
            switch (regNum) {
                case 0:
                    {
                        this.dutyMode = (val>>6);
                        this.lengthCounterEnalbled = (val&0x20)==0;
                        this.isConstantVolume = (val&0x10) !=0;
                        this.volume = val&0xf;
                    }
                    break;
                case 1:
                    {
                        this.sweepUnitEnabled = (val & 0x80) != 0;
                        this.sweepPeriod = (val & 0x70) >> 4;
                        this.sweepMode = (val & 0x08) >> 3;
                        this.sweepShift = val & 0x7;

                        this.sweepTimer = 0;
                        //if (this.sweepUnitEnabled) {
                        //    alert("sweep unit enabled!");
                        //}
                    }
                    break;
                case 2:
                    {
                        this.timer = this.timer & 0x700;
                        this.timer = this.timer | val;
                        this.updateWaveStatus();
                    }
                    break;
                case 3:
                    {
                        this.timer = this.timer & 0x0ff;
                        this.timer = this.timer | ((val & 7) << 8);
                        this.lengthCounter = this.papu.lengthCounterLookup[(val & 0xf8) >> 3];
                        this.updateWaveStatus();
                    }
                    break;
                default:
                    {
                        alert("illegal regNum writing to Squarechannel " + regNum);
                    }
            }
        }
    }

    class TriangleChannel {
        private papu: PAPU;

        public cycleCounter: number;
        public stepIndex: number;
        public currentOutput: number;

        public isEnabled: boolean;
        public linearCounter: number;

        public timer: number;

        // register:
        // 0x4008:
        private isLinearCounterHalt: boolean;
        private linearCounterReloadValue: number;

        // 0x400a:
        private timerLow: number;
        
        // 0x400b:
        public lengthCounter: number;
        private timerHigh: number;
        

        constructor(papu: PAPU) {
            this.papu = papu;
            this.isEnabled = false;
            this.lengthCounter = 0;
            this.linearCounter = 0;
            this.timerLow = 0;
            this.timerHigh = 0;
            this.timer = 0;
            this.isLinearCounterHalt = true;
            this.cycleCounter = 0;
            this.stepIndex = 0;
            this.currentOutput = 0;
        }

        public writeRegister(addr: number, val: number) {
            switch (addr) {
                case 0x4008:
                    //this.isLinearCounterHalt = (val & 0x80) == 0 ? true : false;

                    this.linearCounterReloadValue = val & 0x7f;
                    if ((val & 0x80) == 0) {
                        this.linearCounter = this.linearCounterReloadValue;
                    }
                        break;
                case 0x400a:
                    this.timer = this.timer & 0x700;
                    this.timer = this.timer | val;
                    break;
                case 0x400b:
                    this.timer = this.timer & 0xff;
                    this.timer = this.timer | ((val & 7) << 8);
                    this.lengthCounter = this.papu.lengthCounterLookup[(val & 0xf8) >> 3];
                    //this.isLinearCounterHalt = true;
                    this.linearCounter = this.linearCounterReloadValue;
                    break;
            }
        }

        public lengthCounterDeduct() {
            this.lengthCounter--;
            if (this.lengthCounter == 0)
                this.currentOutput = 0;
        }

        public linearCounterDeduct() {
            this.linearCounter--;
            if (this.linearCounter == 0)
                this.currentOutput = 0;
        }

    }

    class NoiseChannel {
        private papu: PAPU;
        public isEnabled: boolean;
        //public lengthCounter: number;
        private noiseWaveLengthLookup: number[] = [0x4, 0x8, 0x10, 0x20, 0x40, 0x60, 0x80, 0xa,
                                                0xca, 0xfe, 0x17c, 0x1fc, 0x2fa, 0x3f8,0x7f2,0xfe4];

        public cycleCounter: number;
        public currentOutput: number;

        constructor(papu: PAPU) {
            this.papu = papu;
            this.isEnabled = false;
            this.lengthCounter = 0;
            this.cycleCounter = 0;
            this.currentOutput = 0;

            this.isLengthCounterHalt = true;
            this.isConstantVolume = true;
            this.volume = 0;
            this.isNoiseLoop = false;
            this.noisePeriodInCycle = 0;
        }

        // 0x400C
        private isLengthCounterHalt: boolean;
        private isConstantVolume: boolean;
        private volume: number;
        //private volume: number;

        // 0x400E
        private isNoiseLoop: boolean;
        public noisePeriodInCycle: number;

        // 0x400F
        public lengthCounter: number;

        public updateCurrentOutput() {
            this.currentOutput = (Math.random() > 0.5 ? 1 : 0) * this.volume;
        }

        public lengthCounterDeduct(): void {
            this.lengthCounter--;
            if (this.lengthCounter == 0)
                this.currentOutput = 0;
        }
        public writeRegister(addr: number, val: number) {
            switch (addr) {
                case 0x400c:
                    this.isLengthCounterHalt = (val & 0x20) == 0;
                    this.isConstantVolume = (val & 0x10) != 0;
                    //if (!this.isConstantVolume) {
                    //    alert("not constant volume");
                    //}

                    this.volume = val & 0xf;
                    break;
                case 0x400e:
                    this.isNoiseLoop = (val & 0x80) != 0;
                    this.noisePeriodInCycle = this.noiseWaveLengthLookup[val & 0xf];
                    break;
                case 0x400f:
                    this.lengthCounter = (val & 0xf8) >> 3;
                    break;
            }
        }
    }

    class DMCChannel {
        private papu: PAPU;
        public isEnabled: boolean;
        public cycleCounter: number;
        private bitIndex: number;
        private currentByte: number;
        //public lengthCounter: number;
        private dmcWaveLengthLookup: number[] = [428, 380, 340, 320, 286, 254, 226, 214, 190, 160, 142, 128, 106, 84, 72, 54];

        // 0x4010:
        public isIRQEnabled: boolean;
        private isLoop: boolean;
        public dmcPeriodInCycle: number;

        // 0x4011:
        private deltaCounter: number;
        private dacLsb: number;
        private currentOutput: number;

        // 0x4012:
        private dmcStartAddress: number;
        private currentAddr: number;
        
        // 0x4013:
        public sampleLengthInByte: number;
        public currentLength: number;

        public dmcRestart() {
            this.currentAddr = this.dmcStartAddress;
            this.currentLength = 0;
            this.isIRQEnabled = false;
        }
        constructor(papu: PAPU) {
            this.papu = papu;
            this.isEnabled = false;
            //this.lengthCounter = 0;
            this.isLoop = false;
            this.dmcPeriodInCycle = 0;
            this.deltaCounter = 0;
            this.dacLsb = 0;
            this.currentOutput = 0;
            this.dmcStartAddress = 0;
            this.currentAddr = 0;
            this.sampleLengthInByte = 0;
            this.currentLength = 0;
            this.cycleCounter = 0;
            this.bitIndex = 0;
        }

        public writeRegister(addr: number, val: number) {
            switch (addr) {
                case 0x4010:
                    this.isIRQEnabled = (val & 0x80) != 0;
                    this.isLoop = (val & 0x40) != 0;
                    this.dmcPeriodInCycle = this.dmcWaveLengthLookup[val & 0xf];
                    break;
                case 0x4011:
                    this.deltaCounter = (val >> 1) & 0x3f;
                    this.dacLsb = val & 1;
                    this.currentOutput = val & 0x7f;
                    break;
                case 0x4012:
                    this.dmcStartAddress = (val << 6) + 0xc000;
                    this.currentAddr = this.dmcStartAddress;
                    break;
                case 0x4013:
                    this.sampleLengthInByte = (val << 4) + 1;
                    this.currentLength = 0;
                    break;
            }
        }

        public updateCurrentValue() {
            if (((this.currentByte >> (7 - this.bitIndex)) & 1) > 0) {
                if (this.currentOutput > 0) {
                    this.deltaCounter--;
                } else if (this.deltaCounter < 63) {
                    this.deltaCounter++;
                }
                this.currentOutput = this.isEnabled ? (this.deltaCounter << 1) + this.dacLsb : 0;
            }
            this.bitIndex++;
            if (this.bitIndex > 7) {
                this.bitIndex = 0;
                this.currentLength++;
                this.currentAddr++;
                if (this.currentLength < this.sampleLengthInByte)
                    this.currentByte = this.papu.machine.mmap.regLoad(this.currentAddr);
                else {
                    this.currentOutput = 0;
                }
            }
        }
    }

    export class PAPU {
        private totalCycles: number = 0;
        private bufferSize: number = 8192*2;
        private lastPlayTime: number = 0;
        private bufferPlayTime: number;// = this.bufferSize * 1000.0 / this.machine.opt_sampleRate;
        public machine: Machine;
        private square1: SquareChannel;
        private square2: SquareChannel;
        private noise: NoiseChannel;
        private triangle: TriangleChannel;
        private dmc: DMCChannel;
        public audioContext: AudioContext;// = new AudioContext();//(window.AudioContext || window.webkitAudioContext)();
        public audioContext1: AudioContext;
        public audioBuffer: AudioBuffer;
        public audioBuffer1: AudioBuffer;
        private audioBufferArray: Float32Array;
        private audioBufferArray1: Float32Array;

        private audioBufferArrayIndex: number;
        private audioBufferArrayIndex1: number;

        public lengthCounterLookup: number[] = [
            0x0A, 0xFE,
            0x14, 0x02,
            0x28, 0x04,
            0x50, 0x06,
            0xA0, 0x08,
            0x3C, 0x0A,
            0x0E, 0x0C,
            0x1A, 0x0E,
            0x0C, 0x10,
            0x18, 0x12,
            0x30, 0x14,
            0x60, 0x16,
            0xC0, 0x18,
            0x48, 0x1A,
            0x10, 0x1C,
            0x20, 0x1E
        ];
        private SAMPLING_CYCLES: number;
        private apuCycleCounter: number;

        // register $4017
        private frameCounterMode: number;
        private frameCounterIRQInibit: number;
        private frameCounterTickSequenceLength: number = 4;
        private frameCounterTickLengthInCycles: number;
        private frameCounterTickCycleCounter: number;
        private frameCounterTickStep: number = 0; //ranging from 0-3 or 0-4, depending on the frameCounterMode

        constructor(machine: Machine) {
            this.machine = machine;
            this.square1 = new SquareChannel(this);
            this.square2 = new SquareChannel(this);
            this.noise = new NoiseChannel(this);
            this.triangle = new TriangleChannel(this);
            this.dmc = new DMCChannel(this);

            this.SAMPLING_CYCLES = this.machine.opt_CPU_FREQ_NTSC / this.machine.opt_sampleRate; //1789773/44100 = 40.5844 cycles
            this.frameCounterTickLengthInCycles = this.machine.opt_CPU_FREQ_NTSC / 240; // APU runs at 240Hz
            this.apuCycleCounter = 0;
            this.bufferPlayTime =  this.bufferSize * 1000.0 / this.machine.opt_sampleRate;
            this.reset();
        }

        public reset() {
            if ((!this.machine.opt_isIE) && (!this.machine.opt_isSafari)) {
                this.audioContext = new (AudioContext || webkitAudioContext)();
                this.audioBuffer = this.audioContext.createBuffer(1, this.bufferSize, this.machine.opt_sampleRate);
                this.audioBufferArrayIndex = 0;

                this.audioContext1 = new AudioContext();
                this.audioBuffer1 = this.audioContext.createBuffer(1, this.bufferSize, this.machine.opt_sampleRate);
                this.audioBufferArrayIndex1 = 0;
            }
            this.frameCounterTickCycleCounter = 0;
            this.frameCounterTickStep = 0;
        }

        public addCycles(cpuCycles: number) {
            this.totalCycles += cpuCycles;
            this.apuCycleCounter += cpuCycles;
            if (this.apuCycleCounter >= this.SAMPLING_CYCLES) {
                this.apuCycleCounter -= this.SAMPLING_CYCLES;
                this.sample(cpuCycles);
            }

            this.frameCounterTickCycleCounter += cpuCycles;
            if (this.frameCounterTickCycleCounter >= this.frameCounterTickLengthInCycles) {
                this.frameCounterTickCycleCounter -= this.frameCounterTickLengthInCycles;
                this.frameCounterTick();
            }

            this.square1.addCycles(cpuCycles);
            this.square2.addCycles(cpuCycles);

            if (this.triangle.isEnabled && this.triangle.lengthCounter > 0 && this.triangle.linearCounter > 0 && this.triangle.timer > 0) {
                this.triangle.cycleCounter += cpuCycles;
                if (this.triangle.cycleCounter >= this.triangle.timer) {
                    this.triangle.cycleCounter -= this.triangle.timer;
                    this.triangle.stepIndex = (this.triangle.stepIndex + 1) & 0x1f;
                    this.triangle.currentOutput = this.triangle.stepIndex > 15 ? (32 - this.triangle.stepIndex) : this.triangle.stepIndex;
                }
            } //else {
              //  this.triangle.currentOutput = 0;
            //}

            if (this.noise.isEnabled && this.noise.lengthCounter > 0 && this.noise.noisePeriodInCycle) {
                this.noise.cycleCounter += cpuCycles;
                if (this.noise.cycleCounter >= this.noise.noisePeriodInCycle) {
                    this.noise.cycleCounter -= this.noise.noisePeriodInCycle;
                    this.noise.updateCurrentOutput();
                }
            }
            if (this.dmc.isEnabled && this.dmc.currentLength < this.dmc.sampleLengthInByte) {
                this.dmc.cycleCounter += cpuCycles;
                if (this.dmc.dmcPeriodInCycle > 0 && this.dmc.cycleCounter >= this.dmc.dmcPeriodInCycle) {
                    this.dmc.cycleCounter -= this.dmc.dmcPeriodInCycle;
                    this.dmc.updateCurrentValue();
                }
            }
        }

        public readReg(addr: number): number {
            switch (addr) {
                case 0x4015:
                    {
                        return ((this.dmc.isEnabled ? 1 : 0) << 4) |
                            ((this.noise.isEnabled ? 1 : 0) << 3) |
                            ((this.triangle.isEnabled ? 1 : 0) << 2) |
                            ((this.square2.isEnabled ? 1 : 0) << 1) |
                            (this.square1.isEnabled ? 1 : 0);
                    }
                    break;
                case 0x4017:
                    return (this.frameCounterMode << 7) | (this.frameCounterIRQInibit << 6);
                    break;
                default:
                    alert("invalid reading in papu:" + addr);
                    break;
            }
        }

        public writeReg(addr: number, val: number) {
            switch (addr) {
                case 0x4000:
                    this.square1.writeRegister(0, val);
                    break;
                case 0x4001:
                    this.square1.writeRegister(1, val);
                    break;
                case 0x4002:
                    this.square1.writeRegister(2, val);
                    break;
                case 0x4003:
                    this.square1.writeRegister(3, val);
                    break;
                case 0x4004:
                    this.square2.writeRegister(0, val);
                    break;
                case 0x4005:
                    this.square2.writeRegister(1, val);
                    break;
                case 0x4006:
                    this.square2.writeRegister(2, val);
                    break;
                case 0x4007:
                    this.square2.writeRegister(3, val);
                    break;
                case 0x4008:
                    this.triangle.writeRegister(addr, val);
                    break;
                case 0x4009:
                case 0x400a:
                    this.triangle.writeRegister(addr, val);
                    break;
                case 0x400b:
                    this.triangle.writeRegister(addr, val);
                    break;
                case 0x400c:
                    this.noise.writeRegister(addr, val);
                    break;
                case 0x400d:
                case 0x400e:
                    this.noise.writeRegister(addr, val);
                    break;
                case 0x400f:
                    this.noise.writeRegister(addr, val);
                    break;
                case 0x4010:
                case 0x4011:
                case 0x4012:
                case 0x4013:
                case 0x4014:
                    break;
                case 0x4015:
                    this.updateChannelStatus0x4015(val);
                    break;
                case 0x4017:
                    this.frameCounterMode = (val >> 7);
                    this.frameCounterIRQInibit = (val >> 6) & 1;
                    this.frameCounterTickSequenceLength = this.frameCounterMode == 1 ? 5 : 4;

                    break;
                default:
                    alert("invalid writing in papu:" + addr);
                    break;
            }
        }

        private sample(nCycles: number): void {
            var output = 0.00752 * (this.square1.currentOutput + this.square2.currentOutput) + 0.00851 * this.triangle.currentOutput
                    + 0.00494 * this.noise.currentOutput;
            this.sendToSource(output);
        }

        private updateChannelStatus0x4015(val: number):void {
            if ((val & 0x10) == 0) {
                this.dmc.isEnabled = false;
                //this.dmc.lengthCounter = 0;
            } else {
                this.dmc.isEnabled = true;
                this.dmc.dmcRestart();
            }

            if ((val & 0x8) == 0) {
                this.noise.isEnabled = false;
                this.noise.lengthCounter = 0;
            } else {
                this.noise.isEnabled = true;
            }

            if ((val & 0x4) == 0) {
                this.triangle.isEnabled = false;
                this.triangle.lengthCounter = 0;
            } else {
                this.triangle.isEnabled = true;
            }

            if ((val & 0x2) == 0) {
                this.square2.isEnabled = false;
                this.square2.lengthCounter = 0;
            } else {
                this.square2.isEnabled = true;
            }
            if ((val & 0x1) == 0) {
                this.square1.isEnabled = false;
                this.square1.lengthCounter = 0;
            } else {
                this.square1.isEnabled = true;
            }
        }

        private frameCounterTick(): void {
            if (this.frameCounterTickStep == 0 || this.frameCounterTickStep == 2) {
                this.square1.lengthCounterDeduct();
                this.square2.lengthCounterDeduct();
                if (this.square1.sweepUnitEnabled) {
                    this.square1.sweep();
                }
                if (this.square1.sweepUnitEnabled) {
                    this.square2.sweep();
                }

                if (this.triangle.lengthCounter > 0) {
                    this.triangle.lengthCounterDeduct();
                }

                if (this.noise.lengthCounter > 0) {
                    this.noise.lengthCounterDeduct();
                }
            }

            if (this.frameCounterTickStep <= 4) {
                if (this.triangle.linearCounter > 0) {
                    this.triangle.linearCounterDeduct();
                }
            }
            this.frameCounterTickStep++;
            this.frameCounterTickStep = this.frameCounterTickStep % this.frameCounterTickSequenceLength;
        }

        private noteStartPos: number = -1;
        private toPlay: boolean = false;
        private sendToSource(val: number): void {
            if ((!this.machine.opt_isIE) && (!this.machine.opt_isSafari)) {
                if (this.toPlay) {
                    if (this.noteStartPos == -1 && val != 0) {
                        this.noteStartPos = this.audioBufferArrayIndex;
                    }

                    this.audioBufferArray = this.audioBuffer.getChannelData(0);
                    if ((this.noteStartPos != -1)
                        && (this.audioBufferArrayIndex < (this.bufferSize - 1000))
                        && ((this.audioBufferArrayIndex - this.noteStartPos) < 1000)
                        ) {
                        val = val * (this.audioBufferArrayIndex - this.noteStartPos) * 1.0 / 1000;
                    }

                    this.audioBufferArray[this.audioBufferArrayIndex] = val;
                    this.audioBufferArrayIndex++;
                    if (this.audioBufferArrayIndex == this.bufferSize) {
                        this.toPlay = !this.toPlay;

                        var noteEndPos = this.bufferSize - 1;
                        while (noteEndPos > 0) {
                            if (this.audioBufferArray[noteEndPos] != 0)
                                break;
                            noteEndPos--;
                        }

                        if (noteEndPos > 0) {
                            var backLength = Math.min(1000, noteEndPos - 0);
                            for (var i = noteEndPos; i >= noteEndPos - backLength; i--) {
                                this.audioBufferArray[i] *= (i - noteEndPos + backLength) * 1.0 / backLength;
                            }
                        }


                        this.audioBufferArrayIndex = 0;
                        this.noteStartPos = -1;
                        var currentTime = Date.now();
                        var delta = currentTime - this.lastPlayTime;
                        this.lastPlayTime = currentTime;
                        var apu = this;

                        //this.playMusic();
                        if (delta >= this.bufferPlayTime) {
                            apu.playMusic();
                        } else {
                            setTimeout(function () { apu.playMusic() }, this.bufferPlayTime - delta);
                        }
                    }
                }
                else {
                    if (this.noteStartPos == -1 && val != 0) {
                        this.noteStartPos = this.audioBufferArrayIndex1;
                    }

                    this.audioBufferArray1 = this.audioBuffer1.getChannelData(0);
                    if ((this.noteStartPos != -1)
                        && (this.audioBufferArrayIndex1 < (this.bufferSize - 1000))
                        && ((this.audioBufferArrayIndex1 - this.noteStartPos) < 1000)
                        ) {
                        val = val * (this.audioBufferArrayIndex1 - this.noteStartPos) * 1.0 / 1000;
                    }

                    this.audioBufferArray1[this.audioBufferArrayIndex1] = val;
                    this.audioBufferArrayIndex1++;
                    if (this.audioBufferArrayIndex1 == this.bufferSize) {
                        this.toPlay = !this.toPlay;
                        var noteEndPos = this.bufferSize - 1;
                        while (noteEndPos > 0) {
                            if (this.audioBufferArray1[noteEndPos] != 0)
                                break;
                            noteEndPos--;
                        }

                        if (noteEndPos > 0) {
                            var backLength = Math.min(1000, noteEndPos - 0);
                            for (var i = noteEndPos; i >= noteEndPos - backLength; i--) {
                                this.audioBufferArray1[i] *= (i - noteEndPos + backLength) * 1.0 / backLength;
                            }
                        }


                        this.audioBufferArrayIndex1 = 0;
                        this.noteStartPos = -1;
                        var currentTime = Date.now();
                        var delta = currentTime - this.lastPlayTime;
                        this.lastPlayTime = currentTime;
                        var apu = this;

                        if (delta >= this.bufferPlayTime) {
                            apu.playMusic1();
                        } else {
                            setTimeout(function () { apu.playMusic1() }, this.bufferPlayTime - delta);
                        }
                    }
                }
            }
        }

        private playMusic() {
            var source: AudioBufferSourceNode = this.audioContext.createBufferSource();
            // set the buffer in the AudioBufferSourceNode
            source.buffer = this.audioBuffer;
            // connect the AudioBufferSourceNode to the
            // destination so we can hear the sound
            source.connect(this.audioContext.destination);
            // start the source playing
            source.start();
        }

        private playMusic1() {
            var source: AudioBufferSourceNode = this.audioContext1.createBufferSource();
            // set the buffer in the AudioBufferSourceNode
            source.buffer = this.audioBuffer1;
            // connect the AudioBufferSourceNode to the
            // destination so we can hear the sound
            source.connect(this.audioContext1.destination);
            // start the source playing
            source.start();
        }
    }
}