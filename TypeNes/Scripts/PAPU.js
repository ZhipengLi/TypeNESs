// http://wiki.nesdev.com/w/index.php/APU
var NES;
(function (NES) {
    var SquareChannel = (function () {
        function SquareChannel(papu) {
            this.dutyLookup = [
                0, 1, 0, 0, 0, 0, 0, 0,
                0, 1, 1, 0, 0, 0, 0, 0,
                0, 1, 1, 1, 1, 0, 0, 0,
                1, 0, 0, 1, 1, 1, 1, 1
            ];
            this.papu = papu;
            this.reset();
            this.lengthCounterCycleCounterMax = this.papu.machine.opt_CPU_FREQ_NTSC / 120;
        }
        SquareChannel.prototype.reset = function () {
            this.isEnabled = false;
            //this.lengthCounter = 0;
            this.dutyIndex = 0;
            this.timer = 0;
            this.cycleCounter = 0;
            this.sweepTimer = 0;
            //this.lengthCounterCycleCounter = 0;
            this.waveStepLength = 0;
            this.currentOutput = 0;
        };
        SquareChannel.prototype.updateWaveStatus = function () {
            this.wavePeriodLength = (this.timer + 1) * 16; // this.papu.machine.opt_CPU_FREQ_NTSC
            this.waveStepLength = this.wavePeriodLength / 8;
            this.dutyIndex = 0;
            this.cycleCounter = 0;
        };
        SquareChannel.prototype.addCycles = function (nCycles) {
            this.cycleCounter += nCycles;
            if (this.waveStepLength > 0 && this.cycleCounter >= this.waveStepLength) {
                this.dutyIndex = (this.dutyIndex + 1) % 8;
                this.cycleCounter = this.cycleCounter - this.waveStepLength;
                if (this.timer >= 8 && this.isEnabled && this.lengthCounter > 0) {
                    this.currentOutput = this.dutyLookup[(this.dutyMode << 3) + this.dutyIndex] * this.volume;
                }
                else {
                    this.currentOutput = 0;
                }
            }
        };
        // Length counter is centrally controlled by a 240HZ timer in apu
        SquareChannel.prototype.lengthCounterDeduct = function () {
            if (this.lengthCounter > 0) {
                this.lengthCounter--;
            }
        };
        SquareChannel.prototype.sweep = function () {
            this.sweepTimer++;
            if (this.sweepTimer >= this.sweepPeriod) {
                this.sweepTimer = 0;
                if (this.sweepShift > 0 && this.timer > 7) {
                    if (this.sweepMode == 0) {
                        this.timer += (this.timer >> this.sweepShift);
                        if (this.timer > 4095) {
                            this.timer = 4095;
                        }
                    }
                    else {
                        this.timer -= (this.timer >> this.sweepShift);
                    }
                }
                this.updateWaveStatus();
            }
        };
        SquareChannel.prototype.writeRegister = function (regNum, val) {
            switch (regNum) {
                case 0:
                    {
                        this.dutyMode = (val >> 6);
                        this.lengthCounterEnalbled = (val & 0x20) == 0;
                        this.isConstantVolume = (val & 0x10) != 0;
                        this.volume = val & 0xf;
                    }
                    break;
                case 1:
                    {
                        this.sweepUnitEnabled = (val & 0x80) != 0;
                        this.sweepPeriod = (val & 0x70) >> 4;
                        this.sweepMode = (val & 0x08) >> 3;
                        this.sweepShift = val & 0x7;
                        this.sweepTimer = 0;
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
        };
        return SquareChannel;
    })();
    var TriangleChannel = (function () {
        function TriangleChannel(papu) {
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
        TriangleChannel.prototype.writeRegister = function (addr, val) {
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
        };
        TriangleChannel.prototype.lengthCounterDeduct = function () {
            this.lengthCounter--;
            if (this.lengthCounter == 0)
                this.currentOutput = 0;
        };
        TriangleChannel.prototype.linearCounterDeduct = function () {
            this.linearCounter--;
            if (this.linearCounter == 0)
                this.currentOutput = 0;
        };
        return TriangleChannel;
    })();
    var NoiseChannel = (function () {
        function NoiseChannel(papu) {
            //public lengthCounter: number;
            this.noiseWaveLengthLookup = [0x4, 0x8, 0x10, 0x20, 0x40, 0x60, 0x80, 0xa,
                0xca, 0xfe, 0x17c, 0x1fc, 0x2fa, 0x3f8, 0x7f2, 0xfe4];
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
        NoiseChannel.prototype.updateCurrentOutput = function () {
            this.currentOutput = (Math.random() > 0.5 ? 1 : 0) * this.volume;
        };
        NoiseChannel.prototype.lengthCounterDeduct = function () {
            this.lengthCounter--;
            if (this.lengthCounter == 0)
                this.currentOutput = 0;
        };
        NoiseChannel.prototype.writeRegister = function (addr, val) {
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
        };
        return NoiseChannel;
    })();
    var DMCChannel = (function () {
        function DMCChannel(papu) {
            //public lengthCounter: number;
            this.dmcWaveLengthLookup = [428, 380, 340, 320, 286, 254, 226, 214, 190, 160, 142, 128, 106, 84, 72, 54];
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
        DMCChannel.prototype.dmcRestart = function () {
            this.currentAddr = this.dmcStartAddress;
            this.currentLength = 0;
            this.isIRQEnabled = false;
        };
        DMCChannel.prototype.writeRegister = function (addr, val) {
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
        };
        DMCChannel.prototype.updateCurrentValue = function () {
            if (((this.currentByte >> (7 - this.bitIndex)) & 1) > 0) {
                if (this.currentOutput > 0) {
                    this.deltaCounter--;
                }
                else if (this.deltaCounter < 63) {
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
        };
        return DMCChannel;
    })();
    var PAPU = (function () {
        function PAPU(machine) {
            this.totalCycles = 0;
            this.bufferSize = 8192 * 2;
            this.lastPlayTime = 0;
            this.lengthCounterLookup = [
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
            this.frameCounterTickSequenceLength = 4;
            this.frameCounterTickStep = 0; //ranging from 0-3 or 0-4, depending on the frameCounterMode
            this.noteStartPos = -1;
            this.toPlay = false;
            this.machine = machine;
            this.square1 = new SquareChannel(this);
            this.square2 = new SquareChannel(this);
            this.noise = new NoiseChannel(this);
            this.triangle = new TriangleChannel(this);
            this.dmc = new DMCChannel(this);
            this.SAMPLING_CYCLES = this.machine.opt_CPU_FREQ_NTSC / this.machine.opt_sampleRate; //1789773/44100 = 40.5844 cycles
            this.frameCounterTickLengthInCycles = this.machine.opt_CPU_FREQ_NTSC / 240; // APU runs at 240Hz
            this.apuCycleCounter = 0;
            this.bufferPlayTime = this.bufferSize * 1000.0 / this.machine.opt_sampleRate;
            this.reset();
        }
        PAPU.prototype.reset = function () {
            if (!this.machine.opt_isIE) {
                this.audioContext = new (AudioContext || webkitAudioContext)();
                this.audioBuffer = this.audioContext.createBuffer(1, this.bufferSize, this.machine.opt_sampleRate);
                this.audioBufferArrayIndex = 0;
                this.audioContext1 = new AudioContext();
                this.audioBuffer1 = this.audioContext.createBuffer(1, this.bufferSize, this.machine.opt_sampleRate);
                this.audioBufferArrayIndex1 = 0;
            }
            this.frameCounterTickCycleCounter = 0;
            this.frameCounterTickStep = 0;
        };
        PAPU.prototype.addCycles = function (cpuCycles) {
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
        };
        PAPU.prototype.readReg = function (addr) {
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
        };
        PAPU.prototype.writeReg = function (addr, val) {
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
        };
        PAPU.prototype.sample = function (nCycles) {
            var output = 0.00752 * (this.square1.currentOutput + this.square2.currentOutput) + 0.00851 * this.triangle.currentOutput
                + 0.00494 * this.noise.currentOutput;
            this.sendToSource(output);
        };
        PAPU.prototype.updateChannelStatus0x4015 = function (val) {
            if ((val & 0x10) == 0) {
                this.dmc.isEnabled = false;
            }
            else {
                this.dmc.isEnabled = true;
                this.dmc.dmcRestart();
            }
            if ((val & 0x8) == 0) {
                this.noise.isEnabled = false;
                this.noise.lengthCounter = 0;
            }
            else {
                this.noise.isEnabled = true;
            }
            if ((val & 0x4) == 0) {
                this.triangle.isEnabled = false;
                this.triangle.lengthCounter = 0;
            }
            else {
                this.triangle.isEnabled = true;
            }
            if ((val & 0x2) == 0) {
                this.square2.isEnabled = false;
                this.square2.lengthCounter = 0;
            }
            else {
                this.square2.isEnabled = true;
            }
            if ((val & 0x1) == 0) {
                this.square1.isEnabled = false;
                this.square1.lengthCounter = 0;
            }
            else {
                this.square1.isEnabled = true;
            }
        };
        PAPU.prototype.frameCounterTick = function () {
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
        };
        PAPU.prototype.sendToSource = function (val) {
            if ((!this.machine.opt_isIE)) {
                if (this.toPlay) {
                    if (this.noteStartPos == -1 && val != 0) {
                        this.noteStartPos = this.audioBufferArrayIndex;
                    }
                    this.audioBufferArray = this.audioBuffer.getChannelData(0);
                    if ((this.noteStartPos != -1)
                        && (this.audioBufferArrayIndex < (this.bufferSize - 1000))
                        && ((this.audioBufferArrayIndex - this.noteStartPos) < 1000)) {
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
                        }
                        else {
                            setTimeout(function () { apu.playMusic(); }, this.bufferPlayTime - delta);
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
                        && ((this.audioBufferArrayIndex1 - this.noteStartPos) < 1000)) {
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
                        }
                        else {
                            setTimeout(function () { apu.playMusic1(); }, this.bufferPlayTime - delta);
                        }
                    }
                }
            }
        };
        PAPU.prototype.playMusic = function () {
            var source = this.audioContext.createBufferSource();
            // set the buffer in the AudioBufferSourceNode
            source.buffer = this.audioBuffer;
            // connect the AudioBufferSourceNode to the
            // destination so we can hear the sound
            source.connect(this.audioContext.destination);
            // start the source playing
            source.start();
        };
        PAPU.prototype.playMusic1 = function () {
            var source = this.audioContext1.createBufferSource();
            // set the buffer in the AudioBufferSourceNode
            source.buffer = this.audioBuffer1;
            // connect the AudioBufferSourceNode to the
            // destination so we can hear the sound
            source.connect(this.audioContext1.destination);
            // start the source playing
            source.start();
        };
        return PAPU;
    })();
    NES.PAPU = PAPU;
})(NES || (NES = {}));
//# sourceMappingURL=PAPU.js.map